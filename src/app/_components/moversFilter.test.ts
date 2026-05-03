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
    isStale: false,
    hotStreak: null,
    totalPoints: 100,
    nextGwXp: 0,
    ...overrides,
  };
}

// ── isEligibleMover ───────────────────────────────────────────────────────────

describe('isEligibleMover', () => {
  it('returns true for available player with fresh data', () => {
    expect(isEligibleMover(makePlayer({ status: 'a', isStale: false }))).toBe(true);
  });

  it('returns false for injured player (status = "i")', () => {
    expect(isEligibleMover(makePlayer({ status: 'i', isStale: false }))).toBe(false);
  });

  it('returns false for doubtful player (status = "d")', () => {
    expect(isEligibleMover(makePlayer({ status: 'd', isStale: false }))).toBe(false);
  });

  it('returns false for suspended player (status = "s")', () => {
    expect(isEligibleMover(makePlayer({ status: 's', isStale: false }))).toBe(false);
  });

  it('returns false for unavailable player (status = "u")', () => {
    expect(isEligibleMover(makePlayer({ status: 'u', isStale: false }))).toBe(false);
  });

  it('returns false for non-playing player (status = "n")', () => {
    expect(isEligibleMover(makePlayer({ status: 'n', isStale: false }))).toBe(false);
  });

  it('returns false for stale player even when status is "a"', () => {
    expect(isEligibleMover(makePlayer({ status: 'a', isStale: true }))).toBe(false);
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
      makePlayer({ id: 4, latestDelta: 2, isStale: true }), // stale — excluded
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
      makePlayer({ id: 1, latestDelta: 10, isStale: true }),
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
      makePlayer({ id: 2, latestDelta: 2, isStale: true }),
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
      makePlayer({ id: 1, latestDelta: -10, isStale: true }),
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
      makePlayer({ id: 2, latestDelta: -2, isStale: true }),
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
