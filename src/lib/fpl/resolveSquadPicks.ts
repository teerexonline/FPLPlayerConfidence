import { err, ok } from '@/lib/utils/result';
import type { Result } from '@/lib/utils/result';
import { resolveFreeHit } from './freehit';
import type { EntryPick, EntryPicks, FetchError } from './types';

export type FetchPicksFn = (gameweek: number) => Promise<Result<EntryPicks, FetchError>>;

export interface SquadResolution {
  readonly picks: readonly EntryPick[];
  readonly gameweek: number;
  /** True when currentGw returned 404 (deadline not yet passed) and we fell back to currentGw-1. */
  readonly preDeadlineFallback: boolean;
  readonly freeHitBypassed: boolean;
  readonly freeHitGameweek: number | null;
  readonly isGw1FreeHit: boolean;
}

export type SquadResolutionError =
  | { readonly type: 'pre_season' }
  | { readonly type: 'fetch_error'; readonly inner: FetchError };

/**
 * Resolves which squad picks to display given the current gameweek.
 *
 * Fetch order:
 *  1. Try currentGw. A 200 means the deadline has passed — use those picks.
 *  2. A 404 means the deadline has not yet passed (picks not locked). Fall back
 *     to currentGw-1 (last completed GW). Set preDeadlineFallback=true.
 *  3. If both GWs return 404 — or currentGw <= 1 — the season has not started.
 *     Return { type: 'pre_season' }.
 *  4. Non-404 errors from any fetch propagate immediately as { type: 'fetch_error' }.
 *  5. Apply Free Hit detection on the resolved GW. If FH is active and GW > 1,
 *     fetch one GW earlier. On FH-fallback fetch failure, serve the FH picks
 *     unchanged (graceful degrade).
 */
export async function resolveSquadPicks(
  fetchPicks: FetchPicksFn,
  currentGw: number,
): Promise<Result<SquadResolution, SquadResolutionError>> {
  // ── Phase 1: deadline fallback ─────────────────────────────────────────────
  let preDeadlineFallback = false;
  let phase1Result = await fetchPicks(currentGw);
  let phase1Gw = currentGw;

  if (!phase1Result.ok) {
    if (phase1Result.error.type !== 'not_found') {
      return err({ type: 'fetch_error', inner: phase1Result.error });
    }
    // 404 → deadline not passed → fall back to previous GW
    preDeadlineFallback = true;
    phase1Gw = currentGw - 1;
    if (phase1Gw < 1) return err({ type: 'pre_season' });

    phase1Result = await fetchPicks(phase1Gw);
    if (!phase1Result.ok) {
      if (phase1Result.error.type === 'not_found') return err({ type: 'pre_season' });
      return err({ type: 'fetch_error', inner: phase1Result.error });
    }
  }

  // ── Phase 2: Free Hit detection ────────────────────────────────────────────
  const fhResolution = resolveFreeHit(phase1Result.value.active_chip, phase1Gw);

  if (fhResolution.freeHitBypassed) {
    const fhFallback = await fetchPicks(fhResolution.gameweek);
    // Graceful degrade: if the FH-prior GW fetch fails, serve the FH picks unchanged.
    const finalPicks = fhFallback.ok ? fhFallback.value.picks : phase1Result.value.picks;
    return ok({
      picks: finalPicks,
      gameweek: fhResolution.gameweek,
      preDeadlineFallback,
      freeHitBypassed: true,
      freeHitGameweek: fhResolution.freeHitGameweek,
      isGw1FreeHit: false,
    });
  }

  return ok({
    picks: phase1Result.value.picks,
    gameweek: fhResolution.gameweek,
    preDeadlineFallback,
    freeHitBypassed: false,
    freeHitGameweek: null,
    isGw1FreeHit: fhResolution.isGw1FreeHit,
  });
}
