import { describe, expect, it } from 'vitest';
import {
  buildMatchBriefs,
  computeHotStreak,
  computeHotStreakAtMatch,
  hotStreakAtGw,
  hotStreakFromGwsSince,
} from './hotStreak';

// ── hotStreakFromGwsSince ────────────────────────────────────────────────────

describe('hotStreakFromGwsSince', () => {
  it('returns red_hot when gwsSince is 0 (boost GW itself)', () => {
    expect(hotStreakFromGwsSince(0)).toBe('red_hot');
  });

  it('returns med_hot when gwsSince is 1 (one step after boost)', () => {
    expect(hotStreakFromGwsSince(1)).toBe('med_hot');
  });

  it('returns low_hot when gwsSince is 2 (two steps after boost)', () => {
    expect(hotStreakFromGwsSince(2)).toBe('low_hot');
  });

  it('returns null when gwsSince is 3 (streak expired)', () => {
    expect(hotStreakFromGwsSince(3)).toBeNull();
  });

  it('returns null when gwsSince is 4', () => {
    expect(hotStreakFromGwsSince(4)).toBeNull();
  });

  it('returns null for large gwsSince values', () => {
    expect(hotStreakFromGwsSince(10)).toBeNull();
    expect(hotStreakFromGwsSince(38)).toBeNull();
  });

  it('returns null for negative gwsSince (no === 0 match)', () => {
    expect(hotStreakFromGwsSince(-1)).toBeNull();
  });
});

// ── hotStreakAtGw ────────────────────────────────────────────────────────────
// These three cases mirror the /my-team scrubber scenarios from the bug report.

describe('hotStreakAtGw', () => {
  it('GW10 view: boost at GW8 shows low_hot (2 GWs after boost)', () => {
    expect(hotStreakAtGw(8, 10)).toBe('low_hot');
  });

  it('GW10 view: boost at GW15 shows no flame — boost has not happened yet', () => {
    expect(hotStreakAtGw(15, 10)).toBeNull();
  });

  it('GW10 view: boost at GW5 shows no flame — streak window expired', () => {
    expect(hotStreakAtGw(5, 10)).toBeNull();
  });

  it('GW10 view: boost at GW10 shows red_hot (same GW as boost)', () => {
    expect(hotStreakAtGw(10, 10)).toBe('red_hot');
  });

  it('GW10 view: boost at GW9 shows med_hot (1 GW after boost)', () => {
    expect(hotStreakAtGw(9, 10)).toBe('med_hot');
  });
});

// ── computeHotStreakAtMatch ──────────────────────────────────────────────────

