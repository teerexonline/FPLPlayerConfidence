/**
 * A player is considered stale when their most recent snapshot is more than
 * STALE_GW_THRESHOLD gameweeks behind the current gameweek.  Using the
 * last-appearance GW (rather than a row count) means a Double Gameweek stored
 * as a single compound snapshot row is treated correctly: GW33-DGW at
 * currentGW=35 gives a gap of 2, which is NOT > 2, so the player is fresh.
 */
export const STALE_GW_THRESHOLD = 2;

/**
 * Returns true when the player's last snapshot is stale or absent.
 * @param currentGw  The current/latest gameweek (from sync_meta).
 * @param lastAppearanceGw  MAX(gameweek) for this player in the recent window,
 *                          or null when no snapshots exist in that window.
 */
export function computeIsStale(currentGw: number, lastAppearanceGw: number | null): boolean {
  if (lastAppearanceGw === null) return true;
  return currentGw - lastAppearanceGw > STALE_GW_THRESHOLD;
}
