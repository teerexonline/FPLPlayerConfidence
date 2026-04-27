import { assert, describe, expect, it } from 'vitest';
import { MIN_MINUTES_FOR_RANKING } from './constants';
import {
  toP90,
  medianOf,
  percentileRank,
  applyShrunken,
  buildPositionCohort,
  computePercentileRanks,
} from './normalize';
import type { PlayerInput } from './types';

// ── toP90 ─────────────────────────────────────────────────────────────────────

describe('toP90', () => {
  it('converts a full-season starter correctly', () => {
    // 3060 minutes = 34 × 90 — exact starter rate
    expect(toP90(340, 3060)).toBeCloseTo(10, 5);
  });

  it('scales proportionally for a half-season player', () => {
    expect(toP90(180, 1620)).toBeCloseTo(10, 5); // same rate, fewer games
  });

  it('returns 0 when minutes is 0 (guard against division by zero)', () => {
    expect(toP90(100, 0)).toBe(0);
  });

  it('returns 0 when value is 0', () => {
    expect(toP90(0, 900)).toBe(0);
  });

  it('handles fractional results correctly', () => {
    expect(toP90(45, 90)).toBeCloseTo(45, 5); // per-90 = same as raw for 90 min played
  });
});

// ── medianOf ──────────────────────────────────────────────────────────────────

describe('medianOf', () => {
  it('returns middle element for odd-length sorted array', () => {
    expect(medianOf([1, 2, 3])).toBe(2);
  });

  it('averages the two middle elements for even-length array', () => {
    expect(medianOf([1, 2, 3, 4])).toBeCloseTo(2.5, 5);
  });

  it('handles a single-element array', () => {
    expect(medianOf([42])).toBe(42);
  });

  it('works on unsorted input (does not mutate the original)', () => {
    const arr = [5, 1, 3];
    expect(medianOf(arr)).toBe(3);
    expect(arr).toEqual([5, 1, 3]); // original unchanged
  });

  it('handles repeated values', () => {
    expect(medianOf([2, 2, 2])).toBe(2);
  });
});

// ── percentileRank ────────────────────────────────────────────────────────────

describe('percentileRank', () => {
  it('returns 0.5 for the only element in a 1-player cohort', () => {
    // single-player: (0 lower + 0.5 ties) / 1 = 0.5
    expect(percentileRank(5, [5])).toBeCloseTo(0.5, 5);
  });

  it('returns correct ranks for a 3-element cohort', () => {
    const cohort = [10, 20, 30];
    // value=10: (0 + 0.5) / 3 ≈ 0.167
    expect(percentileRank(10, cohort)).toBeCloseTo(1 / 6, 4);
    // value=20: (1 + 0.5) / 3 = 0.5
    expect(percentileRank(20, cohort)).toBeCloseTo(0.5, 5);
    // value=30: (2 + 0.5) / 3 ≈ 0.833
    expect(percentileRank(30, cohort)).toBeCloseTo(5 / 6, 4);
  });

  it('gives tied values the same average rank', () => {
    const cohort = [10, 10, 20];
    // Each 10: (0 + 0.5 * 2) / 3 ≈ 0.333
    expect(percentileRank(10, cohort)).toBeCloseTo(1 / 3, 4);
    expect(percentileRank(10, cohort)).toBeCloseTo(1 / 3, 4);
    // 20: (2 + 0.5) / 3 ≈ 0.833
    expect(percentileRank(20, cohort)).toBeCloseTo(5 / 6, 4);
  });

  it('output is always in [0, 1]', () => {
    const cohort = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    for (const v of cohort) {
      const pct = percentileRank(v, cohort);
      expect(pct).toBeGreaterThanOrEqual(0);
      expect(pct).toBeLessThanOrEqual(1);
    }
  });
});

// ── applyShrunken ─────────────────────────────────────────────────────────────

describe('applyShrunken', () => {
  it('returns raw value unchanged when minutes >= MIN_MINUTES_FOR_RANKING', () => {
    const raw = 8.5;
    const median = 4.0;
    const result = applyShrunken(raw, MIN_MINUTES_FOR_RANKING, median);
    expect(result).toBeCloseTo(raw, 5);
  });

  it('returns median when minutes == 0', () => {
    const result = applyShrunken(10, 0, 5);
    expect(result).toBeCloseTo(5, 5);
  });

  it('blends toward median when minutes < MIN_MINUTES_FOR_RANKING', () => {
    const minutes = MIN_MINUTES_FOR_RANKING / 2; // 50% shrinkage
    const raw = 10;
    const median = 4;
    const result = applyShrunken(raw, minutes, median);
    // shrinkage = 0.5: result = 0.5 * 10 + 0.5 * 4 = 7.0
    expect(result).toBeCloseTo(7.0, 5);
  });

  it('player with 90 minutes and extreme stats moves toward median', () => {
    const minutes = 90;
    const raw = 20; // freakishly high from one match
    const median = 4;
    const shrinkage = 90 / MIN_MINUTES_FOR_RANKING;
    const expected = shrinkage * raw + (1 - shrinkage) * median;
    expect(applyShrunken(raw, minutes, median)).toBeCloseTo(expected, 5);
  });
});