describe('computeHotStreakAtMatch', () => {
  it('returns null when match briefs are empty', () => {
    expect(computeHotStreakAtMatch([], 5)).toBeNull();
  });

  it('returns null when no brief at or before atMatchOrder has delta ≥ 3', () => {
    const briefs = [
      { matchOrder: 0, delta: 2 },
      { matchOrder: 1, delta: -1 },
      { matchOrder: 2, delta: 1 },
    ];
    expect(computeHotStreakAtMatch(briefs, 2)).toBeNull();
  });

  it('returns red_hot at the boost match itself (matchesSince=0)', () => {
    const briefs = [
      { matchOrder: 0, delta: 3 },
      { matchOrder: 1, delta: 1 },
    ];
    expect(computeHotStreakAtMatch(briefs, 0)).toBe('red_hot');
  });

  it('returns med_hot one match after the boost (matchesSince=1)', () => {
    const briefs = [
      { matchOrder: 0, delta: 3 },
      { matchOrder: 1, delta: -1 },
    ];
    expect(computeHotStreakAtMatch(briefs, 1)).toBe('med_hot');
  });

  it('returns low_hot two matches after the boost (matchesSince=2)', () => {
    const briefs = [
      { matchOrder: 0, delta: 3 },
      { matchOrder: 2, delta: 1 },
    ];
    expect(computeHotStreakAtMatch(briefs, 2)).toBe('low_hot');
  });

  it('returns null three matches after the boost (streak expired)', () => {
    const briefs = [{ matchOrder: 0, delta: 3 }];
    expect(computeHotStreakAtMatch(briefs, 3)).toBeNull();
  });

  it('excludes boosts that occurred after atMatchOrder', () => {
    const briefs = [
      { matchOrder: 0, delta: 1 },
      { matchOrder: 2, delta: 5 },
    ];
    expect(computeHotStreakAtMatch(briefs, 1)).toBeNull();
  });

  it('anchors to most-recent prior boost when multiple boosts exist', () => {
    const briefs = [
      { matchOrder: 0, delta: 3 },
      { matchOrder: 1, delta: -1 },
      { matchOrder: 2, delta: 4 },
      { matchOrder: 3, delta: 0 },
    ];
    expect(computeHotStreakAtMatch(briefs, 3)).toBe('med_hot');
  });

  it('DGW scenario: boost in first sub-match burns one step per sub-match', () => {
    const briefs = [
      { matchOrder: 0, delta: 1 },
      { matchOrder: 1, delta: 3 },
      { matchOrder: 2, delta: -1 },
      { matchOrder: 3, delta: -1 },
      { matchOrder: 4, delta: 0 },
    ];
    expect(computeHotStreakAtMatch(briefs, 0)).toBeNull();
    expect(computeHotStreakAtMatch(briefs, 1)).toBe('red_hot');
    expect(computeHotStreakAtMatch(briefs, 2)).toBe('med_hot');
    expect(computeHotStreakAtMatch(briefs, 3)).toBe('low_hot');
    expect(computeHotStreakAtMatch(briefs, 4)).toBeNull();
  });

  it('does not mutate the input array', () => {
    const briefs = [
      { matchOrder: 0, delta: 3 },
      { matchOrder: 1, delta: 1 },
    ];
    const copy = [...briefs];
    computeHotStreakAtMatch(briefs, 1);
    expect(briefs).toStrictEqual(copy);
  });

  it('handles briefs in arbitrary order', () => {
    const briefs = [
      { matchOrder: 2, delta: 1 },
      { matchOrder: 0, delta: 3 },
    ];
    expect(computeHotStreakAtMatch(briefs, 2)).toBe('low_hot');
  });

  it('correctly handles multiple boosts — each resets the anchor', () => {
    const briefs = [
      { matchOrder: 0, delta: 3 },
      { matchOrder: 1, delta: -1 },
      { matchOrder: 2, delta: 4 },
      { matchOrder: 3, delta: -1 },
    ];
    expect(computeHotStreakAtMatch(briefs, 0)).toBe('red_hot');
    expect(computeHotStreakAtMatch(briefs, 2)).toBe('red_hot');
    expect(computeHotStreakAtMatch(briefs, 3)).toBe('med_hot');
  });
});

// ── computeHotStreak ────────────────────────────────────────────────────────

