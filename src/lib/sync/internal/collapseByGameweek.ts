import type { MatchDelta } from '@/lib/confidence';
import type { DbConfidenceSnapshot } from '@/lib/db/types';

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
 *
 * DGW event_magnitude = best moment by raw magnitude — the "hottest"
 * sub-match wins.
 */
export function collapseByGameweek(
  pid: number,
  history: readonly MatchDelta[],
): DbConfidenceSnapshot[] {
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
    const totalRawDelta = entries.reduce((sum, e) => sum + e.rawDelta, 0);
    const eventMagnitude = Math.max(...entries.map((e) => e.eventMagnitude));
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
      raw_delta: totalRawDelta,
      event_magnitude: eventMagnitude,
      reason,
      fatigue_applied: entries.some((e) => e.fatigueApplied),
      motm_counter: last.motmCounterAfter,
      defcon_counter: last.defConCounterAfter,
      savecon_counter: last.saveConCounterAfter,
    });
  }
  return result;
}
