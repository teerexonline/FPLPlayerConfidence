import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { bucketForFdr, calculatePlayerXp, calculateTeamXp } from './calculator';
import type { PlayerXpInput, StarterXpInput, TeamFixture } from './types';

// ── Helpers ───────────────────────────────────────────────────────────────────

const fixture = (overrides: Partial<TeamFixture> = {}): TeamFixture => ({
  gameweek: 36,
  opponentTeamId: 7,
  isHome: true,
  fdr: 3,
  ...overrides,
});

const playerInput = (overrides: Partial<PlayerXpInput> = {}): PlayerXpInput => ({
  playerId: 1,
  confidencePct: 50,
  averages: { low: 4.0, mid: 5.0, high: 3.0 },
  fixtures: [fixture()],
  ...overrides,
});

const starter = (overrides: Partial<StarterXpInput> = {}): StarterXpInput => ({
  ...playerInput(),
  squadPosition: 1,
  ...overrides,
});

// ── bucketForFdr ──────────────────────────────────────────────────────────────

describe('bucketForFdr', () => {
  it('maps FDR 1 → LOW', () => {
    expect(bucketForFdr(1)).toBe('LOW');
  });
  it('maps FDR 2 → LOW', () => {
    expect(bucketForFdr(2)).toBe('LOW');
  });
  it('maps FDR 3 → MID', () => {
    expect(bucketForFdr(3)).toBe('MID');
  });
  it('maps FDR 4 → HIGH', () => {
    expect(bucketForFdr(4)).toBe('HIGH');
  });
  it('maps FDR 5 → HIGH', () => {
    expect(bucketForFdr(5)).toBe('HIGH');
  });
});

// ── calculatePlayerXp — worked examples ──────────────────────────────────────
//
// Spec: per-fixture xP = (0.1 + Confidence) × Avg points vs FDR bucket
// where Confidence is the percentage expressed as a fraction (0–1).

