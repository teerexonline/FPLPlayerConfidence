import type { DashboardPlayer } from './types';

/** Minimum fields required to assess mover eligibility. */
interface MoverCandidate {
  readonly status: string;
  readonly recentAppearances: number;
}

/**
 * A player qualifies for Risers/Fallers only when they are available (status
 * 'a') AND have fresh data (appeared in ≥ 2 of the last 3 GWs). Any other
 * status — injured ('i'), doubtful ('d'), suspended ('s'), etc. — is excluded
 * because their delta reflects past form they can no longer sustain, making
 * the card misleading.
 *
 * The structural `MoverCandidate` parameter type means this function works
 * with both DashboardPlayer and PlayerWithConfidence — both satisfy it.
 */
export function isEligibleMover(player: MoverCandidate): boolean {
  return player.status === 'a' && player.recentAppearances >= 2;
}

/** Top `count` eligible players with a positive delta, delta descending. */
export function selectRisers(
  players: readonly DashboardPlayer[],
  count: number,
): readonly DashboardPlayer[] {
  return [...players]
    .filter((p) => isEligibleMover(p) && p.latestDelta > 0)
    .sort((a, b) => {
      const primary = b.latestDelta - a.latestDelta;
      return primary !== 0 ? primary : b.totalPoints - a.totalPoints;
    })
    .slice(0, count);
}

/** Top `count` eligible players with a negative delta, delta ascending (most negative first). */
export function selectFallers(
  players: readonly DashboardPlayer[],
  count: number,
): readonly DashboardPlayer[] {
  return [...players]
    .filter((p) => isEligibleMover(p) && p.latestDelta < 0)
    .sort((a, b) => {
      const primary = a.latestDelta - b.latestDelta;
      return primary !== 0 ? primary : b.totalPoints - a.totalPoints;
    })
    .slice(0, count);
}
