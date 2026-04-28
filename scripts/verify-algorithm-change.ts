/**
 * Before/after verification for the FDR multiplier split + MOTM reclassification.
 *
 * Reads confidence_snapshots from the DB (which encode the event type and FDR
 * in the reason string), then simulates both the OLD and NEW calculator logic
 * to produce a side-by-side comparison without touching live FPL API data.
 *
 * Run with: npx tsx --tsconfig tsconfig.json scripts/verify-algorithm-change.ts
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'data', 'fpl.db');

const db = new Database(DB_PATH, { readonly: true });

// ── Multiplier tables ──────────────────────────────────────────────────────

const OLD_POSITIVE: Record<number, number> = {
  1: 0.5,
  2: 0.75,
  3: 1.0,
  4: 1.25,
  5: 1.5,
};
const GOAL_ASSIST_NEW: Record<number, number> = {
  1: 0.5,
  2: 0.75,
  3: 1.0,
  4: 1.5,
  5: 2.5,
};
const OTHER_POSITIVE_NEW: Record<number, number> = {
  1: 0.5,
  2: 0.75,
  3: 1.0,
  4: 1.25,
  5: 1.5,
};
const BLANK: Record<number, number> = {
  1: 1.5,
  2: 1.25,
  3: 1.0,
  4: 0.75,
  5: 0.5,
};

function roundAway(x: number): number {
  return Math.sign(x) * Math.round(Math.abs(x));
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

// ── Event parser ───────────────────────────────────────────────────────────

/** Possible event types encoded in the reason string. */
type EventType =
  | 'MOTM' // "MOTM vs FDR X opponent"
  | 'Assist-MOTM' // "Assist vs FDR X opponent (MOTM)"
  | 'Performance' // "Performance vs FDR X opponent"
  | 'Clean sheet' // "Clean sheet vs FDR X opponent"
  | 'DefCon' // "DefCon vs FDR X opponent"
  | 'SaveCon' // "SaveCon vs FDR X opponent"
  | 'Blank' // "Blank vs FDR X opponent"
  | 'DGW' // "DGW: ..." — multi-match compound
  | 'unknown';

interface ParsedEvent {
  type: EventType;
  fdr: number;
}

function extractFdr(fragment: string): number {
  const m = /FDR (\d)/.exec(fragment);
  return m?.[1] !== undefined ? parseInt(m[1], 10) : 3;
}

function parseReason(reason: string): ParsedEvent[] {
  // Strip fatigue suffix tokens before splitting on +
  const clean = reason
    .replace(/\s*\+?\s*Fatigue −2/g, '')
    .replace(/\s*\+?\s*Fatigue waived/g, '')
    .replace(/\s*\+?\s*DC Fatigue −2/g, '')
    .replace(/\s*\+?\s*DC Fatigue waived/g, '')
    .replace(/\s*\+?\s*SC Fatigue −2/g, '')
    .replace(/\s*\+?\s*SC Fatigue waived/g, '');

  if (clean.startsWith('DGW:')) {
    return [{ type: 'DGW', fdr: 3 }];
  }

  return clean.split(' + ').map((part): ParsedEvent => {
    const t = part.trim();
    if (t.startsWith('MOTM vs')) return { type: 'MOTM', fdr: extractFdr(t) };
    if (t.startsWith('Assist vs')) return { type: 'Assist-MOTM', fdr: extractFdr(t) };
    if (t.startsWith('Performance vs')) return { type: 'Performance', fdr: extractFdr(t) };
    if (t.startsWith('Clean sheet vs')) return { type: 'Clean sheet', fdr: extractFdr(t) };
    if (t.startsWith('DefCon vs')) return { type: 'DefCon', fdr: extractFdr(t) };
    if (t.startsWith('SaveCon vs')) return { type: 'SaveCon', fdr: extractFdr(t) };
    if (t.startsWith('Blank vs')) return { type: 'Blank', fdr: extractFdr(t) };
    return { type: 'unknown', fdr: 3 };
  });
}

// ── Delta computation ──────────────────────────────────────────────────────

function oldDelta(events: ParsedEvent[]): number {
  // Reconstruct the raw float the OLD algorithm would have produced.
  let rawFloat = 0;
  for (const ev of events) {
    const mul = OLD_POSITIVE[ev.fdr] ?? 1;
    const blk = BLANK[ev.fdr] ?? 1;
    switch (ev.type) {
      case 'MOTM':
      case 'Assist-MOTM':
        rawFloat += 2 * mul;
        break;
      case 'Performance':
        rawFloat += 1 * mul;
        break;
      case 'Clean sheet':
        rawFloat += 1 * mul;
        break;
      case 'DefCon':
      case 'SaveCon':
        rawFloat += 1;
        break;
      case 'Blank':
        rawFloat += -1 * blk;
        break;
      case 'DGW':
      case 'unknown':
        // Cannot decompose — use stored delta as-is (no-op here).
        break;
    }
  }
  return roundAway(rawFloat);
}

