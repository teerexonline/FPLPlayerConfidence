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
