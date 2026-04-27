import { calculateConfidence } from '@/lib/confidence';
import type { MatchDelta } from '@/lib/confidence';
import type { DbConfidenceSnapshot } from '@/lib/db/types';
import type { FetchError } from '@/lib/fpl/types';
import { ok } from '@/lib/utils/result';
import type { Result } from '@/lib/utils/result';
import {
  buildFdrLookup,
  buildNextFdrByTeam,
  elementTypeToPosition,
  FALLBACK_FDR,
  mapMatchEvents,
} from './internal/matchEventMapper';
import type { SyncConfidenceDeps, SyncResult } from './types';

const DEFAULT_THROTTLE_MS = 200;

/**
 * Collapses per-match MatchDeltas into per-gameweek DbConfidenceSnapshots.
 *
 * For single-match gameweeks this is a 1:1 mapping. For double (or triple)
 * gameweeks it sums the individual deltas into one row and builds a
 * "DGW: <reason> (+n) + <reason> (+n)" compound reason string so the UI can
 * display an accurate net figure rather than just the last match's delta.
 *
 * Using the last entry's confidenceAfter is correct because calculateConfidence
 * processes matches in chronological order — the final entry reflects the
 * cumulative clamped state after all matches in that round.
 */
function collapseByGameweek(pid: number, history: readonly MatchDelta[]): DbConfidenceSnapshot[] {
  const groups = new Map<number, MatchDelta[]>();
  for (const entry of history) {
    const arr = groups.get(entry.gameweek) ?? [];
    arr.push(entry);
    groups.set(entry.gameweek, arr);
  }

  const result: DbConfidenceSnapshot[] = [];
  for (const entries of groups.values()) {
    const last = entries.at(-1);
    if (last === undefined) continue;
    const totalDelta = entries.reduce((sum, e) => sum + e.delta, 0);
    const signedStr = (d: number): string => (d >= 0 ? `+${d.toString()}` : d.toString());
    const reason =
      entries.length === 1
        ? (entries.at(0)?.reason ?? '')
        : `DGW: ${entries.map((e) => `${e.reason} (${signedStr(e.delta)})`).join(' + ')}`;

    result.push({
      player_id: pid,
      gameweek: last.gameweek,
      confidence_after: last.confidenceAfter,
      delta: totalDelta,
      reason,
      fatigue_applied: entries.some((e) => e.fatigueApplied),
      motm_counter: last.motmCounterAfter,
      defcon_counter: last.defConCounterAfter,
      savecon_counter: last.saveConCounterAfter,
    });
  }
  return result;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function errorReason(error: FetchError): string {
  switch (error.type) {
    case 'not_found':
      return 'not_found';
    case 'network_error':
      return `network_error: ${error.message}`;
    case 'http_error':
      return `http_error: ${error.status.toString()}`;
    case 'invalid_response':
      return `invalid_response: ${error.message}`;
  }
}

/**
 * Orchestrates the full confidence sync pipeline:
 *   1. Fetch bootstrap-static → persist teams + players
 *   2. Fetch all fixtures → build FDR lookup
 *   3. For each player with total_points > 0, fetch element-summary (throttled)
 *   4. Map history → MatchEvents (with per-fixture FDR) → calculate confidence
 *   5. Persist all snapshots; update sync_meta timestamp
 *
 * All I/O is provided through `deps`. This function contains no direct fetch
 * calls, no `Date.now()`, and no DB-specific code — making it fully testable
 * with fake deps.
 *
 * The operation is idempotent: running it twice produces the same DB state.
 * Per-player failures are isolated and recorded in `SyncResult.errors`.
 */
export async function syncConfidence(
  deps: SyncConfidenceDeps,
): Promise<Result<SyncResult, FetchError>> {
  const { api, repos, clock } = deps;
  const throttleMs = deps.throttleMs ?? DEFAULT_THROTTLE_MS;

  const now = clock();

  // Step a: fetch bootstrap-static — abort the entire sync on failure
  const bootstrapResult = await api.fetchBootstrapStatic();
  if (!bootstrapResult.ok) return bootstrapResult;

  // Step b: fetch all fixtures for FDR lookup — abort on failure
  const fixturesResult = await api.fetchFixtures();
  if (!fixturesResult.ok) return fixturesResult;

  const { teams, elements, events } = bootstrapResult.value;
  const fdrLookup = buildFdrLookup(fixturesResult.value);

  // Resolve the current gameweek from the bootstrap events list.
  // is_current is the active GW; fall back to is_next − 1 if none is marked current
  // (happens between GWs), then fall back to the last finished GW.
  const currentEvent =
    events.find((e) => e.is_current) ??
    events.find((e) => e.is_next && e.id > 1) ??
    [...events].filter((e) => e.finished).pop();
  const currentGw = currentEvent?.id ?? 1;

  const nextFdrByTeam = buildNextFdrByTeam(fixturesResult.value, currentGw);

  // Step c: persist teams + players (upsert semantics — safe to re-run)
  repos.teams.upsertMany(teams);
  repos.players.upsertMany(
    elements.map((e) => ({
      id: e.id,
      web_name: e.web_name,
      team_id: e.team,
      position: elementTypeToPosition(e.element_type),
      now_cost: e.now_cost,
      total_points: e.total_points,
      updated_at: now,
      status: e.status,
      chance_of_playing_next_round: e.chance_of_playing_next_round,
      news: e.news,
      influence: e.influence,
      creativity: e.creativity,
      threat: e.threat,
      minutes: e.minutes,
      next_fixture_fdr: nextFdrByTeam.get(e.team) ?? FALLBACK_FDR,
    })),
  );

  // Steps d–g: process each active player (skip total_points=0)
  const playersToProcess = elements.filter((e) => e.total_points > 0);
  const skippedZeroPoints = elements.length - playersToProcess.length;

  let playersProcessed = 0;
  let skippedZeroMinutes = 0;
  let snapshotsWritten = 0;
  const errors: { playerId: number; reason: string }[] = [];

  for (const [index, player] of playersToProcess.entries()) {
    // Throttle between requests to be a polite API consumer
    if (index > 0) {
      await delay(throttleMs);
    }

    const summaryResult = await api.fetchElementSummary(player.id);
    if (!summaryResult.ok) {
      errors.push({ playerId: player.id, reason: errorReason(summaryResult.error) });
      continue;
    }

    const position = elementTypeToPosition(player.element_type);
    const matchEvents = mapMatchEvents(summaryResult.value.history, player.team, fdrLookup);

    if (matchEvents.length === 0) {
      skippedZeroMinutes++;
      continue;
    }

    const { history } = calculateConfidence({ position, matches: matchEvents });

    const snapshots = collapseByGameweek(player.id, history);
    repos.confidenceSnapshots.upsertMany(snapshots);
    snapshotsWritten += snapshots.length;
    playersProcessed++;
  }

  // Step h: record sync metadata
  repos.syncMeta.set('last_sync', String(now), now);
  repos.syncMeta.set('current_gameweek', String(currentGw), now);

  return ok({
    playersProcessed,
    playersSkipped: skippedZeroPoints + skippedZeroMinutes,
    snapshotsWritten,
    errors,
  });
}