describe('computeHotStreak', () => {
  it('returns null when match briefs are empty', () => {
    expect(computeHotStreak([])).toBeNull();
  });

  it('returns null when no brief has delta ≥ 3', () => {
    const briefs = [
      { matchOrder: 0, delta: 2 },
      { matchOrder: 1, delta: -1 },
      { matchOrder: 2, delta: 1 },
    ];
    expect(computeHotStreak(briefs)).toBeNull();
  });

  it('returns null when the most recent boost was 3+ matches ago', () => {
    const briefs = [
      { matchOrder: 0, delta: 3 },
      { matchOrder: 1, delta: 1 },
      { matchOrder: 2, delta: 0 },
      { matchOrder: 3, delta: 2 },
    ];
    expect(computeHotStreak(briefs)).toBeNull();
  });

  it('returns red_hot when boost is the latest match (matchesSince=0)', () => {
    const briefs = [
      { matchOrder: 0, delta: 1 },
      { matchOrder: 1, delta: 3 },
    ];
    expect(computeHotStreak(briefs)).toBe('red_hot');
  });

  it('returns med_hot when boost was 1 match ago', () => {
    const briefs = [
      { matchOrder: 0, delta: 1 },
      { matchOrder: 1, delta: 4 },
      { matchOrder: 2, delta: -1 },
    ];
    expect(computeHotStreak(briefs)).toBe('med_hot');
  });

  it('returns low_hot when boost was 2 matches ago', () => {
    const briefs = [
      { matchOrder: 0, delta: 3 },
      { matchOrder: 1, delta: 1 },
      { matchOrder: 2, delta: -1 },
    ];
    expect(computeHotStreak(briefs)).toBe('low_hot');
  });

  it('returns null when boost was 3 matches ago (streak expired)', () => {
    const briefs = [
      { matchOrder: 0, delta: 5 },
      { matchOrder: 1, delta: 0 },
      { matchOrder: 2, delta: 1 },
      { matchOrder: 3, delta: 2 },
    ];
    expect(computeHotStreak(briefs)).toBeNull();
  });

  it('uses the most recent qualifying boost when multiple boosts exist', () => {
    const briefs = [
      { matchOrder: 0, delta: 3 },
      { matchOrder: 1, delta: 1 },
      { matchOrder: 2, delta: 4 },
      { matchOrder: 3, delta: -1 },
      { matchOrder: 4, delta: 2 },
    ];
    expect(computeHotStreak(briefs)).toBe('low_hot');
  });

  it('resets the timer when a new boost occurs during an existing streak', () => {
    const briefs = [
      { matchOrder: 0, delta: 3 },
      { matchOrder: 1, delta: 1 },
      { matchOrder: 2, delta: 3 },
      { matchOrder: 3, delta: -1 },
    ];
    expect(computeHotStreak(briefs)).toBe('med_hot');
  });

  it('handles briefs arriving in arbitrary order', () => {
    const briefs = [
      { matchOrder: 3, delta: -1 },
      { matchOrder: 0, delta: 3 },
      { matchOrder: 2, delta: 3 },
      { matchOrder: 1, delta: 1 },
    ];
    expect(computeHotStreak(briefs)).toBe('med_hot');
  });

  it('treats delta exactly equal to 3 as a valid boost', () => {
    expect(computeHotStreak([{ matchOrder: 0, delta: 3 }])).toBe('red_hot');
  });

  it('treats delta of 2 as not a boost', () => {
    expect(computeHotStreak([{ matchOrder: 0, delta: 2 }])).toBeNull();
  });

  it('handles a single-match history with no boost', () => {
    expect(computeHotStreak([{ matchOrder: 0, delta: 0 }])).toBeNull();
  });

  it('handles a single-match history that is a boost', () => {
    expect(computeHotStreak([{ matchOrder: 0, delta: 6 }])).toBe('red_hot');
  });

  it('does not mutate the input array', () => {
    const briefs = [
      { matchOrder: 0, delta: 1 },
      { matchOrder: 1, delta: 3 },
    ];
    const copy = [...briefs];
    computeHotStreak(briefs);
    expect(briefs).toStrictEqual(copy);
  });

  it('DGW: boost in sub-match A means live indicator shows recent if sub-match B is latest', () => {
    const briefs = [
      { matchOrder: 0, delta: 1 },
      { matchOrder: 1, delta: 3 },
      { matchOrder: 2, delta: -1 },
    ];
    expect(computeHotStreak(briefs)).toBe('med_hot');
  });
});

// ── buildMatchBriefs ─────────────────────────────────────────────────────────

