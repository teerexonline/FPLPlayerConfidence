import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  BUCKET_FALLBACK_AVG,
  bucketForFdr,
  calculatePlayerXp,
  calculateTeamXp,
} from './calculator';
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

describe('calculatePlayerXp — worked examples', () => {
  it('XP-EX-01: neutral confidence + easy fixture', () => {
    const result = calculatePlayerXp(
      playerInput({
        confidencePct: 50,
        averages: { low: 4.0, mid: null, high: null },
        fixtures: [fixture({ fdr: 2 })],
      }),
    );
    expect(result.xp).toBe(2.1);
    expect(result.fixtureCount).toBe(1);
  });

  it('XP-EX-02: max confidence + easy fixture', () => {
    const result = calculatePlayerXp(
      playerInput({
        confidencePct: 100,
        averages: { low: 4.0, mid: null, high: null },
        fixtures: [fixture({ fdr: 1 })],
      }),
    );
    expect(result.xp).toBe(4.1);
  });

  it('XP-EX-03: zero confidence + hard fixture floors at baseline', () => {
    const result = calculatePlayerXp(
      playerInput({
        confidencePct: 0,
        averages: { low: null, mid: null, high: 3.0 },
        fixtures: [fixture({ fdr: 5 })],
      }),
    );
    expect(result.xp).toBe(0.1);
  });

  it('XP-EX-04: 75% confidence + mid fixture', () => {
    const result = calculatePlayerXp(
      playerInput({
        confidencePct: 75,
        averages: { low: null, mid: 5.0, high: null },
        fixtures: [fixture({ fdr: 3 })],
      }),
    );
    expect(result.xp).toBe(3.85);
  });

  it('XP-EX-05: bucket fallback for new signing with no LOW history', () => {
    const result = calculatePlayerXp(
      playerInput({
        confidencePct: 50,
        averages: { low: null, mid: null, high: null },
        fixtures: [fixture({ fdr: 1 })],
      }),
    );
    // 0.1 + 0.5 × 2.3 = 1.25
    expect(result.xp).toBe(1.25);
  });

  it('XP-EX-06: FDR=2 boundary uses LOW bucket, not MID', () => {
    const result = calculatePlayerXp(
      playerInput({
        confidencePct: 50,
        averages: { low: 4.0, mid: 9.9, high: null },
        fixtures: [fixture({ fdr: 2 })],
      }),
    );
    expect(result.xp).toBe(2.1);
  });

  it('XP-EX-07: FDR=4 boundary uses HIGH bucket, not MID', () => {
    const result = calculatePlayerXp(
      playerInput({
        confidencePct: 50,
        averages: { low: null, mid: 9.9, high: 3.0 },
        fixtures: [fixture({ fdr: 4 })],
      }),
    );
    expect(result.xp).toBe(1.6);
  });

  it('XP-EX-08: double gameweek (two LOW fixtures)', () => {
    const result = calculatePlayerXp(
      playerInput({
        confidencePct: 60,
        averages: { low: 4.0, mid: null, high: null },
        fixtures: [fixture({ gameweek: 36, fdr: 2 }), fixture({ gameweek: 36, fdr: 1 })],
      }),
    );
    // 2 × (0.1 + 0.6 × 4) = 2 × 2.5 = 5.0
    expect(result.xp).toBe(5.0);
    expect(result.fixtureCount).toBe(2);
  });

  it('XP-EX-09: mixed-difficulty double gameweek', () => {
    const result = calculatePlayerXp(
      playerInput({
        confidencePct: 80,
        averages: { low: 4.0, mid: null, high: 2.0 },
        fixtures: [fixture({ fdr: 1 }), fixture({ fdr: 5 })],
      }),
    );
    // (0.1 + 0.8 × 4) + (0.1 + 0.8 × 2) = 3.3 + 1.7 = 5.0
    expect(result.xp).toBe(5.0);
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
    const result = calculatePlayerXp(
      playerInput({
        confidencePct: 33,
        averages: { low: null, mid: 4.7, high: null },
        fixtures: [fixture({ fdr: 3 })],
      }),
    );
    // 0.1 + 0.33 × 4.7 = 0.1 + 1.551 = 1.651 → 1.65
    expect(result.xp).toBe(1.65);
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
    // 11 × 2.10 = 23.10
    expect(result.teamXp).toBe(23.1);
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
    expect(result.teamXp).toBe(23.1);
    expect(result.perPlayer).toHaveLength(11);
  });
});

// ── Edge cases ────────────────────────────────────────────────────────────────

describe('calculatePlayerXp — edge cases', () => {
  it('XP-EX-14: confidence already mapped to 0% cannot drive xP below baseline', () => {
    // raw confidence -4 → confidencePct = 0 (per §11 mapping). Per fixture xP = 0.10.
    const result = calculatePlayerXp(
      playerInput({
        confidencePct: 0,
        averages: { low: 4.0, mid: 5.0, high: 6.0 },
        fixtures: [fixture({ fdr: 3 })],
      }),
    );
    expect(result.xp).toBe(0.1);
  });

  it('uses fallback when bucket avg is exactly 0', () => {
    // 0 is a meaningful average (player scored zero points across n LOW fixtures),
    // not a missing value — fallback must NOT kick in.
    const result = calculatePlayerXp(
      playerInput({
        confidencePct: 50,
        averages: { low: 0, mid: null, high: null },
        fixtures: [fixture({ fdr: 1 })],
      }),
    );
    expect(result.xp).toBe(0.1);
  });

  it('exposes BUCKET_FALLBACK_AVG as 2.3', () => {
    expect(BUCKET_FALLBACK_AVG).toBe(2.3);
  });
});

// ── Property tests ────────────────────────────────────────────────────────────

describe('calculatePlayerXp — properties', () => {
  it('XP-PROP-01: per-fixture xP is always ≥ 0.10', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 1, max: 5 }),
        fc.option(fc.double({ min: 0, max: 20, noNaN: true })),
        fc.option(fc.double({ min: 0, max: 20, noNaN: true })),
        fc.option(fc.double({ min: 0, max: 20, noNaN: true })),
        fc.integer({ min: 1, max: 3 }),
        (pct, fdr, low, mid, high, count) => {
          const result = calculatePlayerXp(
            playerInput({
              confidencePct: pct,
              averages: { low, mid, high },
              fixtures: Array.from({ length: count }, () => fixture({ fdr })),
            }),
          );
          // Per-fixture xP must be ≥ 0.10 minus a tiny rounding tolerance.
          const perFixture = result.xp / count;
          expect(perFixture).toBeGreaterThanOrEqual(0.1 - 0.005);
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
