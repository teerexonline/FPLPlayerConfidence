import { describe, expect, it } from 'vitest';
import {
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
