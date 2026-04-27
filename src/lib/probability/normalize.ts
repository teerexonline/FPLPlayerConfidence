import { MIN_MINUTES_FOR_RANKING } from './constants';
import type { PlayerInput, PlayerPercentiles, PositionCohort, Position } from './types';

/** Convert a season-total ICT value to a per-90-minute rate. Returns 0 if minutes is 0. */
export function toP90(value: number, minutes: number): number {
  if (minutes === 0) return 0;
  return (value / minutes) * 90;
}

/** Median of a numeric array. Does not mutate the input. */
export function medianOf(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    // mid < length guaranteed (odd n ≥ 1, mid = floor(n/2))
    return sorted.at(mid) ?? 0;
  }
  // mid - 1 ≥ 0 and mid < length guaranteed (even n ≥ 2)
  return ((sorted.at(mid - 1) ?? 0) + (sorted.at(mid) ?? 0)) / 2;
}

/**
 * Percentile rank of `value` within `cohort` using the mid-rank method:
 *   (count strictly lower + 0.5 × count equal) / n
 * Output is in [0, 1]. For a 1-player cohort, returns 0.5.
 */
export function percentileRank(value: number, cohort: readonly number[]): number {
  const n = cohort.length;
  if (n === 0) return 0.5;
  let lower = 0;
  let equal = 0;
  for (const v of cohort) {
    if (v < value) lower++;
    else if (v === value) equal++;
  }
  return (lower + 0.5 * equal) / n;
}

/**
 * Apply shrinkage toward the position median when a player has fewer than
 * MIN_MINUTES_FOR_RANKING minutes. Prevents one-hot-cameo distortion.
 *
 * shrinkage = min(1, minutes / MIN_MINUTES_FOR_RANKING)
 * result    = shrinkage × rawP90 + (1 - shrinkage) × medianP90
 */
export function applyShrunken(rawP90: number, minutes: number, medianP90: number): number {
  const shrinkage = Math.min(1, minutes / MIN_MINUTES_FOR_RANKING);
  return shrinkage * rawP90 + (1 - shrinkage) * medianP90;
}

/**
 * Compute position cohort medians from a set of same-position players.
 * Medians are computed from raw per-90 values (before shrinkage) so that
 * the shrinkage anchor represents the typical season-long production.
 */
export function buildPositionCohort(players: readonly PlayerInput[]): PositionCohort {
  const influenceP90s = players.map((p) => toP90(p.influence, p.minutes));
  const threatP90s = players.map((p) => toP90(p.threat, p.minutes));
  const creativityP90s = players.map((p) => toP90(p.creativity, p.minutes));

  return {
    medianInfluenceP90: medianOf(influenceP90s),
    medianThreatP90: medianOf(threatP90s),
    medianCreativityP90: medianOf(creativityP90s),
  };
}

/**
 * Compute shrinkage-adjusted percentile ranks for all players across all
 * position groups. Returns a Map from player ID to their percentile values.
 *
 * Algorithm:
 * 1. Group players by position.
 * 2. For each group, compute raw per-90 values and position medians.
 * 3. Apply shrinkage to each player's per-90 values.
 * 4. Compute percentile rank of each player's adjusted value within the group.
 */
export function computePercentileRanks(
  players: readonly PlayerInput[],
): ReadonlyMap<number, PlayerPercentiles> {
  const positions: readonly Position[] = ['GK', 'DEF', 'MID', 'FWD'];
  const result = new Map<number, PlayerPercentiles>();

  for (const pos of positions) {
    const group = players.filter((p) => p.position === pos && p.minutes > 0);
    if (group.length === 0) continue;

    const cohort = buildPositionCohort(group);

    // Apply shrinkage to each player's per-90 stats
    const adjustedInfluence = group.map((p) =>
      applyShrunken(toP90(p.influence, p.minutes), p.minutes, cohort.medianInfluenceP90),
    );
    const adjustedThreat = group.map((p) =>
      applyShrunken(toP90(p.threat, p.minutes), p.minutes, cohort.medianThreatP90),
    );
    const adjustedCreativity = group.map((p) =>
      applyShrunken(toP90(p.creativity, p.minutes), p.minutes, cohort.medianCreativityP90),
    );

    for (const [i, player] of group.entries()) {
      // adjustedX arrays are parallel to group (same length), so [i] is always defined
      result.set(player.id, {
        seasonPosition: pos,
        influencePct: percentileRank(adjustedInfluence[i] ?? 0, adjustedInfluence),
        threatPct: percentileRank(adjustedThreat[i] ?? 0, adjustedThreat),
        creativityPct: percentileRank(adjustedCreativity[i] ?? 0, adjustedCreativity),
      });
    }
  }

  return result;
}
