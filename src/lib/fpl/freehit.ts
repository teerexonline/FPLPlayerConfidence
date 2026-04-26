/**
 * Free Hit chip resolution.
 *
 * When a manager plays the Free Hit chip on gameweek N, their picks for that
 * GW are temporary — they revert to their previous squad the following week.
 * Showing the FH squad as the "current squad" is misleading, so we fall back
 * to the prior GW's picks (their regular squad). Single fallback only.
 *
 * GW1 edge case: if FH is played on GW1 there is no prior GW to fall back to,
 * so we show the GW1 squad unchanged and set `isGw1FreeHit: true`.
 */

export interface FreeHitResolution {
  /** The gameweek whose picks should actually be fetched and displayed. */
  readonly gameweek: number;
  /** True when we stepped back one GW because the fetched GW had an active FH. */
  readonly freeHitBypassed: boolean;
  /** The GW that had the Free Hit active; null when not bypassed. */
  readonly freeHitGameweek: number | null;
  /** True when Free Hit was played on GW1 (no fallback possible). */
  readonly isGw1FreeHit: boolean;
}

/**
 * Resolves which gameweek's squad data to display given the active chip.
 *
 * @param activeChip - The `active_chip` field from the FPL picks endpoint (may be null).
 * @param targetGw   - The initial gameweek to show (typically currentGW − 1).
 */
export function resolveFreeHit(activeChip: string | null, targetGw: number): FreeHitResolution {
  if (activeChip === 'freehit') {
    if (targetGw > 1) {
      return {
        gameweek: targetGw - 1,
        freeHitBypassed: true,
        freeHitGameweek: targetGw,
        isGw1FreeHit: false,
      };
    }
    return {
      gameweek: 1,
      freeHitBypassed: false,
      freeHitGameweek: null,
      isGw1FreeHit: true,
    };
  }
  return {
    gameweek: targetGw,
    freeHitBypassed: false,
    freeHitGameweek: null,
    isGw1FreeHit: false,
  };
}
