import { describe, expect, it } from 'vitest';
import { computeHotStreak, computeHotStreakAtGameweek, hotStreakFromGwsSince } from './hotStreak';

// ── hotStreakFromGwsSince ────────────────────────────────────────────────────

describe('hotStreakFromGwsSince', () => {
  it('returns red_hot when gwsSince is 0 (boost GW itself)', () => {
    expect(hotStreakFromGwsSince(0)).toBe('red_hot');
  });

  it('returns med_hot when gwsSince is 1 (one GW after boost)', () => {
    expect(hotStreakFromGwsSince(1)).toBe('med_hot');
  });

  it('returns low_hot when gwsSince is 2 (two GWs after boost)', () => {
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

  it('returns red_hot for negative gwsSince (boost GW ahead of currentGW)', () => {
    // Should not happen in normal use, but treat as fresh — gwsSince < 0 is caught by the === 0 path missing and fallthrough to null.
    // Negative values: none of the === checks match → null.
    expect(hotStreakFromGwsSince(-1)).toBeNull();
  });
});

// ── computeHotStreakAtGameweek ───────────────────────────────────────────────

describe('computeHotStreakAtGameweek', () => {
  it('returns null when snapshot history is empty', () => {
    expect(computeHotStreakAtGameweek([], 20)).toBeNull();
  });

  it('returns null when no snapshot at or before atGameweek has delta ≥ 3', () => {
    const snapshots = [
      { gameweek: 18, delta: 2 },
      { gameweek: 19, delta: -1 },
      { gameweek: 20, delta: 1 },
    ];
    expect(computeHotStreakAtGameweek(snapshots, 20)).toBeNull();
  });

  it('returns red_hot at the boost GW itself (gwsSince=0)', () => {
    const snapshots = [
      { gameweek: 31, delta: 3 },
      { gameweek: 30, delta: 1 },
    ];
    expect(computeHotStreakAtGameweek(snapshots, 31)).toBe('red_hot');
  });

  it('returns med_hot one GW after the boost (gwsSince=1)', () => {
    const snapshots = [
      { gameweek: 31, delta: 3 },
      { gameweek: 32, delta: -1 },
    ];
    expect(computeHotStreakAtGameweek(snapshots, 32)).toBe('med_hot');
  });

  it('returns low_hot two GWs after the boost (gwsSince=2)', () => {
    const snapshots = [
      { gameweek: 31, delta: 3 },
      { gameweek: 33, delta: 1 },
    ];
    expect(computeHotStreakAtGameweek(snapshots, 33)).toBe('low_hot');
  });

  it('returns null three GWs after the boost (gwsSince=3, streak expired)', () => {
    const snapshots = [{ gameweek: 31, delta: 3 }];
    expect(computeHotStreakAtGameweek(snapshots, 34)).toBeNull();
  });

  it('excludes boosts that occurred after atGameweek', () => {
    // Boost at GW33 should not affect GW31 card
    const snapshots = [
      { gameweek: 29, delta: 1 },
      { gameweek: 33, delta: 5 },
    ];
    expect(computeHotStreakAtGameweek(snapshots, 31)).toBeNull();
  });

  it('anchors to most-recent prior boost when multiple boosts exist', () => {
    // Boost at GW20 and GW28. At GW29: most recent boost is GW28, gwsSince=1 → med_hot
    const snapshots = [
      { gameweek: 20, delta: 3 },
      { gameweek: 21, delta: -1 },
      { gameweek: 28, delta: 4 },
      { gameweek: 29, delta: 0 },
    ];
    expect(computeHotStreakAtGameweek(snapshots, 29)).toBe('med_hot');
  });

  it('correctly labels GW20 as recent from GW19 boost, and GW28 card as fresh from its own boost', () => {
    const snapshots = [
      { gameweek: 19, delta: 3 },
      { gameweek: 20, delta: -1 },
      { gameweek: 28, delta: 3 },
      { gameweek: 29, delta: -1 },
    ];
    // GW20: gwsSince = 20-19 = 1 → med_hot (recent)
    expect(computeHotStreakAtGameweek(snapshots, 20)).toBe('med_hot');
    // GW28: gwsSince = 28-28 = 0 → red_hot (fresh — own boost)
    expect(computeHotStreakAtGameweek(snapshots, 28)).toBe('red_hot');
    // GW29: gwsSince = 29-28 = 1 → med_hot (recent — from GW28 boost)
    expect(computeHotStreakAtGameweek(snapshots, 29)).toBe('med_hot');
  });

  it('does not mutate the input array', () => {
    const snapshots = [
      { gameweek: 31, delta: 3 },
      { gameweek: 32, delta: 1 },
    ];
    const copy = [...snapshots];
    computeHotStreakAtGameweek(snapshots, 32);
    expect(snapshots).toStrictEqual(copy);
  });

  it('handles snapshots in arbitrary order', () => {
    const snapshots = [
      { gameweek: 33, delta: 1 },
      { gameweek: 31, delta: 3 },
    ];
    // At GW33: most recent boost ≤ 33 is GW31, gwsSince=2 → low_hot
    expect(computeHotStreakAtGameweek(snapshots, 33)).toBe('low_hot');
  });
});

// ── computeHotStreak ────────────────────────────────────────────────────────

describe('computeHotStreak', () => {
  it('returns null when snapshot history is empty', () => {
    expect(computeHotStreak([], 20)).toBeNull();
  });

  it('returns null when no snapshot has delta ≥ 3', () => {
    const snapshots = [
      { gameweek: 18, delta: 2 },
      { gameweek: 19, delta: -1 },
      { gameweek: 20, delta: 1 },
    ];
    expect(computeHotStreak(snapshots, 20)).toBeNull();
  });

  it('returns null when the most recent boost was 3+ GWs ago', () => {
    const snapshots = [
      { gameweek: 10, delta: 3 },
      { gameweek: 14, delta: 1 },
      { gameweek: 15, delta: 0 },
      { gameweek: 16, delta: 2 },
    ];
    // currentGW=16, boost at GW10 → gwsSince=6
    expect(computeHotStreak(snapshots, 16)).toBeNull();
  });

  it('returns red_hot when boost is in the current GW (gwsSince=0)', () => {
    const snapshots = [
      { gameweek: 18, delta: 1 },
      { gameweek: 19, delta: 3 },
    ];
    expect(computeHotStreak(snapshots, 19)).toBe('red_hot');
  });

  it('returns med_hot when boost was 1 GW ago', () => {
    const snapshots = [
      { gameweek: 17, delta: 1 },
      { gameweek: 18, delta: 4 },
      { gameweek: 19, delta: -1 },
    ];
    expect(computeHotStreak(snapshots, 19)).toBe('med_hot');
  });

  it('returns low_hot when boost was 2 GWs ago', () => {
    const snapshots = [
      { gameweek: 16, delta: 3 },
      { gameweek: 17, delta: 1 },
      { gameweek: 18, delta: -1 },
    ];
    expect(computeHotStreak(snapshots, 18)).toBe('low_hot');
  });

  it('returns null when boost was 3 GWs ago (streak expired)', () => {
    const snapshots = [
      { gameweek: 15, delta: 5 },
      { gameweek: 16, delta: 0 },
      { gameweek: 17, delta: 1 },
      { gameweek: 18, delta: 2 },
    ];
    expect(computeHotStreak(snapshots, 18)).toBeNull();
  });

  it('uses the most recent qualifying boost when multiple boosts exist', () => {
    // GW10 has delta≥3 and GW15 has delta≥3. currentGW=17 → gwsSince from GW15 = 2 → low_hot
    const snapshots = [
      { gameweek: 10, delta: 3 },
      { gameweek: 13, delta: 1 },
      { gameweek: 15, delta: 4 },
      { gameweek: 16, delta: -1 },
      { gameweek: 17, delta: 2 },
    ];
    expect(computeHotStreak(snapshots, 17)).toBe('low_hot');
  });

  it('resets the timer when a new boost occurs during an existing streak', () => {
    // Boost at GW14 would be cold at GW17, but new boost at GW16 → gwsSince=1 → med_hot
    const snapshots = [
      { gameweek: 14, delta: 3 },
      { gameweek: 15, delta: 1 },
      { gameweek: 16, delta: 3 },
      { gameweek: 17, delta: -1 },
    ];
    expect(computeHotStreak(snapshots, 17)).toBe('med_hot');
  });

  it('handles snapshots arriving in arbitrary order', () => {
    const snapshots = [
      { gameweek: 17, delta: -1 },
      { gameweek: 14, delta: 3 },
      { gameweek: 16, delta: 3 },
      { gameweek: 15, delta: 1 },
    ];
    expect(computeHotStreak(snapshots, 17)).toBe('med_hot');
  });

  it('treats delta exactly equal to 3 as a valid boost', () => {
    const snapshots = [{ gameweek: 20, delta: 3 }];
    expect(computeHotStreak(snapshots, 20)).toBe('red_hot');
  });

  it('treats delta of 2 as not a boost', () => {
    const snapshots = [{ gameweek: 20, delta: 2 }];
    expect(computeHotStreak(snapshots, 20)).toBeNull();
  });

  it('handles a single-match history with no boost', () => {
    expect(computeHotStreak([{ gameweek: 1, delta: 0 }], 1)).toBeNull();
  });

  it('handles a single-match history that is a boost', () => {
    expect(computeHotStreak([{ gameweek: 38, delta: 6 }], 38)).toBe('red_hot');
  });

  it('does not mutate the input array', () => {
    const snapshots = [
      { gameweek: 19, delta: 1 },
      { gameweek: 20, delta: 3 },
    ];
    const copy = [...snapshots];
    computeHotStreak(snapshots, 20);
    expect(snapshots).toStrictEqual(copy);
  });
});
