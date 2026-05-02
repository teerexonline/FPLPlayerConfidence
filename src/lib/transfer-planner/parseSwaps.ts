/**
 * Parses the `?swap=outId:inId,outId2:inId2,…` query parameter used by the
 * transfer planner on the My Team page. Pure function; no I/O.
 *
 * The planner stages transfers in URL state so the URL is shareable and the
 * back/forward buttons feel right. The route handler runs this parser, then
 * applies the validated swaps over the user's *current* squad before computing
 * projected xP for the viewed gameweek.
 */

export interface Swap {
  readonly outId: number;
  readonly inId: number;
}

export type ParseSwapsResult =
  | { readonly ok: true; readonly value: readonly Swap[] }
  | { readonly ok: false; readonly error: string };

/** Hard upper bound on staged swaps. Matches FPL's typical multi-transfer chip cap. */
export const MAX_SWAPS = 5;

const PAIR = /^(\d+):(\d+)$/;

export function parseSwaps(raw: string | null): ParseSwapsResult {
  if (raw === null || raw.length === 0) {
    return { ok: true, value: [] };
  }

  const pairs = raw.split(',');
  if (pairs.length > MAX_SWAPS) {
    return { ok: false, error: `Too many swaps (max ${MAX_SWAPS.toString()}).` };
  }

  const swaps: Swap[] = [];
  const seenOut = new Set<number>();
  const seenIn = new Set<number>();

  for (const pair of pairs) {
    const match = PAIR.exec(pair);
    if (!match) {
      return { ok: false, error: `Malformed swap: "${pair}"` };
    }
    const outId = parseInt(match[1] ?? '', 10);
    const inId = parseInt(match[2] ?? '', 10);
    if (outId <= 0 || inId <= 0) {
      return { ok: false, error: `Player IDs must be positive: "${pair}"` };
    }
    if (outId === inId) {
      return { ok: false, error: `Cannot swap a player with themselves: "${pair}"` };
    }
    if (seenOut.has(outId)) {
      return { ok: false, error: `Player ${outId.toString()} swapped out twice` };
    }
    if (seenIn.has(inId)) {
      return { ok: false, error: `Player ${inId.toString()} swapped in twice` };
    }
    seenOut.add(outId);
    seenIn.add(inId);
    swaps.push({ outId, inId });
  }

  return { ok: true, value: swaps };
}
