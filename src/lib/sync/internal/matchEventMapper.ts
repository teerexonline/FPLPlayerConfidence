import type { MatchEvent, Position } from '@/lib/confidence/types';
import type { Fixtures, HistoryItem } from '@/lib/fpl/types';

const ELEMENT_TYPE_TO_POSITION: Record<1 | 2 | 3 | 4, Position> = {
  1: 'GK',
  2: 'DEF',
  3: 'MID',
  4: 'FWD',
};

/** Maps the FPL element_type integer to a typed Position. */
export function elementTypeToPosition(elementType: 1 | 2 | 3 | 4): Position {
  return ELEMENT_TYPE_TO_POSITION[elementType];
}

function fixtureKey(event: number, teamH: number, teamA: number): string {
  return `${event.toString()}:${teamH.toString()}:${teamA.toString()}`;
}

export type FdrLookup = ReadonlyMap<string, { readonly homeFdr: number; readonly awayFdr: number }>;

/**
 * Builds an FDR lookup from the full fixtures list.
 *
 * Key: "${event}:${team_h}:${team_a}" — uniquely identifies a scheduled fixture.
 * A DGW where the same opponent plays different teams in the same round produces
 * two distinct keys (different team_h/team_a pairs), preventing false collisions.
 * Unscheduled fixtures (event=null) are excluded.
 */
export function buildFdrLookup(fixtures: Fixtures): FdrLookup {
  const map = new Map<string, { readonly homeFdr: number; readonly awayFdr: number }>();
  for (const fixture of fixtures) {
    if (fixture.event === null) continue;
    map.set(fixtureKey(fixture.event, fixture.team_h, fixture.team_a), {
      homeFdr: fixture.team_h_difficulty,
      awayFdr: fixture.team_a_difficulty,
    });
  }
  return map;
}

const FALLBACK_FDR = 3;

function lookupFdr(item: HistoryItem, playerTeamId: number, fdrLookup: FdrLookup): number {
  // Home player: their team is team_h; away player: their team is team_a.
  const key = item.was_home
    ? fixtureKey(item.round, playerTeamId, item.opponent_team)
    : fixtureKey(item.round, item.opponent_team, playerTeamId);
  const entry = fdrLookup.get(key);
  if (entry === undefined) return FALLBACK_FDR;
  return item.was_home ? entry.homeFdr : entry.awayFdr;
}

/** Maps a single HistoryItem to a MatchEvent. Caller ensures minutes > 0. */
export function mapToMatchEvent(
  item: HistoryItem,
  playerTeamId: number,
  fdrLookup: FdrLookup,
): MatchEvent {
  return {
    gameweek: item.round,
    opponentTeamId: item.opponent_team,
    opponentFdr: lookupFdr(item, playerTeamId, fdrLookup),
    minutesPlayed: item.minutes,
    goals: item.goals_scored,
    assists: item.assists,
    cleanSheet: item.clean_sheets === 1,
    saves: item.saves,
    defensiveContribution: item.defensive_contribution,
  };
}

/**
 * Converts a player's full match history to MatchEvents for the confidence calculator.
 * Filters to appearances only (minutes > 0). Preserves original chronological order.
 */
export function mapMatchEvents(
  history: readonly HistoryItem[],
  playerTeamId: number,
  fdrLookup: FdrLookup,
): readonly MatchEvent[] {
  return history
    .filter((item) => item.minutes > 0)
    .map((item) => mapToMatchEvent(item, playerTeamId, fdrLookup));
}
