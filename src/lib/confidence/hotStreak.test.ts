import { describe, expect, it } from 'vitest';
import {
  buildMatchBriefs,
  computeHotStreak,
  computeHotStreakAtMatch,
  hotStreakAtGw,
} from './hotStreak';
import type { HotStreakIntensity, MatchBrief } from './hotStreak';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Build a brief without GW context (tests that don't need boostGw). */
function brief(matchOrder: number, delta: number, eventMagnitude?: number): MatchBrief {
  return {
    matchOrder,
    delta,
    rawDelta: delta,
    eventMagnitude: eventMagnitude ?? delta,
    gameweek: null,
  };
}

/** Build a brief with GW context. */
function briefGw(
  matchOrder: number,
  delta: number,
  gameweek: number,
  eventMagnitude?: number,
): MatchBrief {
  return { matchOrder, delta, rawDelta: delta, eventMagnitude: eventMagnitude ?? delta, gameweek };
}

// ── hotStreakAtGw ────────────────────────────────────────────────────────────

describe('hotStreakAtGw', () => {
  it('GW10 view: boost at GW8 with delta +3 shows mild (2 GWs after boost)', () => {
    expect(hotStreakAtGw(8, 10, 3)?.level).toBe('mild');
  });

  it('GW10 view: boost at GW15 — boost has not happened yet, returns null', () => {
    expect(hotStreakAtGw(15, 10, 5)).toBeNull();
  });

  it('GW10 view: boost at GW5 — streak window expired, returns null', () => {
    expect(hotStreakAtGw(5, 10, 5)).toBeNull();
  });

  it('GW10 view: boost at GW10 with delta +5 shows hot (same GW as boost)', () => {
    const result = hotStreakAtGw(10, 10, 5);
    expect(result?.level).toBe('hot');
    expect(result?.matchesSinceBoost).toBe(0);
  });

  it('GW10 view: boost at GW9 with delta +4 shows warm (1 GW after boost)', () => {
    const result = hotStreakAtGw(9, 10, 4);
    expect(result?.level).toBe('warm');
    expect(result?.matchesSinceBoost).toBe(1);
  });

  it('returns boostGw from the first argument', () => {
    const result = hotStreakAtGw(33, 33, 5);
    expect(result?.boostGw).toBe(33);
  });

  it('returns boostDelta from the third argument', () => {
    expect(hotStreakAtGw(10, 10, 4)?.boostDelta).toBe(4);
  });

  // ── Magnitude-based color (same GW window, different deltas) ──────────────

  it('delta +5 → hot regardless of which match in window it is viewed at', () => {
    expect(hotStreakAtGw(33, 33, 5)?.level).toBe('hot'); // match 0
    expect(hotStreakAtGw(33, 34, 5)?.level).toBe('hot'); // match 1
    expect(hotStreakAtGw(33, 35, 5)?.level).toBe('hot'); // match 2
  });

  it('delta +4 → warm across all 3 streak matches', () => {
    expect(hotStreakAtGw(33, 33, 4)?.level).toBe('warm');
    expect(hotStreakAtGw(33, 34, 4)?.level).toBe('warm');
    expect(hotStreakAtGw(33, 35, 4)?.level).toBe('warm');
  });

  it('delta +3 → mild across all 3 streak matches', () => {
    expect(hotStreakAtGw(33, 33, 3)?.level).toBe('mild');
    expect(hotStreakAtGw(33, 34, 3)?.level).toBe('mild');
    expect(hotStreakAtGw(33, 35, 3)?.level).toBe('mild');
  });

  it('delta +5, GW36 view (3 GWs after GW33 boost) — window expired, null', () => {
    expect(hotStreakAtGw(33, 36, 5)).toBeNull();
  });

  it('intensity is high when atGw === boostGw (matchesSinceBoost=0)', () => {
    expect(hotStreakAtGw(33, 33, 5)?.intensity).toBe('high');
  });

  it('intensity is med when atGw is 1 GW after boostGw', () => {
    expect(hotStreakAtGw(33, 34, 5)?.intensity).toBe('med');
  });

  it('intensity is low when atGw is 2 GWs after boostGw', () => {
    expect(hotStreakAtGw(33, 35, 5)?.intensity).toBe('low');
  });
});

// ── computeHotStreakAtMatch ──────────────────────────────────────────────────

describe('computeHotStreakAtMatch', () => {
  it('returns null when match briefs are empty', () => {
    expect(computeHotStreakAtMatch([], 5)).toBeNull();
  });

  it('returns null when no brief at or before atMatchOrder has delta ≥ 3', () => {
    const briefs = [brief(0, 2), brief(1, -1), brief(2, 1)];
    expect(computeHotStreakAtMatch(briefs, 2)).toBeNull();
  });

  it('boost match (matchesSinceBoost=0) returns correct level from delta', () => {
    expect(computeHotStreakAtMatch([brief(0, 5)], 0)?.level).toBe('hot');
    expect(computeHotStreakAtMatch([brief(0, 4)], 0)?.level).toBe('warm');
    expect(computeHotStreakAtMatch([brief(0, 3)], 0)?.level).toBe('mild');
  });

  it('level is the same 1 match after the boost (matchesSinceBoost=1)', () => {
    const briefs = [brief(0, 5), brief(1, -1)];
    expect(computeHotStreakAtMatch(briefs, 1)?.level).toBe('hot');
  });

  it('level is the same 2 matches after the boost (matchesSinceBoost=2)', () => {
    const briefs = [brief(0, 4), brief(2, 1)];
    expect(computeHotStreakAtMatch(briefs, 2)?.level).toBe('warm');
  });

  it('returns null 3 matches after the boost (streak expired)', () => {
    expect(computeHotStreakAtMatch([brief(0, 3)], 3)).toBeNull();
  });

  it('excludes boosts that occurred after atMatchOrder', () => {
    const briefs = [brief(0, 1), brief(2, 5)];
    expect(computeHotStreakAtMatch(briefs, 1)).toBeNull();
  });

  it('anchors to most-recent prior boost when multiple boosts exist', () => {
    const briefs = [brief(0, 3), brief(1, -1), brief(2, 4), brief(3, 0)];
    // Most recent boost at match 2 (delta +4 → warm), viewed at match 3 → matchesSince=1
    expect(computeHotStreakAtMatch(briefs, 3)?.level).toBe('warm');
  });

  it('DGW scenario: boost in first sub-match burns one step per sub-match', () => {
    const briefs = [brief(0, 1), brief(1, 5), brief(2, -1), brief(3, -1), brief(4, 0)];
    expect(computeHotStreakAtMatch(briefs, 0)).toBeNull();
    expect(computeHotStreakAtMatch(briefs, 1)?.level).toBe('hot');
    expect(computeHotStreakAtMatch(briefs, 2)?.level).toBe('hot'); // same level, not decaying
    expect(computeHotStreakAtMatch(briefs, 3)?.level).toBe('hot');
    expect(computeHotStreakAtMatch(briefs, 4)).toBeNull();
  });

  it('does not mutate the input array', () => {
    const briefs = [brief(0, 3), brief(1, 1)];
    const copy = [...briefs];
    computeHotStreakAtMatch(briefs, 1);
    expect(briefs).toStrictEqual(copy);
  });

  it('handles briefs in arbitrary order', () => {
    const briefs = [brief(2, 1), brief(0, 3)];
    expect(computeHotStreakAtMatch(briefs, 2)?.level).toBe('mild');
  });

  it('correctly handles multiple boosts — each resets the anchor', () => {
    const briefs = [brief(0, 3), brief(1, -1), brief(2, 4), brief(3, -1)];
    expect(computeHotStreakAtMatch(briefs, 0)?.level).toBe('mild'); // delta=3 → mild
    expect(computeHotStreakAtMatch(briefs, 2)?.level).toBe('warm'); // delta=4 → warm
    expect(computeHotStreakAtMatch(briefs, 3)?.level).toBe('warm'); // still the +4 boost
  });

  it('returns matchesSinceBoost=0 on boost match, 1 one after, 2 two after', () => {
    const briefs = [brief(0, 5), brief(1, -1), brief(2, 0)];
    expect(computeHotStreakAtMatch(briefs, 0)?.matchesSinceBoost).toBe(0);
    expect(computeHotStreakAtMatch(briefs, 1)?.matchesSinceBoost).toBe(1);
    expect(computeHotStreakAtMatch(briefs, 2)?.matchesSinceBoost).toBe(2);
  });

  it('intensity is high/med/low for matchesSinceBoost 0/1/2', () => {
    const expected: HotStreakIntensity[] = ['high', 'med', 'low'];
    const briefs = [brief(0, 5), brief(1, -1), brief(2, 0)];
    for (let i = 0; i < 3; i++) {
      expect(computeHotStreakAtMatch(briefs, i)?.intensity).toBe(expected[i]);
    }
  });

  it('boostGw is null when briefs carry no gameweek', () => {
    expect(computeHotStreakAtMatch([brief(0, 5)], 0)?.boostGw).toBeNull();
  });

  it('boostGw reflects the brief gameweek when provided', () => {
    const briefs = [briefGw(0, 5, 33), briefGw(1, -1, 34)];
    expect(computeHotStreakAtMatch(briefs, 1)?.boostGw).toBe(33);
  });

  // ── New magnitude tests ───────────────────────────────────────────────────

  it('delta +5 boost → hot (red) at all 3 streak positions', () => {
    const briefs = [brief(0, 5), brief(1, 0), brief(2, 0)];
    expect(computeHotStreakAtMatch(briefs, 0)?.level).toBe('hot');
    expect(computeHotStreakAtMatch(briefs, 1)?.level).toBe('hot');
    expect(computeHotStreakAtMatch(briefs, 2)?.level).toBe('hot');
  });

  it('delta +4 boost → warm (orange) at all 3 streak positions', () => {
    const briefs = [brief(0, 4), brief(1, 0), brief(2, 0)];
    expect(computeHotStreakAtMatch(briefs, 0)?.level).toBe('warm');
    expect(computeHotStreakAtMatch(briefs, 1)?.level).toBe('warm');
    expect(computeHotStreakAtMatch(briefs, 2)?.level).toBe('warm');
  });

  it('delta +3 boost → mild (slate) at all 3 streak positions', () => {
    const briefs = [brief(0, 3), brief(1, 0), brief(2, 0)];
    expect(computeHotStreakAtMatch(briefs, 0)?.level).toBe('mild');
    expect(computeHotStreakAtMatch(briefs, 1)?.level).toBe('mild');
    expect(computeHotStreakAtMatch(briefs, 2)?.level).toBe('mild');
  });

  it('delta +5 boost GW33: viewed at GW33, 34, 35 all return hot; GW36 returns null', () => {
    const briefs = [briefGw(0, 5, 33), briefGw(1, -1, 34), briefGw(2, 0, 35), briefGw(3, 1, 36)];
    expect(computeHotStreakAtMatch(briefs, 0)?.level).toBe('hot');
    expect(computeHotStreakAtMatch(briefs, 1)?.level).toBe('hot');
    expect(computeHotStreakAtMatch(briefs, 2)?.level).toBe('hot');
    expect(computeHotStreakAtMatch(briefs, 3)).toBeNull();
  });
});

// ── computeHotStreak ────────────────────────────────────────────────────────

describe('computeHotStreak', () => {
  it('returns null when match briefs are empty', () => {
    expect(computeHotStreak([])).toBeNull();
  });

  it('returns null when no brief has delta ≥ 3', () => {
    const briefs = [brief(0, 2), brief(1, -1), brief(2, 1)];
    expect(computeHotStreak(briefs)).toBeNull();
  });

  it('returns null when the most recent boost was 3+ matches ago', () => {
    const briefs = [brief(0, 3), brief(1, 1), brief(2, 0), brief(3, 2)];
    expect(computeHotStreak(briefs)).toBeNull();
  });

  it('returns hot when delta +5 boost is the latest match', () => {
    const briefs = [brief(0, 1), brief(1, 5)];
    expect(computeHotStreak(briefs)?.level).toBe('hot');
  });

  it('returns warm when delta +4 boost is 1 match ago', () => {
    const briefs = [brief(0, 1), brief(1, 4), brief(2, -1)];
    expect(computeHotStreak(briefs)?.level).toBe('warm');
  });

  it('returns mild when delta +3 boost is 2 matches ago', () => {
    const briefs = [brief(0, 3), brief(1, 1), brief(2, -1)];
    expect(computeHotStreak(briefs)?.level).toBe('mild');
  });

  it('returns null when boost was 3 matches ago (streak expired)', () => {
    const briefs = [brief(0, 5), brief(1, 0), brief(2, 1), brief(3, 2)];
    expect(computeHotStreak(briefs)).toBeNull();
  });

  it('uses the most recent qualifying boost when multiple boosts exist', () => {
    const briefs = [brief(0, 3), brief(1, 1), brief(2, 4), brief(3, -1), brief(4, 2)];
    // Most recent boost at match 2 (delta=4→warm), now 2 matches ago
    expect(computeHotStreak(briefs)?.level).toBe('warm');
  });

  it('resets the timer when a new boost occurs during an existing streak', () => {
    const briefs = [brief(0, 3), brief(1, 1), brief(2, 3), brief(3, -1)];
    // Most recent boost at match 2 (delta=3→mild), 1 match ago
    expect(computeHotStreak(briefs)?.level).toBe('mild');
  });

  it('handles briefs arriving in arbitrary order', () => {
    // At maxOrder=3: most recent boost is matchOrder=2 (delta=4), matchesSinceBoost=1 → warm
    const briefs = [brief(3, -1), brief(0, 3), brief(2, 4), brief(1, 1)];
    expect(computeHotStreak(briefs)?.level).toBe('warm');
  });

  it('treats delta exactly equal to 3 as a valid boost (→ mild)', () => {
    expect(computeHotStreak([brief(0, 3)])?.level).toBe('mild');
  });

  it('treats delta of 2 as not a boost', () => {
    expect(computeHotStreak([brief(0, 2)])).toBeNull();
  });

  it('handles a single-match history with no boost', () => {
    expect(computeHotStreak([brief(0, 0)])).toBeNull();
  });

  it('handles a single-match history that is a boost', () => {
    expect(computeHotStreak([brief(0, 6)])?.level).toBe('hot');
  });

  it('does not mutate the input array', () => {
    const briefs = [brief(0, 1), brief(1, 3)];
    const copy = [...briefs];
    computeHotStreak(briefs);
    expect(briefs).toStrictEqual(copy);
  });

  it('DGW: boost in sub-match A means live indicator shows correct level at sub-match B', () => {
    const briefs = [brief(0, 1), brief(1, 5), brief(2, -1)];
    expect(computeHotStreak(briefs)?.level).toBe('hot');
  });

  // ── Magnitude-based color consistency ────────────────────────────────────

  it('delta +5 boost 2 matches ago → hot (color does not decay)', () => {
    const briefs = [brief(0, 5), brief(1, -1), brief(2, 0)];
    expect(computeHotStreak(briefs)?.level).toBe('hot');
  });

  it('delta +4 boost 2 matches ago → warm (color does not decay)', () => {
    const briefs = [brief(0, 4), brief(1, -1), brief(2, 0)];
    expect(computeHotStreak(briefs)?.level).toBe('warm');
  });

  it('delta +3 boost 2 matches ago → mild (color does not decay)', () => {
    const briefs = [brief(0, 3), brief(1, -1), brief(2, 0)];
    expect(computeHotStreak(briefs)?.level).toBe('mild');
  });
});

// ── buildMatchBriefs ─────────────────────────────────────────────────────────

describe('buildMatchBriefs', () => {
  it('single non-DGW snapshot produces one brief with the snapshot delta', () => {
    const result = buildMatchBriefs([
      { delta: 2, rawDelta: 2, eventMagnitude: 2, reason: 'Blank vs FDR 3 opponent' },
    ]);
    expect(result).toEqual([
      { matchOrder: 0, delta: 2, rawDelta: 2, eventMagnitude: 2, gameweek: null },
    ]);
  });

  it('passes through gameweek when provided', () => {
    const result = buildMatchBriefs([
      { delta: 3, rawDelta: 3, eventMagnitude: 3, reason: 'MOTM vs FDR 5 opponent', gameweek: 33 },
    ]);
    expect(result[0]).toMatchObject({ gameweek: 33 });
  });

  it('gameweek is null when not provided', () => {
    const result = buildMatchBriefs([
      { delta: 3, rawDelta: 3, eventMagnitude: 3, reason: 'MOTM vs FDR 5 opponent' },
    ]);
    expect(result[0]?.gameweek).toBeNull();
  });

  it('multiple non-DGW snapshots produce consecutive matchOrders', () => {
    const result = buildMatchBriefs([
      { delta: 1, rawDelta: 1, eventMagnitude: 1, reason: 'Performance vs FDR 3 opponent' },
      { delta: 3, rawDelta: 3, eventMagnitude: 3, reason: 'MOTM vs FDR 5 opponent' },
      { delta: -1, rawDelta: -1, eventMagnitude: -1, reason: 'Blank vs FDR 3 opponent' },
    ]);
    expect(result).toEqual([
      { matchOrder: 0, delta: 1, rawDelta: 1, eventMagnitude: 1, gameweek: null },
      { matchOrder: 1, delta: 3, rawDelta: 3, eventMagnitude: 3, gameweek: null },
      { matchOrder: 2, delta: -1, rawDelta: -1, eventMagnitude: -1, gameweek: null },
    ]);
  });

  it('DGW snapshot expands into two consecutive briefs with per-sub-match deltas', () => {
    // Top sub-match (+3) gets the stored eventMagnitude=3; bottom sub-match gets Math.max(0,-1)=0.
    const reason = 'DGW: MOTM vs FDR 5 opponent (+3) + Blank vs FDR 3 opponent (-1)';
    const result = buildMatchBriefs([{ delta: 2, rawDelta: 2, eventMagnitude: 3, reason }]);
    expect(result).toEqual([
      { matchOrder: 0, delta: 3, rawDelta: 3, eventMagnitude: 3, gameweek: null },
      { matchOrder: 1, delta: -1, rawDelta: -1, eventMagnitude: 0, gameweek: null },
    ]);
  });

  it('DGW snapshot both sub-matches share the parent snapshot gameweek', () => {
    const reason = 'DGW: MOTM vs FDR 5 opponent (+3) + Blank vs FDR 3 opponent (-1)';
    const result = buildMatchBriefs([
      { delta: 2, rawDelta: 2, eventMagnitude: 3, reason, gameweek: 33 },
    ]);
    expect(result[0]?.gameweek).toBe(33);
    expect(result[1]?.gameweek).toBe(33);
  });

  it('DGW boost in sub-match B (most recent) → computeHotStreak returns hot', () => {
    // eventMagnitude=5 (best moment); sub-match B has higher delta (+5 > +1) so it gets it.
    const reason = 'DGW: Blank vs FDR 3 opponent (+1) + MOTM vs FDR 5 opponent (+5)';
    const result = computeHotStreak(
      buildMatchBriefs([{ delta: 6, rawDelta: 6, eventMagnitude: 5, reason }]),
    );
    expect(result?.level).toBe('hot');
  });

  it('DGW combined delta < 3 but sub-match A delta ≥ 3 → boost detected via per-sub-match parsing', () => {
    // Sub-match A has delta=3, so it gets eventMagnitude=3 (the stored max); sub-match B gets 0.
    const reason = 'DGW: MOTM vs FDR 5 opponent (+3) + Blank vs FDR 3 opponent (-1)';
    const briefs = buildMatchBriefs([{ delta: 2, rawDelta: 2, eventMagnitude: 3, reason }]);
    expect(briefs[0]).toMatchObject({ delta: 3, eventMagnitude: 3 });
    expect(briefs[1]).toMatchObject({ delta: -1, eventMagnitude: 0 });
    // Sub-match B is latest → matchesSinceBoost=1 from the boost at sub-match A
    expect(computeHotStreak(briefs)?.level).toBe('mild'); // eventMagnitude=3 → mild
  });

  it('mixed sequence: non-DGW then DGW assigns matchOrders correctly', () => {
    const result = buildMatchBriefs([
      { delta: 1, rawDelta: 1, eventMagnitude: 1, reason: 'Performance vs FDR 3 opponent' },
      {
        delta: 2,
        rawDelta: 2,
        eventMagnitude: 3,
        reason: 'DGW: Performance vs FDR 4 opponent (+3) + Blank vs FDR 2 opponent (-1)',
      },
    ]);
    expect(result).toEqual([
      { matchOrder: 0, delta: 1, rawDelta: 1, eventMagnitude: 1, gameweek: null },
      { matchOrder: 1, delta: 3, rawDelta: 3, eventMagnitude: 3, gameweek: null },
      { matchOrder: 2, delta: -1, rawDelta: -1, eventMagnitude: 0, gameweek: null },
    ]);
  });

  it('returns empty array for empty input', () => {
    expect(buildMatchBriefs([])).toEqual([]);
  });

  it('DGW reason with fatigue-modified sub-match parses correctly', () => {
    const reason =
      'DGW: Performance vs FDR 3 opponent + Fatigue (+2) + Blank vs FDR 2 opponent (-1)';
    const briefs = buildMatchBriefs([{ delta: 1, rawDelta: 1, eventMagnitude: 2, reason }]);
    expect(briefs).toHaveLength(2);
    expect(briefs[0]).toMatchObject({ matchOrder: 0, delta: 2, eventMagnitude: 2 });
    expect(briefs[1]).toMatchObject({ matchOrder: 1, delta: -1, eventMagnitude: 0 });
  });

  it('non-DGW snapshot: eventMagnitude flows through directly from input', () => {
    // eventMagnitude=5 (pre-clamp raw) while rawDelta=4 (ceiling absorbed 1 point).
    const result = buildMatchBriefs([
      { delta: 2, rawDelta: 4, eventMagnitude: 5, reason: 'MOTM vs BIG opponent + Fatigue −2' },
    ]);
    expect(result[0]).toMatchObject({ delta: 2, rawDelta: 4, eventMagnitude: 5 });
  });

  it('streak triggers on eventMagnitude ≥ 3 even when post-fatigue delta < 3', () => {
    // eventMagnitude=4 triggers warm streak even though post-fatigue delta=2 would not.
    const briefs = buildMatchBriefs([
      { delta: 2, rawDelta: 4, eventMagnitude: 4, reason: 'MOTM vs FDR 5 opponent + Fatigue −2' },
    ]);
    expect(computeHotStreak(briefs)?.level).toBe('warm'); // eventMagnitude=4 → warm
  });

  it('ceiling absorption: eventMagnitude=5 gives hot even when rawDelta=4', () => {
    // Player at conf=1 before a BIG MOTM: raw=5 but clamp(1+5)=5 gives rawDelta=4.
    // eventMagnitude=5 ensures the correct hot flame is shown.
    const briefs = buildMatchBriefs([
      { delta: 4, rawDelta: 4, eventMagnitude: 5, reason: 'MOTM vs BIG opponent' },
    ]);
    expect(computeHotStreak(briefs)?.level).toBe('hot'); // eventMagnitude=5 → hot
    expect(computeHotStreak(briefs)?.boostDelta).toBe(5);
  });
});
