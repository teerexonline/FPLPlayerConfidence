import type { Position } from '@/lib/db/types';
import type { SquadPlayerRow } from './types';

/**
 * Derives the formation string (e.g. "4-3-3") from the 11 starting players.
 * GK is implied; only DEF, MID, and FWD counts are returned.
 */
export function computeFormation(starters: readonly SquadPlayerRow[]): string {
  let def = 0;
  let mid = 0;
  let fwd = 0;
  for (const p of starters) {
    if (p.position === 'DEF') def++;
    else if (p.position === 'MID') mid++;
    else if (p.position === 'FWD') fwd++;
  }
  return `${def.toString()}-${mid.toString()}-${fwd.toString()}`;
}

/**
 * Returns true if the supplied set of 11 starter positions is a legal FPL
 * formation. FPL substitution rules require the resulting starting XI to
 * fit the 1 GK / 3–5 DEF / 2–5 MID / 1–3 FWD constraints; cross-position
 * outfield swaps are allowed as long as those bands hold.
 */
export function isValidFormation(positions: readonly Position[]): boolean {
  if (positions.length !== 11) return false;
  let gk = 0;
  let def = 0;
  let mid = 0;
  let fwd = 0;
  for (const p of positions) {
    if (p === 'GK') gk++;
    else if (p === 'DEF') def++;
    else if (p === 'MID') mid++;
    else fwd++;
  }
  return gk === 1 && def >= 3 && def <= 5 && mid >= 2 && mid <= 5 && fwd >= 1 && fwd <= 3;
}
