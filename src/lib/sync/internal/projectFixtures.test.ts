import { describe, expect, it } from 'vitest';
import type { Fixtures } from '@/lib/fpl/types';
import { aggregatePlayerFdrAverages, projectFixturesToTeamRows } from './projectFixtures';
import type { FdrLookup } from './matchEventMapper';

const fixturesFor = (overrides: Partial<Fixtures[number]>[]): Fixtures =>
  overrides.map((o, i) => ({
    id: i + 1,
    event: 36,
    team_h: 1,
    team_a: 2,
    team_h_difficulty: 3,
    team_a_difficulty: 3,
    finished: false,
    kickoff_time: '2026-05-10T14:00:00Z',
    ...o,
  }));

describe('projectFixturesToTeamRows', () => {
  it('emits two rows per fixture — one for each team', () => {
    const fixtures = fixturesFor([
      { id: 100, event: 36, team_h: 1, team_a: 2, team_h_difficulty: 2, team_a_difficulty: 4 },
    ]);
    const rows = projectFixturesToTeamRows(fixtures);
    expect(rows).toHaveLength(2);

    const home = rows.find((r) => r.team_id === 1);
    const away = rows.find((r) => r.team_id === 2);
    expect(home).toMatchObject({
      fixture_id: 100,
      team_id: 1,
      opponent_team_id: 2,
      is_home: true,
      fdr: 2,
      gameweek: 36,
    });
    expect(away).toMatchObject({
      fixture_id: 100,
      team_id: 2,
      opponent_team_id: 1,
      is_home: false,
      fdr: 4,
      gameweek: 36,
    });
  });

  it('skips fixtures with null event (unscheduled)', () => {
    const rows = projectFixturesToTeamRows(
      fixturesFor([
        { id: 1, event: null },
        { id: 2, event: 36 },
      ]),
    );
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.gameweek === 36)).toBe(true);
  });

  it('preserves finished + kickoff_time', () => {
    const rows = projectFixturesToTeamRows(
      fixturesFor([{ id: 1, finished: true, kickoff_time: null }]),
    );
    expect(rows[0]).toMatchObject({ finished: true, kickoff_time: null });
    expect(rows[1]).toMatchObject({ finished: true, kickoff_time: null });
  });

  it('handles a double gameweek by emitting all rows', () => {
    const rows = projectFixturesToTeamRows(
      fixturesFor([
        { id: 100, event: 36, team_h: 1, team_a: 2 },
        { id: 101, event: 36, team_h: 3, team_a: 1 }, // team 1 plays again in GW36
      ]),
    );
    const team1Rows = rows.filter((r) => r.team_id === 1);
    expect(team1Rows).toHaveLength(2);
    expect(team1Rows.map((r) => r.fixture_id).sort()).toEqual([100, 101]);
  });
});

// ── aggregatePlayerFdrAverages ────────────────────────────────────────────────