describe('calculatePlayerXp — worked examples', () => {
  it('XP-EX-01: neutral confidence + easy fixture', () => {
    // (0.1 + 0.5) × 4.0 = 2.4
    const result = calculatePlayerXp(
      playerInput({
        confidencePct: 50,
        averages: { low: 4.0, mid: null, high: null },
        fixtures: [fixture({ fdr: 2 })],
      }),
    );
    expect(result.xp).toBe(2.4);
    expect(result.fixtureCount).toBe(1);
  });

  it('XP-EX-02: max confidence + easy fixture', () => {
    // (0.1 + 1.0) × 4.0 = 4.4
    const result = calculatePlayerXp(
      playerInput({
        confidencePct: 100,
        averages: { low: 4.0, mid: null, high: null },
        fixtures: [fixture({ fdr: 1 })],
      }),
    );
    expect(result.xp).toBe(4.4);
  });

  it('XP-EX-03: zero confidence still scales with bucket avg', () => {
    // (0.1 + 0) × 3.0 = 0.3
    const result = calculatePlayerXp(
      playerInput({
        confidencePct: 0,
        averages: { low: null, mid: null, high: 3.0 },
        fixtures: [fixture({ fdr: 5 })],
      }),
    );
    expect(result.xp).toBe(0.3);
  });

  it('XP-EX-04: 75% confidence + mid fixture', () => {
    // (0.1 + 0.75) × 5.0 = 4.25
    const result = calculatePlayerXp(
      playerInput({
        confidencePct: 75,
        averages: { low: null, mid: 5.0, high: null },
        fixtures: [fixture({ fdr: 3 })],
      }),
    );
    expect(result.xp).toBe(4.25);
  });

  it('XP-EX-05: no data at all → xP = 0', () => {
    const result = calculatePlayerXp(
      playerInput({
        confidencePct: 50,
        averages: { low: null, mid: null, high: null },
        fixtures: [fixture({ fdr: 1 })],
      }),
    );
    expect(result.xp).toBe(0);
  });

  it('XP-EX-05b: missing bucket falls back to mean of known buckets', () => {
    // No HIGH data; known buckets average to (4.0 + 6.0)/2 = 5.0.
    // (0.1 + 0.5) × 5.0 = 3.0
    const result = calculatePlayerXp(
      playerInput({
        confidencePct: 50,
        averages: { low: 4.0, mid: 6.0, high: null },
        fixtures: [fixture({ fdr: 5 })],
      }),
    );
    expect(result.xp).toBe(3.0);
  });

  it('XP-EX-06: FDR=2 boundary uses LOW bucket, not MID', () => {
    // (0.1 + 0.5) × 4.0 = 2.4 (uses low=4.0, not mid=9.9)
    const result = calculatePlayerXp(
      playerInput({
        confidencePct: 50,
        averages: { low: 4.0, mid: 9.9, high: null },
        fixtures: [fixture({ fdr: 2 })],
      }),
    );
    expect(result.xp).toBe(2.4);
  });

  it('XP-EX-07: FDR=4 boundary uses HIGH bucket, not MID', () => {
    // (0.1 + 0.5) × 3.0 = 1.8 (uses high=3.0, not mid=9.9)
    const result = calculatePlayerXp(
      playerInput({
        confidencePct: 50,
        averages: { low: null, mid: 9.9, high: 3.0 },
        fixtures: [fixture({ fdr: 4 })],
      }),
    );
    expect(result.xp).toBe(1.8);
  });

  it('XP-EX-08: double gameweek (two LOW fixtures)', () => {
    // 2 × (0.1 + 0.6) × 4.0 = 2 × 2.8 = 5.6
    const result = calculatePlayerXp(
      playerInput({
        confidencePct: 60,
        averages: { low: 4.0, mid: null, high: null },
        fixtures: [fixture({ gameweek: 36, fdr: 2 }), fixture({ gameweek: 36, fdr: 1 })],
      }),
    );
    expect(result.xp).toBe(5.6);
    expect(result.fixtureCount).toBe(2);
  });

  it('XP-EX-09: mixed-difficulty double gameweek', () => {
    // (0.1 + 0.8) × 4.0 + (0.1 + 0.8) × 2.0 = 3.6 + 1.8 = 5.4
    const result = calculatePlayerXp(
      playerInput({
        confidencePct: 80,
        averages: { low: 4.0, mid: null, high: 2.0 },
        fixtures: [fixture({ fdr: 1 }), fixture({ fdr: 5 })],
      }),
    );
    expect(result.xp).toBe(5.4);
    expect(result.fixtureCount).toBe(2);
  });

  it('XP-EX-10: blank gameweek yields zero', () => {
    const result = calculatePlayerXp(
      playerInput({
        confidencePct: 99,
        averages: { low: 4.0, mid: 5.0, high: 3.0 },
        fixtures: [],
      }),
    );
    expect(result.xp).toBe(0);
    expect(result.fixtureCount).toBe(0);
  });

  it('XP-EX-11: rounds to two decimals', () => {
    // (0.1 + 0.33) × 4.7 = 0.43 × 4.7 = 2.021 → 2.02
    const result = calculatePlayerXp(
      playerInput({
        confidencePct: 33,
        averages: { low: null, mid: 4.7, high: null },
        fixtures: [fixture({ fdr: 3 })],
      }),
    );
    expect(result.xp).toBe(2.02);
  });
});

// ── calculateTeamXp — worked examples ────────────────────────────────────────

describe('calculateTeamXp — worked examples', () => {
  it('XP-EX-12: 11 identical starters sum to team xP', () => {
    const picks: StarterXpInput[] = Array.from({ length: 11 }, (_, i) =>
      starter({
        playerId: i + 1,
        squadPosition: i + 1,
        confidencePct: 50,
        averages: { low: 4.0, mid: null, high: null },
        fixtures: [fixture({ fdr: 2 })],
      }),
    );
    const result = calculateTeamXp({ picks });
    // 11 × 2.4 = 26.4
    expect(result.teamXp).toBe(26.4);
    expect(result.perPlayer).toHaveLength(11);
  });

  it('XP-EX-13: bench picks (squadPosition > 11) are ignored', () => {
    const starters: StarterXpInput[] = Array.from({ length: 11 }, (_, i) =>
      starter({
        playerId: i + 1,
        squadPosition: i + 1,
        confidencePct: 50,
        averages: { low: 4.0, mid: null, high: null },
        fixtures: [fixture({ fdr: 2 })],
      }),
    );
    const bench: StarterXpInput[] = Array.from({ length: 4 }, (_, i) =>
      starter({
        playerId: 100 + i,
        squadPosition: 12 + i,
        confidencePct: 100,
        averages: { low: 10.0, mid: 10.0, high: 10.0 },
        fixtures: [fixture({ fdr: 1 }), fixture({ fdr: 1 })],
      }),
    );
    const result = calculateTeamXp({ picks: [...starters, ...bench] });
    expect(result.teamXp).toBe(26.4);
    expect(result.perPlayer).toHaveLength(11);
  });
});

