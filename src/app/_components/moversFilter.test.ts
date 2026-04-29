import { describe, expect, it } from 'vitest';
import { isEligibleMover, selectRisers, selectFallers } from './moversFilter';
import type { DashboardPlayer } from './types';

function makePlayer(overrides: Partial<DashboardPlayer> = {}): DashboardPlayer {
  return {
    id: 1,
    webName: 'Salah',
    teamCode: 14,
    teamShortName: 'LIV',
    position: 'MID',
    confidence: 5,
    latestDelta: 3,
    latestGameweek: 34,
    recentDeltas: [1, 2, 3],
    status: 'a',
    chanceOfPlaying: null,
    news: '',
    recentAppearances: 3,
    hotStreak: null,
    totalPoints: 100,
    ...overrides,
  };
}

// ── isEligibleMover ───────────────────────────────────────────────────────────

describe('isEligibleMover', () => {
  it('returns true for available player with fresh data', () => {
    expect(isEligibleMover(makePlayer({ status: 'a', recentAppearances: 3 }))).toBe(true);
  });

  it('returns true at the minimum fresh threshold (recentAppearances = 2)', () => {
    expect(isEligibleMover(makePlayer({ status: 'a', recentAppearances: 2 }))).toBe(true);
  });

  it('returns false for injured player (status = "i")', () => {
    expect(isEligibleMover(makePlayer({ status: 'i', recentAppearances: 3 }))).toBe(false);
  });

  it('returns false for doubtful player (status = "d")', () => {
    expect(isEligibleMover(makePlayer({ status: 'd', recentAppearances: 3 }))).toBe(false);
  });

  it('returns false for suspended player (status = "s")', () => {
    expect(isEligibleMover(makePlayer({ status: 's', recentAppearances: 3 }))).toBe(false);
  });

  it('returns false for unavailable player (status = "u")', () => {
    expect(isEligibleMover(makePlayer({ status: 'u', recentAppearances: 3 }))).toBe(false);
  });

  it('returns false for non-playing player (status = "n")', () => {
    expect(isEligibleMover(makePlayer({ status: 'n', recentAppearances: 3 }))).toBe(false);
  });

  it('returns false for stale player (recentAppearances = 1) even when status is "a"', () => {
    expect(isEligibleMover(makePlayer({ status: 'a', recentAppearances: 1 }))).toBe(false);
  });

  it('returns false for stale player with recentAppearances = 0', () => {
    expect(isEligibleMover(makePlayer({ status: 'a', recentAppearances: 0 }))).toBe(false);
  });
});

// ── selectRisers ──────────────────────────────────────────────────────────────

describe('selectRisers', () => {
  it('returns eligible players sorted by delta descending', () => {
    const players = [
      makePlayer({ id: 1, latestDelta: 3 }),
      makePlayer({ id: 2, latestDelta: 5 }),
      makePlayer({ id: 3, latestDelta: 1 }),
    ];
    const result = selectRisers(players, 5);
    expect(result.map((p) => p.id)).toEqual([2, 1, 3]);
  });

  it('returns top 5 from a larger eligible pool', () => {
    const players = [1, 2, 3, 4, 5, 6, 7].map((n) => makePlayer({ id: n, latestDelta: n }));
    const result = selectRisers(players, 5);
    expect(result.map((p) => p.id)).toEqual([7, 6, 5, 4, 3]);
  });

  it('skips injured players and fills from next eligible', () => {
    const players = [
      makePlayer({ id: 1, latestDelta: 5 }),
      makePlayer({ id: 2, latestDelta: 4, status: 'i' }), // excluded
      makePlayer({ id: 3, latestDelta: 3 }),
      makePlayer({ id: 4, latestDelta: 2, recentAppearances: 1 }), // stale — excluded
      makePlayer({ id: 5, latestDelta: 1 }),
      makePlayer({ id: 6, latestDelta: 6 }),
    ];
    const result = selectRisers(players, 5);
    expect(result.map((p) => p.id)).toEqual([6, 1, 3, 5]);
    expect(result.every((p) => p.status === 'a')).toBe(true);
  });

  it('excludes injured players even with the largest delta', () => {
    const players = [
      makePlayer({ id: 1, latestDelta: 10, status: 'i' }),
      makePlayer({ id: 2, latestDelta: 3 }),
    ];
    expect(selectRisers(players, 5).map((p) => p.id)).toEqual([2]);
  });

  it('excludes doubtful players even with the largest delta', () => {
    const players = [
      makePlayer({ id: 1, latestDelta: 10, status: 'd' }),
      makePlayer({ id: 2, latestDelta: 3 }),
    ];
    expect(selectRisers(players, 5).map((p) => p.id)).toEqual([2]);
  });

  it('excludes stale players even with the largest delta', () => {
    const players = [
      makePlayer({ id: 1, latestDelta: 10, recentAppearances: 0 }),
      makePlayer({ id: 2, latestDelta: 3 }),
    ];
    expect(selectRisers(players, 5).map((p) => p.id)).toEqual([2]);
  });

  it('excludes players with non-positive delta (zero and negative)', () => {
    const players = [
      makePlayer({ id: 1, latestDelta: 2 }),
      makePlayer({ id: 2, latestDelta: 0 }),
      makePlayer({ id: 3, latestDelta: -1 }),
    ];
    expect(selectRisers(players, 5).map((p) => p.id)).toEqual([1]);
  });

  it('returns fewer than count when eligible pool is smaller — no padding', () => {
    const players = [makePlayer({ id: 1, latestDelta: 2 }), makePlayer({ id: 2, latestDelta: 1 })];
    expect(selectRisers(players, 5)).toHaveLength(2);
  });

  it('returns empty array when no eligible risers exist', () => {
    const players = [
      makePlayer({ id: 1, latestDelta: 3, status: 'i' }),
      makePlayer({ id: 2, latestDelta: 2, recentAppearances: 0 }),
    ];
    expect(selectRisers(players, 5)).toHaveLength(0);
  });
});

