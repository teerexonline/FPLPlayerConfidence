export type HotStreakLevel = 'red_hot' | 'med_hot' | 'low_hot';

export interface SnapshotBrief {
  readonly gameweek: number;
  readonly delta: number;
}

/**
 * Classifies a hot streak level from the number of gameweeks elapsed since
 * the boost match. Exported for bulk-query paths that compute gwsSince from
 * a single DB aggregation rather than iterating per-player snapshots.
 *
 * gwsSince = 0: boost GW itself → 'red_hot' (Fresh)
 * gwsSince = 1: one GW after    → 'med_hot' (Recent)
 * gwsSince = 2: two GWs after   → 'low_hot' (Fading)
 * gwsSince ≥ 3: streak expired  → null
 */
export function hotStreakFromGwsSince(gwsSince: number): HotStreakLevel | null {
  if (gwsSince === 0) return 'red_hot';
  if (gwsSince === 1) return 'med_hot';
  if (gwsSince === 2) return 'low_hot';
  return null;
}

/**
 * Computes a player's hot streak level at an arbitrary gameweek N, anchored
 * to the most recent boost (delta ≥ 3) at or before N.
 *
 * Used by MatchHistoryStrip to annotate each historical card with the streak
 * state that was active during that gameweek, enabling per-card flame badges.
 *
 * Multiple boosts: if a player had a boost in GW20 and another in GW28, the
 * GW29 card uses GW28 as its anchor (most-recent prior boost ≤ GW29).
 */
export function computeHotStreakAtGameweek(
  snapshots: readonly SnapshotBrief[],
  atGameweek: number,
): HotStreakLevel | null {
  const mostRecentBoost = [...snapshots]
    .filter((s) => s.gameweek <= atGameweek && s.delta >= 3)
    .sort((a, b) => b.gameweek - a.gameweek)[0];

  if (mostRecentBoost === undefined) return null;
  return hotStreakFromGwsSince(atGameweek - mostRecentBoost.gameweek);
}

/**
 * Computes a player's current hot streak level from their full snapshot history.
 * Thin wrapper around computeHotStreakAtGameweek anchored to the live currentGW.
 *
 * A "hot" match is any gameweek where delta ≥ +3. The streak level decays:
 *   - 0 GWs since boost → 'red_hot'  (Fresh)
 *   - 1 GW  since boost → 'med_hot'  (Recent)
 *   - 2 GWs since boost → 'low_hot'  (Fading)
 *   - 3+ GWs since boost → null (cold)
 *
 * If a player earns a new +3 boost during an existing streak, the timer resets.
 * Snapshots may arrive in any order; the function sorts internally.
 */
export function computeHotStreak(
  snapshots: readonly SnapshotBrief[],
  currentGW: number,
): HotStreakLevel | null {
  return computeHotStreakAtGameweek(snapshots, currentGW);
}