// ── Edge cases ────────────────────────────────────────────────────────────────

describe('calculatePlayerXp — edge cases', () => {
  it('XP-EX-14: 0% confidence + non-zero avg ≠ 0 (scales with avg)', () => {
    // (0.1 + 0) × 5.0 = 0.5 — there is no constant floor; baseline scales with avg.
    const result = calculatePlayerXp(
      playerInput({
        confidencePct: 0,
        averages: { low: 4.0, mid: 5.0, high: 6.0 },
        fixtures: [fixture({ fdr: 3 })],
      }),
    );
    expect(result.xp).toBe(0.5);
  });

  it('treats bucket avg of exactly 0 as data, not missing', () => {
    // A player who literally averages 0 in LOW fixtures projects 0 — no fallback.
    const result = calculatePlayerXp(
      playerInput({
        confidencePct: 50,
        averages: { low: 0, mid: null, high: null },
        fixtures: [fixture({ fdr: 1 })],
      }),
    );
    expect(result.xp).toBe(0);
  });
});

// ── Property tests ────────────────────────────────────────────────────────────

describe('calculatePlayerXp — properties', () => {
  it('XP-PROP-01: per-fixture xP scales linearly with confidence', () => {
    // For a fixed avg, (0.1 + p) × avg is monotonic in p.
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 50 }),
        fc.integer({ min: 51, max: 100 }),
        fc.double({ min: 0.01, max: 20, noNaN: true }),
        fc.integer({ min: 1, max: 5 }),
        (lowPct, highPct, avg, fdr) => {
          const lo = calculatePlayerXp(
            playerInput({
              confidencePct: lowPct,
              averages: { low: avg, mid: avg, high: avg },
              fixtures: [fixture({ fdr })],
            }),
          );
          const hi = calculatePlayerXp(
            playerInput({
              confidencePct: highPct,
              averages: { low: avg, mid: avg, high: avg },
              fixtures: [fixture({ fdr })],
            }),
          );
          expect(hi.xp).toBeGreaterThanOrEqual(lo.xp);
        },
      ),
    );
  });

  it('XP-PROP-02: team xP equals sum of starter xPs (within rounding)', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            confidencePct: fc.integer({ min: 0, max: 100 }),
            fdr: fc.integer({ min: 1, max: 5 }),
            avg: fc.double({ min: 0, max: 10, noNaN: true }),
          }),
          { minLength: 11, maxLength: 11 },
        ),
        (specs) => {
          const picks: StarterXpInput[] = specs.map((s, i) =>
            starter({
              playerId: i + 1,
              squadPosition: i + 1,
              confidencePct: s.confidencePct,
              averages: { low: s.avg, mid: s.avg, high: s.avg },
              fixtures: [fixture({ fdr: s.fdr })],
            }),
          );
          const team = calculateTeamXp({ picks });
          const sum = team.perPlayer.reduce((acc, p) => acc + p.xp, 0);
          // Team xP is rounded; per-player sum may differ by at most 0.01 in the
          // last position due to the final round.
          expect(Math.abs(team.teamXp - sum)).toBeLessThanOrEqual(0.01);
        },
      ),
    );
  });

  it('XP-PROP-03: bench inputs never affect team xP', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            confidencePct: fc.integer({ min: 0, max: 100 }),
            fdr: fc.integer({ min: 1, max: 5 }),
            avg: fc.double({ min: 0, max: 10, noNaN: true }),
          }),
          { minLength: 4, maxLength: 4 },
        ),
        (benchSpecs) => {
          const starters: StarterXpInput[] = Array.from({ length: 11 }, (_, i) =>
            starter({
              playerId: i + 1,
              squadPosition: i + 1,
              confidencePct: 50,
              averages: { low: 4, mid: 5, high: 3 },
              fixtures: [fixture({ fdr: 3 })],
            }),
          );
          const bench: StarterXpInput[] = benchSpecs.map((s, i) =>
            starter({
              playerId: 100 + i,
              squadPosition: 12 + i,
              confidencePct: s.confidencePct,
              averages: { low: s.avg, mid: s.avg, high: s.avg },
              fixtures: [fixture({ fdr: s.fdr })],
            }),
          );
          const baseline = calculateTeamXp({ picks: starters });
          const withBench = calculateTeamXp({ picks: [...starters, ...bench] });
          expect(withBench.teamXp).toBe(baseline.teamXp);
        },
      ),
    );
  });
});
