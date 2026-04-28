import { describe, expect, it } from 'vitest';
import { computeHotStreak, hotStreakFromGwsSince } from './hotStreak';

// ── hotStreakFromGwsSince ────────────────────────────────────────────────────

describe('hotStreakFromGwsSince', () => {
  it('returns red_hot when gwsSince is 0 (boost this GW)', () => {
    expect(hotStreakFromGwsSince(0)).toBe('red_hot');
  });

  it('returns red_hot when gwsSince is 1', () => {
    expect(hotStreakFromGwsSince(1)).toBe('red_hot');
  });

  it('returns med_hot when gwsSince is 2', () => {
    expect(hotStreakFromGwsSince(2)).toBe('med_hot');
  });

  it('returns low_hot when gwsSince is 3', () => {
    expect(hotStreakFromGwsSince(3)).toBe('low_hot');
  });

  it('returns null when gwsSince is 4 (streak expired)', () => {
    expect(hotStreakFromGwsSince(4)).toBeNull();
  });

  it('returns null for large gwsSince values', () => {
    expect(hotStreakFromGwsSince(10)).toBeNull();
    expect(hotStreakFromGwsSince(38)).toBeNull();
  });

  it('returns red_hot for negative gwsSince (future boost edge case)', () => {
    // gwsSince < 0 means the boost GW is somehow ahead of currentGW.
    // The ≤ 1 guard catches it — treat as red_hot.
    expect(hotStreakFromGwsSince(-1)).toBe('red_hot');
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

  it('returns null when the most recent boost was 4+ GWs ago', () => {
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

  it('returns red_hot when boost was 1 GW ago', () => {
    const snapshots = [
      { gameweek: 17, delta: 1 },
      { gameweek: 18, delta: 4 },
      { gameweek: 19, delta: -1 },
    ];
    expect(computeHotStreak(snapshots, 19)).toBe('red_hot');
  });

  it('returns med_hot when boost was 2 GWs ago', () => {
    const snapshots = [
      { gameweek: 16, delta: 3 },
      { gameweek: 17, delta: 1 },
      { gameweek: 18, delta: -1 },
    ];
    expect(computeHotStreak(snapshots, 18)).toBe('med_hot');
  });

  it('returns low_hot when boost was 3 GWs ago', () => {
    const snapshots = [
      { gameweek: 15, delta: 5 },
      { gameweek: 16, delta: 0 },
      { gameweek: 17, delta: 1 },
      { gameweek: 18, delta: 2 },
    ];
    expect(computeHotStreak(snapshots, 18)).toBe('low_hot');
  });

  it('uses the most recent qualifying boost when multiple boosts exist', () => {
    // GW10 has delta≥3 and GW15 has delta≥3. currentGW=17 → gwsSince from GW15 = 2
    const snapshots = [
      { gameweek: 10, delta: 3 },
      { gameweek: 13, delta: 1 },
      { gameweek: 15, delta: 4 },
      { gameweek: 16, delta: -1 },
      { gameweek: 17, delta: 2 },
    ];
    expect(computeHotStreak(snapshots, 17)).toBe('med_hot');
  });

  it('resets the timer when a new boost occurs during an existing streak', () => {
    // Boost at GW14 would be low_hot at GW17, but new boost at GW16 → red_hot
    const snapshots = [
      { gameweek: 14, delta: 3 },
      { gameweek: 15, delta: 1 },
      { gameweek: 16, delta: 3 },
      { gameweek: 17, delta: -1 },
    ];
    expect(computeHotStreak(snapshots, 17)).toBe('red_hot');
  });

  it('handles snapshots arriving in arbitrary order', () => {
    // Same data as above but shuffled
    const snapshots = [
      { gameweek: 17, delta: -1 },
      { gameweek: 14, delta: 3 },
      { gameweek: 16, delta: 3 },
      { gameweek: 15, delta: 1 },
    ];
    expect(computeHotStreak(snapshots, 17)).toBe('red_hot');
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
