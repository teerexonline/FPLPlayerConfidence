/**
 * Big-team FDR override verification (Piece 3).
 *
 * Fetches live FPL API data for 10 reference players, rebuilds their full match
 * histories from raw event data (so opponentTeamId is known for every match), and
 * compares confidence:
 *
 *   BEFORE = Phase A algorithm (split multipliers + MOTM reclassification, NO big-team override)
 *   AFTER  = Phase B added    (same, PLUS: Liverpool/City/MUN/Chelsea → effective FDR 5)
 *
 * The script does NOT read stored reason strings — it re-derives everything from
 * the FPL API so that the true opponent identity is available for each match.
 *
 * Run with: npx tsx --tsconfig tsconfig.json scripts/verify-big-team-override.ts
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { calculateConfidence } from '../src/lib/confidence/calculator.js';
import { buildFdrLookup, mapMatchEvents } from '../src/lib/sync/internal/matchEventMapper.js';
import type { MatchEvent } from '../src/lib/confidence/types.js';
import type { Fixtures, HistoryItem } from '../src/lib/fpl/types.js';
import { FixturesSchema, HistoryItemSchema } from '../src/lib/fpl/schemas.js';
import { z } from 'zod';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'data', 'fpl.db');

// ── Constants ──────────────────────────────────────────────────────────────

/** Same set as in calculator.ts — verified against the DB teams table. */
const BIG_TEAM_IDS: ReadonlySet<number> = new Set([7, 12, 13, 14]);
const BIG_TEAM_NAMES: Record<number, string> = {
  7: 'Chelsea',
  12: 'Liverpool',
  13: 'Man City',
  14: 'Man Utd',
};

const FPL_BASE = 'https://fantasy.premierleague.com/api';