// ── buildPositionCohort ───────────────────────────────────────────────────────

describe('buildPositionCohort', () => {
  it('computes medians for a simple cohort', () => {
    const players: PlayerInput[] = [
      { id: 1, position: 'FWD', minutes: 900, influence: 90, threat: 300, creativity: 45 },
      { id: 2, position: 'FWD', minutes: 900, influence: 180, threat: 600, creativity: 90 },
      { id: 3, position: 'FWD', minutes: 900, influence: 270, threat: 900, creativity: 135 },
    ];
    // Per-90 for each player (minutes=900): influence→[9,18,27], threat→[30,60,90], creativity→[4.5,9,13.5]
    // All have 900 minutes (>270), no shrinkage applies
    // Medians (middle of 3): influence=18, threat=60, creativity=9
    const cohort = buildPositionCohort(players);
    expect(cohort.medianInfluenceP90).toBeCloseTo(18, 4);
    expect(cohort.medianThreatP90).toBeCloseTo(60, 4);
    expect(cohort.medianCreativityP90).toBeCloseTo(9, 4);
  });
});

// ── computePercentileRanks ────────────────────────────────────────────────────

describe('computePercentileRanks', () => {
  it('assigns higher percentiles to higher-ICT players within position group', () => {
    const players: PlayerInput[] = [
      { id: 10, position: 'MID', minutes: 900, influence: 100, threat: 100, creativity: 500 },
      { id: 20, position: 'MID', minutes: 900, influence: 200, threat: 200, creativity: 300 },
      { id: 30, position: 'MID', minutes: 900, influence: 300, threat: 300, creativity: 100 },
    ];
    const result = computePercentileRanks(players);

    const p10 = result.get(10);
    const p30 = result.get(30);
    expect(p10).toBeDefined();
    expect(p30).toBeDefined();
    assert(p10 !== undefined);
    assert(p30 !== undefined);

    // Player 30 has highest influence/threat — higher percentile
    expect(p30.influencePct).toBeGreaterThan(p10.influencePct);
    expect(p30.threatPct).toBeGreaterThan(p10.threatPct);
    // Player 10 has highest creativity
    expect(p10.creativityPct).toBeGreaterThan(p30.creativityPct);
  });

  it('records the correct season position for each player', () => {
    const players: PlayerInput[] = [
      { id: 1, position: 'GK', minutes: 900, influence: 50, threat: 10, creativity: 20 },
      { id: 2, position: 'FWD', minutes: 900, influence: 50, threat: 100, creativity: 20 },
    ];
    const result = computePercentileRanks(players);
    expect(result.get(1)?.seasonPosition).toBe('GK');
    expect(result.get(2)?.seasonPosition).toBe('FWD');
  });

  it('low-minutes player is shrunk toward median — does not dominate the high end', () => {
    // One player with 60 minutes and extreme per-90 stats
    // Three players with 900 minutes and moderate stats
    const players: PlayerInput[] = [
      { id: 1, position: 'FWD', minutes: 60, influence: 900, threat: 900, creativity: 900 },
      { id: 2, position: 'FWD', minutes: 900, influence: 90, threat: 90, creativity: 90 },
      { id: 3, position: 'FWD', minutes: 900, influence: 90, threat: 90, creativity: 90 },
      { id: 4, position: 'FWD', minutes: 900, influence: 90, threat: 90, creativity: 90 },
    ];
    const result = computePercentileRanks(players);
    const p1 = result.get(1);
    const p2 = result.get(2);
    assert(p1 !== undefined);
    assert(p2 !== undefined);
    // After shrinkage, player 1's adjusted p90 should NOT dominate player 2
    // (shrinkage pulls them toward the median of the other three)
    expect(p1.threatPct).toBeLessThan(0.9);
    expect(p1.influencePct).toBeLessThan(0.9);
    // The stable players should be at a reasonable percentile level
    expect(p2.threatPct).toBeGreaterThan(0.1);
  });

  it('handles each position group independently', () => {
    const players: PlayerInput[] = [
      { id: 1, position: 'GK', minutes: 900, influence: 50, threat: 10, creativity: 10 },
      { id: 2, position: 'FWD', minutes: 900, influence: 50, threat: 10, creativity: 10 },
    ];
    const result = computePercentileRanks(players);
    // Both are the sole member of their position group → both get 0.5 percentile
    expect(result.get(1)?.influencePct).toBeCloseTo(0.5, 5);
    expect(result.get(2)?.influencePct).toBeCloseTo(0.5, 5);
  });
});