describe('aggregatePlayerFdrAverages', () => {
  // Build a minimal FDR lookup: for each (event, team_h, team_a) the home/away FDR.
  function lookupOf(
    entries: { event: number; team_h: number; team_a: number; homeFdr: number; awayFdr: number }[],
  ): FdrLookup {
    const m = new Map<string, { readonly homeFdr: number; readonly awayFdr: number }>();
    for (const e of entries) {
      m.set(`${e.event.toString()}:${e.team_h.toString()}:${e.team_a.toString()}`, {
        homeFdr: e.homeFdr,
        awayFdr: e.awayFdr,
      });
    }
    return m;
  }

  it('groups history by FDR bucket and averages total_points', () => {
    const lookup = lookupOf([
      { event: 1, team_h: 5, team_a: 2, homeFdr: 2, awayFdr: 4 }, // home, FDR 2 → LOW
      { event: 2, team_h: 5, team_a: 7, homeFdr: 3, awayFdr: 3 }, // home, FDR 3 → MID
      { event: 3, team_h: 9, team_a: 5, homeFdr: 5, awayFdr: 5 }, // away, FDR 5 → HIGH
    ]);

    const result = aggregatePlayerFdrAverages(
      [
        // Player on team 5
        { round: 1, opponent_team: 2, was_home: true, minutes: 90, total_points: 6 },
        { round: 2, opponent_team: 7, was_home: true, minutes: 90, total_points: 4 },
        { round: 3, opponent_team: 9, was_home: false, minutes: 90, total_points: 2 },
      ],
      5,
      lookup,
    );

    expect(result).toEqual([
      { bucket: 'LOW', avg: 6, count: 1 },
      { bucket: 'MID', avg: 4, count: 1 },
      { bucket: 'HIGH', avg: 2, count: 1 },
    ]);
  });

  it('averages multiple appearances within the same bucket', () => {
    const lookup = lookupOf([
      { event: 1, team_h: 5, team_a: 2, homeFdr: 2, awayFdr: 4 }, // LOW
      { event: 2, team_h: 5, team_a: 7, homeFdr: 1, awayFdr: 5 }, // LOW
      { event: 3, team_h: 5, team_a: 9, homeFdr: 2, awayFdr: 4 }, // LOW
    ]);
    const result = aggregatePlayerFdrAverages(
      [
        { round: 1, opponent_team: 2, was_home: true, minutes: 90, total_points: 8 },
        { round: 2, opponent_team: 7, was_home: true, minutes: 90, total_points: 4 },
        { round: 3, opponent_team: 9, was_home: true, minutes: 90, total_points: 0 },
      ],
      5,
      lookup,
    );
    expect(result).toEqual([{ bucket: 'LOW', avg: 4, count: 3 }]);
  });

  it('skips zero-minute history items (player did not appear)', () => {
    const lookup = lookupOf([
      { event: 1, team_h: 5, team_a: 2, homeFdr: 2, awayFdr: 4 },
      { event: 2, team_h: 5, team_a: 7, homeFdr: 2, awayFdr: 4 },
    ]);
    const result = aggregatePlayerFdrAverages(
      [
        { round: 1, opponent_team: 2, was_home: true, minutes: 0, total_points: 0 },
        { round: 2, opponent_team: 7, was_home: true, minutes: 90, total_points: 6 },
      ],
      5,
      lookup,
    );
    expect(result).toEqual([{ bucket: 'LOW', avg: 6, count: 1 }]);
  });

  it('uses fallback FDR (3 → MID) when fixture is missing from lookup', () => {
    const result = aggregatePlayerFdrAverages(
      [{ round: 99, opponent_team: 7, was_home: true, minutes: 90, total_points: 5 }],
      5,
      lookupOf([]),
    );
    expect(result).toEqual([{ bucket: 'MID', avg: 5, count: 1 }]);
  });

  it('returns empty array when player has no appearances', () => {
    expect(aggregatePlayerFdrAverages([], 5, lookupOf([]))).toEqual([]);
  });

  it('rounds avg_points to 4 decimal places to keep storage stable', () => {
    const lookup = lookupOf([
      { event: 1, team_h: 5, team_a: 2, homeFdr: 2, awayFdr: 4 },
      { event: 2, team_h: 5, team_a: 7, homeFdr: 2, awayFdr: 4 },
      { event: 3, team_h: 5, team_a: 9, homeFdr: 2, awayFdr: 4 },
    ]);
    const result = aggregatePlayerFdrAverages(
      [
        { round: 1, opponent_team: 2, was_home: true, minutes: 90, total_points: 1 },
        { round: 2, opponent_team: 7, was_home: true, minutes: 90, total_points: 0 },
        { round: 3, opponent_team: 9, was_home: true, minutes: 90, total_points: 0 },
      ],
      5,
      lookup,
    );
    // 1/3 = 0.3333…
    expect(result[0]?.avg).toBe(0.3333);
  });
});