describe('buildMatchBriefs', () => {
  it('single non-DGW snapshot produces one brief with the snapshot delta', () => {
    const result = buildMatchBriefs([{ delta: 2, reason: 'Blank vs FDR 3 opponent' }]);
    expect(result).toEqual([{ matchOrder: 0, delta: 2 }]);
  });

  it('multiple non-DGW snapshots produce consecutive matchOrders', () => {
    const result = buildMatchBriefs([
      { delta: 1, reason: 'Performance vs FDR 3 opponent' },
      { delta: 3, reason: 'MOTM vs FDR 5 opponent' },
      { delta: -1, reason: 'Blank vs FDR 3 opponent' },
    ]);
    expect(result).toEqual([
      { matchOrder: 0, delta: 1 },
      { matchOrder: 1, delta: 3 },
      { matchOrder: 2, delta: -1 },
    ]);
  });

  it('DGW snapshot expands into two consecutive briefs with per-sub-match deltas', () => {
    const reason = 'DGW: MOTM vs FDR 5 opponent (+3) + Blank vs FDR 3 opponent (-1)';
    const result = buildMatchBriefs([{ delta: 2, reason }]);
    expect(result).toEqual([
      { matchOrder: 0, delta: 3 },
      { matchOrder: 1, delta: -1 },
    ]);
  });

  it('DGW boost in sub-match B (most recent) → computeHotStreak returns red_hot — the live-indicator DGW bug', () => {
    // The bug: combined DGW delta = +1+3 = 4. With GW-based: gwsSince=0 → 'fresh' at currentGW.
    // At currentGW+1, gwsSince=1 → 'recent'. But sub-match B (matchOrder=1) WAS the most recent
    // match, and the boost was there — matchesSinceBoost=0 → should be 'fresh'.
    const reason = 'DGW: Blank vs FDR 3 opponent (+1) + MOTM vs FDR 5 opponent (+3)';
    const result = computeHotStreak(buildMatchBriefs([{ delta: 4, reason }]));
    expect(result).toBe('red_hot');
  });

  it('DGW combined delta < 3 but sub-match A delta ≥ 3 → boost detected via per-sub-match parsing', () => {
    // Combined = +3 + (−1) = +2. SQL WHERE delta>=3 misses this. buildMatchBriefs finds it.
    const reason = 'DGW: MOTM vs FDR 5 opponent (+3) + Blank vs FDR 3 opponent (-1)';
    const briefs = buildMatchBriefs([{ delta: 2, reason }]);
    expect(briefs[0]).toMatchObject({ delta: 3 });
    expect(briefs[1]).toMatchObject({ delta: -1 });
    // After the DGW (sub-match B is the latest), matchesSinceBoost = 1 → 'recent'.
    expect(computeHotStreak(briefs)).toBe('med_hot');
  });

  it('mixed sequence: non-DGW then DGW assigns matchOrders correctly', () => {
    const result = buildMatchBriefs([
      { delta: 1, reason: 'Performance vs FDR 3 opponent' },
      {
        delta: 2,
        reason: 'DGW: Performance vs FDR 4 opponent (+3) + Blank vs FDR 2 opponent (-1)',
      },
    ]);
    expect(result).toEqual([
      { matchOrder: 0, delta: 1 },
      { matchOrder: 1, delta: 3 },
      { matchOrder: 2, delta: -1 },
    ]);
  });

  it('returns empty array for empty input', () => {
    expect(buildMatchBriefs([])).toEqual([]);
  });

  it('DGW reason with fatigue-modified sub-match parses correctly', () => {
    // Real format: "Performance + Fatigue" is the sub-match reason text with no inline delta;
    // the combined entry delta (+2) appears only at the end. The signed-delta regex finds
    // exactly one delta per sub-match entry — no false positives.
    const reason =
      'DGW: Performance vs FDR 3 opponent + Fatigue (+2) + Blank vs FDR 2 opponent (-1)';
    const briefs = buildMatchBriefs([{ delta: 1, reason }]);
    expect(briefs).toHaveLength(2);
    expect(briefs[0]).toMatchObject({ matchOrder: 0, delta: 2 });
    expect(briefs[1]).toMatchObject({ matchOrder: 1, delta: -1 });
  });
});
