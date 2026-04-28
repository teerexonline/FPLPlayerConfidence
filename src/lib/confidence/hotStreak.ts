export type HotStreakLevel = 'red_hot' | 'med_hot' | 'low_hot';

export interface SnapshotBrief {
  readonly gameweek: number;
  readonly delta: number;
}

/**
 * Classifies a hot streak level from the number of gameweeks elapsed since
 * the boost match. Exported for bulk-query paths that compute gwsSince from
 * a single DB aggregation rather than iterating per-player snapshots.
 */
export function hotStreakFromGwsSince(gwsSince: number): HotStreakLevel | null {
  if (gwsSince <= 1) return 'red_hot';
  if (gwsSince === 2) return 'med_hot';
  if (gwsSince === 3) return 'low_hot';
  return null;
}

/**
 * Computes a player's hot streak level from their snapshot history.
 *
 * A "hot" match is any gameweek where delta ≥ +3. The streak level decays
 * over subsequent gameweeks:
 *   - 0–1 GWs since boost → 'red_hot'
 *   - 2 GWs since boost   → 'med_hot'
 *   - 3 GWs since boost   → 'low_hot'
 *   - 4+ GWs since boost  → null (cold)
 *
 * If a player earns a new +3 boost during an existing streak, the timer
 * resets — the function always uses the most recent qualifying gameweek.
 * Snapshots may arrive in any order; the function sorts internally.
 */
export function computeHotStreak(
  snapshots: readonly SnapshotBrief[],
  currentGW: number,
): HotStreakLevel | null {
  const mostRecentBoost = [...snapshots]
    .sort((a, b) => b.gameweek - a.gameweek)
    .find((s) => s.delta >= 3);

  if (mostRecentBoost === undefined) return null;
  return hotStreakFromGwsSince(currentGW - mostRecentBoost.gameweek);
}
