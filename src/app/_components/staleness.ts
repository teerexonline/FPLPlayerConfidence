// design-note: Excludes players whose last snapshot is >3 GWs behind the current GW.
// Without this filter, a stale player (e.g. Salah at Leeds whose confidence peaked at
// +5 in GW5 and was never updated as he became inactive) would sit at the top of the
// leaderboard even at GW34 — misleading for FPL decision-making. Three GWs is the
// threshold: a single blank week happens; a month of absence means the signal is dead.
//
// This filter is intentionally NOT applied to the /players list, which is a complete
// reference and must show every tracked player.

/**
 * Returns true when the player's most recent snapshot is more than 3 gameweeks
 * behind the current gameweek, making their confidence signal effectively stale.
 *
 * Returns false when `currentGW` is 0 (unknown) to avoid incorrectly filtering
 * all players on the very first sync before the current GW is established.
 */
export function isStale(latestSnapshotGW: number, currentGW: number): boolean {
  if (currentGW === 0) return false;
  return currentGW - latestSnapshotGW > 3;
}