function newDelta(events: ParsedEvent[]): number {
  let rawFloat = 0;
  for (const ev of events) {
    const gaMul = GOAL_ASSIST_NEW[ev.fdr] ?? 1;
    const otherMul = OTHER_POSITIVE_NEW[ev.fdr] ?? 1;
    const blk = BLANK[ev.fdr] ?? 1;
    switch (ev.type) {
      case 'MOTM':
      case 'Assist-MOTM':
        rawFloat += 2 * gaMul;
        break;
      case 'Performance': {
        const raw = roundAway(1 * gaMul);
        rawFloat += raw;
        break;
      }
      case 'Clean sheet':
        rawFloat += 1 * otherMul;
        break;
      case 'DefCon':
      case 'SaveCon':
        rawFloat += 1;
        break;
      case 'Blank':
        rawFloat += -1 * blk;
        break;
      case 'DGW':
      case 'unknown':
        break;
    }
  }
  // For multi-event (GK/DEF stacking), round the total once.
  // For single-event (MID/FWD), each event is already rounded above.
  // This approximation is close enough for verification purposes.
  return roundAway(rawFloat);
}

function isNewMotm(events: ParsedEvent[]): boolean {
  for (const ev of events) {
    if (ev.type === 'MOTM' || ev.type === 'Assist-MOTM') return true;
    if (ev.type === 'Performance') {
      const raw = roundAway(GOAL_ASSIST_NEW[ev.fdr] ?? 1);
      if (raw >= 3) return true;
    }
  }
  return false;
}

// ── Fatigue simulation ─────────────────────────────────────────────────────

const CONFIDENCE_MIN = -4;
const CONFIDENCE_MAX = 5;
const FATIGUE_THRESHOLD = 3;
const FATIGUE_PENALTY = -2;

interface MatchRow {
  gameweek: number;
  delta: number;
  confidence_after: number;
  reason: string;
  fatigue_applied: number;
  motm_counter: number;
}

interface SimResult {
  finalConfidence: number;
  history: { gameweek: number; delta: number; confidenceAfter: number; reason: string }[];
}

function simulate(rows: MatchRow[], useNew: boolean): SimResult {
  let confidence = 0;
  let motmCount = 0;
  let defConCount = 0;
  let saveConCount = 0;
  const history: SimResult['history'] = [];

  for (const row of rows) {
    const events = parseReason(row.reason);
    const isDgw = events.some((e) => e.type === 'DGW');

    if (isDgw) {
      // DGW: the stored delta is the net change; we simulate using the stored delta
      // for OLD, and for NEW we can't fully decompose the matches — use stored as
      // a proxy and flag it.
      const rawDelta = row.delta;
      const before = confidence;
      confidence = clamp(before + rawDelta, CONFIDENCE_MIN, CONFIDENCE_MAX);
      history.push({
        gameweek: row.gameweek,
        delta: confidence - before,
        confidenceAfter: confidence,
        reason: `[DGW — using stored delta ${rawDelta.toString()}]`,
      });
      continue;
    }

    const rawDelta = useNew ? newDelta(events) : oldDelta(events);
    const before = confidence;
    confidence = clamp(before + rawDelta, CONFIDENCE_MIN, CONFIDENCE_MAX);

    const motmEvent = useNew
      ? isNewMotm(events)
      : events.some((e) => e.type === 'MOTM' || e.type === 'Assist-MOTM');
    const defConEvent = events.some((e) => e.type === 'DefCon');
    const saveConEvent = events.some((e) => e.type === 'SaveCon');

    let reason = row.reason;

    if (motmEvent) {
      motmCount += 1;
      if (motmCount >= FATIGUE_THRESHOLD) {
        const hyp = confidence + FATIGUE_PENALTY;
        if (hyp > 0) {
          confidence = hyp;
          reason += ' + Fatigue −2';
        } else {
          reason += ' + Fatigue waived';
        }
        motmCount = 0;
      }
    } else if (defConEvent) {
      defConCount += 1;
      if (defConCount >= FATIGUE_THRESHOLD) {
        const hyp = confidence + FATIGUE_PENALTY;
        if (hyp > 0) {
          confidence = hyp;
          reason += ' + DC Fatigue −2';
        } else {
          reason += ' + DC Fatigue waived';
        }
        defConCount = 0;
      }
    } else if (saveConEvent) {
      saveConCount += 1;
      if (saveConCount >= FATIGUE_THRESHOLD) {
        const hyp = confidence + FATIGUE_PENALTY;
        if (hyp > 0) {
          confidence = hyp;
          reason += ' + SC Fatigue −2';
        } else {
          reason += ' + SC Fatigue waived';
        }
        saveConCount = 0;
      }
    }

    history.push({
      gameweek: row.gameweek,
      delta: confidence - before,
      confidenceAfter: confidence,
      reason,
    });
  }

  return { finalConfidence: confidence, history };
}

