import { describe, expect, it } from 'vitest';
import type { Fixture, HistoryItem } from '@/lib/fpl/types';
import {
  buildFdrLookup,
  buildNextFdrByTeam,
  elementTypeToPosition,
  FALLBACK_FDR,
  mapMatchEvents,
  mapToMatchEvent,
} from './matchEventMapper';
import type { FdrLookup } from './matchEventMapper';

function aHistoryItem(overrides: Partial<HistoryItem> = {}): HistoryItem {
  return {
    round: 1,
    opponent_team: 10,
    was_home: true,
    minutes: 90,
    goals_scored: 0,
    assists: 0,
    clean_sheets: 0,
    saves: 0,
    defensive_contribution: 0,
    total_points: 0,
    influence: 0,
    creativity: 0,
    threat: 0,
    ...overrides,
  };
}

function aFixture(overrides: Partial<Fixture> = {}): Fixture {
  return {
    id: 1,
    event: 1,
    team_h: 1,
    team_a: 10,
    team_h_difficulty: 3,
    team_a_difficulty: 3,
    finished: true,
    kickoff_time: null,
    ...overrides,
  };
}

const EMPTY_LOOKUP: FdrLookup = new Map();

describe('elementTypeToPosition', () => {
  it.each([
    [1 as const, 'GK'],
    [2 as const, 'DEF'],
    [3 as const, 'MID'],
    [4 as const, 'FWD'],
  ] as const)('maps element_type %d to %s', (type, expected) => {
    expect(elementTypeToPosition(type)).toBe(expected);
  });
});

describe('buildFdrLookup', () => {
  it('returns an empty map when fixtures list is empty', () => {
    expect(buildFdrLookup([])).toEqual(new Map());
  });

  it('skips fixtures with event=null', () => {
    const lookup = buildFdrLookup([aFixture({ event: null })]);
    expect(lookup.size).toBe(0);
  });

  it('includes fixtures with a scheduled event', () => {
    const lookup = buildFdrLookup([aFixture({ event: 5, team_h: 1, team_a: 2 })]);
    expect(lookup.size).toBe(1);
  });

  it('stores homeFdr from team_h_difficulty', () => {
    const lookup = buildFdrLookup([
      aFixture({ event: 1, team_h: 1, team_a: 2, team_h_difficulty: 4, team_a_difficulty: 2 }),
    ]);
    expect(lookup.get('1:1:2')?.homeFdr).toBe(4);
  });

  it('stores awayFdr from team_a_difficulty', () => {
    const lookup = buildFdrLookup([
      aFixture({ event: 1, team_h: 1, team_a: 2, team_h_difficulty: 4, team_a_difficulty: 2 }),
    ]);
    expect(lookup.get('1:1:2')?.awayFdr).toBe(2);
  });

  it('stores multiple fixtures without collision', () => {
    const lookup = buildFdrLookup([
      aFixture({ event: 1, team_h: 1, team_a: 2 }),
      aFixture({ event: 1, team_h: 3, team_a: 4 }),
    ]);
    expect(lookup.size).toBe(2);
  });
});