it('breaks ties on equal delta by totalPoints descending — higher points player first', () => {
  const players = [
    makePlayer({ id: 1, latestDelta: 3, totalPoints: 80 }),
    makePlayer({ id: 2, latestDelta: 3, totalPoints: 200 }),
    makePlayer({ id: 3, latestDelta: 3, totalPoints: 150 }),
  ];
  const result = selectRisers(players, 5);
  expect(result.map((p) => p.id)).toEqual([2, 3, 1]);
});

// ── selectFallers ─────────────────────────────────────────────────────────────

describe('selectFallers', () => {
  it('returns eligible players sorted by delta ascending (most negative first)', () => {
    const players = [
      makePlayer({ id: 1, latestDelta: -1 }),
      makePlayer({ id: 2, latestDelta: -5 }),
      makePlayer({ id: 3, latestDelta: -3 }),
    ];
    const result = selectFallers(players, 5);
    expect(result.map((p) => p.id)).toEqual([2, 3, 1]);
  });

  it('returns top 5 from a larger eligible pool', () => {
    const players = [1, 2, 3, 4, 5, 6, 7].map((n) => makePlayer({ id: n, latestDelta: -n }));
    const result = selectFallers(players, 5);
    expect(result.map((p) => p.id)).toEqual([7, 6, 5, 4, 3]);
  });

  it('skips injured players and fills from next eligible', () => {
    const players = [
      makePlayer({ id: 1, latestDelta: -5 }),
      makePlayer({ id: 2, latestDelta: -4, status: 'i' }), // excluded
      makePlayer({ id: 3, latestDelta: -3 }),
    ];
    const result = selectFallers(players, 5);
    expect(result.map((p) => p.id)).toEqual([1, 3]);
  });

  it('excludes injured players even with the largest negative delta', () => {
    const players = [
      makePlayer({ id: 1, latestDelta: -10, status: 'i' }),
      makePlayer({ id: 2, latestDelta: -3 }),
    ];
    expect(selectFallers(players, 5).map((p) => p.id)).toEqual([2]);
  });

  it('excludes doubtful players even with the largest negative delta', () => {
    const players = [
      makePlayer({ id: 1, latestDelta: -10, status: 'd' }),
      makePlayer({ id: 2, latestDelta: -3 }),
    ];
    expect(selectFallers(players, 5).map((p) => p.id)).toEqual([2]);
  });

  it('excludes stale players even with the largest negative delta', () => {
    const players = [
      makePlayer({ id: 1, latestDelta: -10, recentAppearances: 1 }),
      makePlayer({ id: 2, latestDelta: -3 }),
    ];
    expect(selectFallers(players, 5).map((p) => p.id)).toEqual([2]);
  });

  it('excludes players with non-negative delta (zero and positive)', () => {
    const players = [
      makePlayer({ id: 1, latestDelta: -2 }),
      makePlayer({ id: 2, latestDelta: 0 }),
      makePlayer({ id: 3, latestDelta: 3 }),
    ];
    expect(selectFallers(players, 5).map((p) => p.id)).toEqual([1]);
  });

  it('returns fewer than count when eligible pool is smaller — no padding', () => {
    const players = [makePlayer({ id: 1, latestDelta: -2 })];
    expect(selectFallers(players, 5)).toHaveLength(1);
  });

  it('returns empty array when no eligible fallers exist', () => {
    const players = [
      makePlayer({ id: 1, latestDelta: -3, status: 'd' }),
      makePlayer({ id: 2, latestDelta: -2, recentAppearances: 0 }),
    ];
    expect(selectFallers(players, 5)).toHaveLength(0);
  });

  it('breaks ties on equal delta by totalPoints descending — higher points player first', () => {
    const players = [
      makePlayer({ id: 1, latestDelta: -3, totalPoints: 80 }),
      makePlayer({ id: 2, latestDelta: -3, totalPoints: 200 }),
      makePlayer({ id: 3, latestDelta: -3, totalPoints: 150 }),
    ];
    const result = selectFallers(players, 5);
    expect(result.map((p) => p.id)).toEqual([2, 3, 1]);
  });
});