// ── Main ───────────────────────────────────────────────────────────────────

const PLAYERS: { id: number; name: string; position: string }[] = [
  { id: 430, name: 'Haaland', position: 'FWD' },
  { id: 178, name: 'Welbeck', position: 'FWD' },
  { id: 691, name: 'Calvert-Lewin', position: 'FWD' },
  { id: 449, name: 'B.Fernandes', position: 'MID' },
  { id: 381, name: 'M.Salah', position: 'MID' },
  { id: 16, name: 'Saka', position: 'MID' },
  { id: 235, name: 'Palmer', position: 'MID' },
  { id: 5, name: 'Gabriel', position: 'DEF' },
  { id: 6, name: 'Saliba', position: 'DEF' },
  { id: 287, name: 'Pickford', position: 'GK' },
];

const rowStmt = db.prepare<[number], MatchRow>(
  `SELECT gameweek, delta, confidence_after, reason, fatigue_applied, motm_counter
   FROM confidence_snapshots
   WHERE player_id = ?
   ORDER BY gameweek ASC`,
);

interface ImpactedRow {
  gw: number;
  oldDelta: number;
  newDelta: number;
  oldConf: number;
  newConf: number;
  reason: string;
}

console.log('\n=== Algorithm change verification: before vs after ===\n');
console.log('Change: GOAL_ASSIST_FDR_MULTIPLIERS boosted (FDR4: 1.25→1.5, FDR5: 1.5→2.5)');
console.log('        Performance ≥+3 reclassified as MOTM\n');

for (const player of PLAYERS) {
  const rows = rowStmt.all(player.id);

  const oldSim = simulate(rows, false);
  const newSim = simulate(rows, true);

  const storedFinal = rows.at(-1)?.confidence_after ?? 0;
  const oldFinal = oldSim.finalConfidence;
  const newFinal = newSim.finalConfidence;
  const delta = newFinal - oldFinal;

  // Find rows where the algorithm produces a different delta
  const impacted: ImpactedRow[] = [];
  for (let i = 0; i < oldSim.history.length; i++) {
    const o = oldSim.history[i];
    const n = newSim.history[i];
    if (o === undefined || n === undefined) continue;
    if (o.delta !== n.delta || o.confidenceAfter !== n.confidenceAfter) {
      impacted.push({
        gw: o.gameweek,
        oldDelta: o.delta,
        newDelta: n.delta,
        oldConf: o.confidenceAfter,
        newConf: n.confidenceAfter,
        reason: rows[i]?.reason ?? '',
      });
    }
  }

  const sign = delta > 0 ? '+' : '';
  console.log(`── ${player.name} (${player.position}) ──────────────────────`);
  console.log(`  Stored final:  ${storedFinal.toString().padStart(3)}`);
  console.log(`  Old sim final: ${oldFinal.toString().padStart(3)}`);
  console.log(
    `  New sim final: ${newFinal.toString().padStart(3)}  (${sign}${delta.toString()} vs old)`,
  );

  if (impacted.length === 0) {
    console.log('  No impacted gameweeks — confidence unchanged\n');
  } else {
    console.log(`  Impacted gameweeks (${impacted.length.toString()}):`);
    for (const row of impacted) {
      const trigger = row.reason.replace(/\s*\+\s*(Fatigue.*)/g, '').trim();
      console.log(
        `    GW${row.gw.toString().padEnd(3)}  old Δ=${row.oldDelta.toString().padStart(3)}, conf=${row.oldConf.toString().padStart(3)}` +
          `  →  new Δ=${row.newDelta.toString().padStart(3)}, conf=${row.newConf.toString().padStart(3)}` +
          `   [${trigger}]`,
      );
    }
    console.log();
  }
}

db.close();