describe('mapToMatchEvent', () => {
  it('maps round to gameweek', () => {
    const lookup = buildFdrLookup([aFixture({ event: 17, team_h: 1, team_a: 10 })]);
    const event = mapToMatchEvent(aHistoryItem({ round: 17 }), 1, lookup);
    expect(event.gameweek).toBe(17);
  });

  it('maps opponent_team to opponentTeamId', () => {
    const event = mapToMatchEvent(aHistoryItem({ opponent_team: 5 }), 1, EMPTY_LOOKUP);
    expect(event.opponentTeamId).toBe(5);
  });

  it('maps minutes to minutesPlayed', () => {
    const event = mapToMatchEvent(aHistoryItem({ minutes: 73 }), 1, EMPTY_LOOKUP);
    expect(event.minutesPlayed).toBe(73);
  });

  it('maps goals_scored to goals', () => {
    const event = mapToMatchEvent(aHistoryItem({ goals_scored: 2 }), 1, EMPTY_LOOKUP);
    expect(event.goals).toBe(2);
  });

  it('maps assists', () => {
    const event = mapToMatchEvent(aHistoryItem({ assists: 1 }), 1, EMPTY_LOOKUP);
    expect(event.assists).toBe(1);
  });

  it('maps clean_sheets=1 to cleanSheet=true', () => {
    const event = mapToMatchEvent(aHistoryItem({ clean_sheets: 1 }), 1, EMPTY_LOOKUP);
    expect(event.cleanSheet).toBe(true);
  });

  it('maps clean_sheets=0 to cleanSheet=false', () => {
    const event = mapToMatchEvent(aHistoryItem({ clean_sheets: 0 }), 1, EMPTY_LOOKUP);
    expect(event.cleanSheet).toBe(false);
  });

  it('maps defensive_contribution to defensiveContribution', () => {
    const event = mapToMatchEvent(aHistoryItem({ defensive_contribution: 14 }), 1, EMPTY_LOOKUP);
    expect(event.defensiveContribution).toBe(14);
  });

  it('home player uses team_h_difficulty for opponentFdr', () => {
    // Player team 1 plays at home (team_h=1) vs opponent 10 (team_a=10).
    // team_h_difficulty=4 is how hard it is for team 1 playing at home.
    const lookup = buildFdrLookup([
      aFixture({ event: 1, team_h: 1, team_a: 10, team_h_difficulty: 4, team_a_difficulty: 2 }),
    ]);
    const event = mapToMatchEvent(
      aHistoryItem({ round: 1, opponent_team: 10, was_home: true }),
      1,
      lookup,
    );
    expect(event.opponentFdr).toBe(4);
  });

  it('away player uses team_a_difficulty for opponentFdr', () => {
    // Player team 10 plays away (team_a=10) at opponent 1's ground (team_h=1).
    // team_a_difficulty=5 is how hard it is for team 10 playing away.
    const lookup = buildFdrLookup([
      aFixture({ event: 1, team_h: 1, team_a: 10, team_h_difficulty: 2, team_a_difficulty: 5 }),
    ]);
    const event = mapToMatchEvent(
      aHistoryItem({ round: 1, opponent_team: 1, was_home: false }),
      10,
      lookup,
    );
    expect(event.opponentFdr).toBe(5);
  });

  it('falls back to FDR 3 when fixture is not found in the lookup', () => {
    const event = mapToMatchEvent(aHistoryItem({ round: 99, opponent_team: 77 }), 1, EMPTY_LOOKUP);
    expect(event.opponentFdr).toBe(3);
  });

  it('single-player DGW: two matches against different opponents in the same round get distinct FDRs', () => {
    // Player team 1 has a DGW in round 33:
    //   match a: at home vs Chelsea (5)  — team_h_difficulty = 3 (Arsenal's home FDR)
    //   match b: away at Spurs (12)      — team_a_difficulty = 4 (Arsenal's away FDR at Spurs)
    const lookup = buildFdrLookup([
      aFixture({
        id: 10,
        event: 33,
        team_h: 1,
        team_a: 5,
        team_h_difficulty: 3,
        team_a_difficulty: 4,
      }),
      aFixture({
        id: 11,
        event: 33,
        team_h: 12,
        team_a: 1,
        team_h_difficulty: 2,
        team_a_difficulty: 4,
      }),
    ]);

    const history = [
      aHistoryItem({ round: 33, opponent_team: 5, was_home: true }),
      aHistoryItem({ round: 33, opponent_team: 12, was_home: false }),
    ];

    const result = mapMatchEvents(history, 1, lookup);

    expect(result[0]?.opponentFdr).toBe(3); // home vs Chelsea: team_h_difficulty=3
    expect(result[1]?.opponentFdr).toBe(4); // away at Spurs: team_a_difficulty=4
  });

  it('DGW disambiguation: two home teams face same opponent, each gets their own FDR', () => {
    // GW12: Arsenal (1) hosts Chelsea (5) — Arsenal's home FDR = 3
    //       Spurs (12) hosts Chelsea (5) — Spurs' home FDR = 2
    // Chelsea has a DGW; without playerTeamId the lookup "(round, opponent)" is ambiguous.
    const lookup = buildFdrLookup([
      aFixture({ event: 12, team_h: 1, team_a: 5, team_h_difficulty: 3, team_a_difficulty: 4 }),
      aFixture({ event: 12, team_h: 12, team_a: 5, team_h_difficulty: 2, team_a_difficulty: 3 }),
    ]);

    const arsenalPlayer = mapToMatchEvent(
      aHistoryItem({ round: 12, opponent_team: 5, was_home: true }),
      1,
      lookup,
    );
    const spurPlayer = mapToMatchEvent(
      aHistoryItem({ round: 12, opponent_team: 5, was_home: true }),
      12,
      lookup,
    );

    expect(arsenalPlayer.opponentFdr).toBe(3);
    expect(spurPlayer.opponentFdr).toBe(2);
  });
});