// ── FPL fetch helpers ──────────────────────────────────────────────────────

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'fpl-confidence-verify/1.0' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status.toString()} from ${url}`);
  return res.json();
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const ElementSummaryLiteSchema = z.object({
  history: z.array(HistoryItemSchema),
});

// ── DB helpers ─────────────────────────────────────────────────────────────

interface DbPlayer {
  id: number;
  web_name: string;
  team_id: number;
  position: string;
  confidence_after: number | null;
}

// ── Match simulation helpers ───────────────────────────────────────────────

/**
 * Returns "old" match events (Phase A): all opponentTeamId neutralised to 0
 * so the calculator never applies the big-team override, and the FPL-assigned
 * opponentFdr is used as-is.
 */
function neutraliseTeamIds(events: readonly MatchEvent[]): readonly MatchEvent[] {
  return events.map((e) => ({ ...e, opponentTeamId: 0 }));
}

// ── Output helpers ─────────────────────────────────────────────────────────

function sign(n: number): string {
  return n > 0 ? `+${n.toString()}` : n.toString();
}

function pad(s: string | number, w: number): string {
  return String(s).padStart(w);
}

// ── Players ────────────────────────────────────────────────────────────────

const PLAYER_IDS = [430, 178, 691, 449, 381, 16, 235, 5, 6, 287];

// ── Main ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const db = new Database(DB_PATH, { readonly: true });

  console.log('Fetching FPL bootstrap + fixtures…');
  const [bootstrapRaw, fixturesRaw] = await Promise.all([
    fetchJson(`${FPL_BASE}/bootstrap-static/`),
    fetchJson(`${FPL_BASE}/fixtures/`),
  ]);

  const fixtures: Fixtures = FixturesSchema.parse(fixturesRaw);
  const fdrLookup = buildFdrLookup(fixtures);

  // Build a name lookup from the bootstrap teams list (for display)
  const bootstrapTeams = z
    .object({
      teams: z.array(z.object({ id: z.number(), name: z.string(), short_name: z.string() })),
    })
    .parse(bootstrapRaw).teams;
  const teamNameById = new Map(bootstrapTeams.map((t) => [t.id, t.short_name]));

  console.log('\n=== Big-team FDR override verification ===\n');
  console.log('BEFORE = Phase A (split multipliers, no big-team override)');
  console.log('AFTER  = Phase B (+ Liverpool / Man City / Man Utd / Chelsea → effective FDR 5)\n');

  for (const [i, playerId] of PLAYER_IDS.entries()) {
    if (i > 0) await delay(250); // polite API rate-limiting

    // ── 1. Player metadata from DB ──────────────────────────────────────

    const dbPlayer = db
      .prepare<[number], DbPlayer>(
        `SELECT p.id, p.web_name, p.team_id, p.position,
              cs.confidence_after
       FROM players p
       LEFT JOIN confidence_snapshots cs ON cs.player_id = p.id
         AND cs.gameweek = (SELECT MAX(gameweek) FROM confidence_snapshots WHERE player_id = p.id)
       WHERE p.id = ?`,
      )
      .get(playerId);

    if (dbPlayer === undefined) {
      console.log(`Player id=${playerId.toString()} not found in DB — skipping\n`);
      continue;
    }

    const storedConfidence = dbPlayer.confidence_after ?? 0;

    // ── 2. Fetch live element-summary ───────────────────────────────────

    let history: readonly HistoryItem[];
    try {
      const raw = await fetchJson(`${FPL_BASE}/element-summary/${playerId.toString()}/`);
      history = ElementSummaryLiteSchema.parse(raw).history;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  [ERROR fetching element-summary for ${dbPlayer.web_name}]: ${msg}\n`);
      continue;
    }

    // ── 3. Build match events ───────────────────────────────────────────

    const matchEvents = mapMatchEvents(history, dbPlayer.team_id, fdrLookup);

    if (matchEvents.length === 0) {
      console.log(`── ${dbPlayer.web_name} — no appearances this season\n`);
      continue;
    }

    // ── 4. Simulate BEFORE (no override) and AFTER (with override) ──────

    const beforeResult = calculateConfidence({
      position: dbPlayer.position as 'GK' | 'DEF' | 'MID' | 'FWD',
      matches: neutraliseTeamIds(matchEvents),
    });

    const afterResult = calculateConfidence({
      position: dbPlayer.position as 'GK' | 'DEF' | 'MID' | 'FWD',
      matches: matchEvents,
    });

    const beforeFinal = beforeResult.finalConfidence;
    const afterFinal = afterResult.finalConfidence;

    // ── 5. Find big-team matches and compare deltas ─────────────────────

    interface BigTeamMatch {
      gameweek: number;
      opponentId: number;
      opponentName: string;
      fplFdr: number;
      beforeDelta: number;
      afterDelta: number;
      beforeReason: string;
      afterReason: string;
      deltaChanged: boolean;
    }

    const bigTeamMatches: BigTeamMatch[] = [];
    for (let idx = 0; idx < matchEvents.length; idx++) {
      const ev = matchEvents[idx];
      if (ev === undefined) continue;
      if (!BIG_TEAM_IDS.has(ev.opponentTeamId)) continue;

      const bEntry = beforeResult.history[idx];
      const aEntry = afterResult.history[idx];
      if (bEntry === undefined || aEntry === undefined) continue;

      const opponentName =
        BIG_TEAM_NAMES[ev.opponentTeamId] ??
        teamNameById.get(ev.opponentTeamId) ??
        `Team ${ev.opponentTeamId.toString()}`;

      bigTeamMatches.push({
        gameweek: ev.gameweek,
        opponentId: ev.opponentTeamId,
        opponentName,
        fplFdr: ev.opponentFdr,
        beforeDelta: bEntry.delta,
        afterDelta: aEntry.delta,
        beforeReason: bEntry.reason,
        afterReason: aEntry.reason,
        deltaChanged: bEntry.delta !== aEntry.delta || bEntry.reason !== aEntry.reason,
      });
    }

    // ── 6. Print results ────────────────────────────────────────────────

    const teamName = teamNameById.get(dbPlayer.team_id) ?? `Team ${dbPlayer.team_id.toString()}`;
    console.log(
      `── ${dbPlayer.web_name} (${dbPlayer.position}, ${teamName}) ──────────────────────────────`,
    );
    console.log(`  Stored (Phase A):  ${pad(storedConfidence, 3)}`);
    console.log(
      `  Before (Phase A):  ${pad(beforeFinal, 3)}  ${storedConfidence !== beforeFinal ? '← differs from stored (DGW/fatigue sim gap)' : ''}`,
    );
    console.log(
      `  After  (Phase B):  ${pad(afterFinal, 3)}  (${sign(afterFinal - beforeFinal)} from before)`,
    );

    if (bigTeamMatches.length === 0) {
      console.log('  No appearances vs Liverpool / Man City / Man Utd / Chelsea this season\n');
      continue;
    }

    const changedCount = bigTeamMatches.filter((m) => m.deltaChanged).length;
    console.log(
      `  Big-team matches: ${bigTeamMatches.length.toString()} total, ${changedCount.toString()} changed\n`,
    );

    for (const m of bigTeamMatches) {
      const marker = m.deltaChanged ? '▶' : ' ';
      const fplFdrStr = `FPL FDR ${m.fplFdr.toString()}`;
      console.log(
        `  ${marker} GW${pad(m.gameweek, 2)}  vs ${m.opponentName.padEnd(10)} (${fplFdrStr})`,
      );
      if (m.deltaChanged) {
        console.log(`      BEFORE: Δ=${pad(sign(m.beforeDelta), 3)}  reason: ${m.beforeReason}`);
        console.log(`      AFTER:  Δ=${pad(sign(m.afterDelta), 3)}  reason: ${m.afterReason}`);
      } else {
        console.log(`      Unchanged: Δ=${pad(sign(m.beforeDelta), 3)}  (${m.beforeReason})`);
      }
    }
    console.log();
  }

  db.close();
}

main().catch((err: unknown) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
