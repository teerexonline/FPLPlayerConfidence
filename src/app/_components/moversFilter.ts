import type { DashboardPlayer } from './types';

/**
 * A player qualifies for Risers/Fallers only when they are available (status
 * 'a') AND have fresh data (appeared in ≥ 2 of the last 3 GWs). Any other
 * status — injured ('i'), doubtful ('d'), suspended ('s'), etc. — is excluded
 * because their delta reflects past form they can no longer sustain, making
 * the card misleading.
 */
export function isEligibleMover(player: DashboardPlayer): boolean {
  return player.status === 'a' && player.recentAppearances >= 2;
}

/** Top `count` eligible players with a positive delta, delta descending. */
export function selectRisers(
  players: readonly DashboardPlayer[],
  count: number,
): readonly DashboardPlayer[] {
  return [...players]
    .filter((p) => isEligibleMover(p) && p.latestDelta > 0)
    .sort((a, b) => b.latestDelta - a.latestDelta)
    .slice(0, count);
}

/** Top `count` eligible players with a negative delta, delta ascending (most negative first). */
export function selectFallers(
  players: readonly DashboardPlayer[],
  count: number,
): readonly DashboardPlayer[] {
  return [...players]
    .filter((p) => isEligibleMover(p) && p.latestDelta < 0)
    .sort((a, b) => a.latestDelta - b.latestDelta)
    .slice(0, count);
}