describe('mapMatchEvents', () => {
  it('filters out history items where minutes=0', () => {
    const history = [
      aHistoryItem({ minutes: 90 }),
      aHistoryItem({ minutes: 0 }),
      aHistoryItem({ minutes: 45 }),
    ];

    expect(mapMatchEvents(history, 1, EMPTY_LOOKUP)).toHaveLength(2);
  });

  it('returns an empty array when all items have minutes=0', () => {
    const history = [aHistoryItem({ minutes: 0 }), aHistoryItem({ minutes: 0 })];

    expect(mapMatchEvents(history, 1, EMPTY_LOOKUP)).toHaveLength(0);
  });

  it('preserves the chronological order of the input', () => {
    const history = [
      aHistoryItem({ round: 3, minutes: 90 }),
      aHistoryItem({ round: 1, minutes: 90 }),
      aHistoryItem({ round: 2, minutes: 90 }),
    ];

    const result = mapMatchEvents(history, 1, EMPTY_LOOKUP);

    expect(result.map((e) => e.gameweek)).toEqual([3, 1, 2]);
  });
});

// ── buildNextFdrByTeam ────────────────────────────────────────────────────────

describe('buildNextFdrByTeam', () => {
  it('returns the home team difficulty for the home team', () => {
    const fixture = aFixture({
      event: 21,
      team_h: 1,
      team_a: 2,
      team_h_difficulty: 2,
      team_a_difficulty: 4,
    });
    const result = buildNextFdrByTeam([fixture], 20);
    expect(result.get(1)).toBe(2);
  });

  it('returns the away team difficulty for the away team', () => {
    const fixture = aFixture({
      event: 21,
      team_h: 1,
      team_a: 2,
      team_h_difficulty: 2,
      team_a_difficulty: 4,
    });
    const result = buildNextFdrByTeam([fixture], 20);
    expect(result.get(2)).toBe(4);
  });

  it('returns the earliest upcoming fixture for each team', () => {
    const fixtures = [
      aFixture({ event: 22, team_h: 1, team_a: 3, team_h_difficulty: 5, team_a_difficulty: 1 }),
      aFixture({ event: 21, team_h: 1, team_a: 2, team_h_difficulty: 2, team_a_difficulty: 4 }),
    ];
    const result = buildNextFdrByTeam(fixtures, 20);
    // Team 1 next fixture is event 21 (not 22)
    expect(result.get(1)).toBe(2);
  });

  it('excludes fixtures from the current or past gameweeks', () => {
    const fixtures = [
      aFixture({ event: 20, team_h: 1, team_a: 2, team_h_difficulty: 2, team_a_difficulty: 4 }),
    ];
    const result = buildNextFdrByTeam(fixtures, 20);
    expect(result.has(1)).toBe(false);
  });

  it('excludes unscheduled fixtures (event=null)', () => {
    const fixture = aFixture({
      event: null,
      team_h: 1,
      team_a: 2,
      team_h_difficulty: 2,
      team_a_difficulty: 4,
    });
    const result = buildNextFdrByTeam([fixture], 20);
    expect(result.has(1)).toBe(false);
  });

  it('returns an empty map when no upcoming fixtures exist', () => {
    const result = buildNextFdrByTeam([], 20);
    expect(result.size).toBe(0);
  });

  it('FALLBACK_FDR is 3', () => {
    expect(FALLBACK_FDR).toBe(3);
  });
});
