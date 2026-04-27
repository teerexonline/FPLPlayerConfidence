import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { calculateConfidence, roundAwayFromZero } from '.';
import type { CalculatorInput, MatchEvent, Position } from '.';
import { aMatch } from './__fixtures__/matches';

// ── roundAwayFromZero — direct unit tests ─────────────────────────────────

describe('roundAwayFromZero', () => {
  it('+0.5 rounds to +1 (away from zero, not toward +∞)', () => {
    expect(roundAwayFromZero(0.5)).toBe(1);
  });

  it('-0.5 rounds to -1 (away from zero, not toward +∞ like Math.round would)', () => {
    expect(roundAwayFromZero(-0.5)).toBe(-1);
  });

  it('+2.5 rounds to +3', () => {
    expect(roundAwayFromZero(2.5)).toBe(3);
  });

  it('-2.5 rounds to -3', () => {
    expect(roundAwayFromZero(-2.5)).toBe(-3);
  });

  it('integers are unchanged', () => {
    expect(roundAwayFromZero(2)).toBe(2);
    expect(roundAwayFromZero(-2)).toBe(-2);
    expect(roundAwayFromZero(0)).toBe(0);
  });

  it('non-half fractions round normally', () => {
    expect(roundAwayFromZero(1.25)).toBe(1);
    expect(roundAwayFromZero(-1.25)).toBe(-1);
    expect(roundAwayFromZero(0.75)).toBe(1);
    expect(roundAwayFromZero(-0.75)).toBe(-1);
  });
});

// ── calculateConfidence — worked examples ─────────────────────────────────

describe('calculateConfidence', () => {
  // ── MID / FWD scoring ──────────────────────────────────────────────────

  it('EX-01: MOTM vs FDR 5 — base +2 × 1.5 = 3.0 → +3 (MID)', () => {
    const input: CalculatorInput = {
      position: 'MID',
      matches: [aMatch({ goals: 2, opponentFdr: 5 })],
    };

    const result = calculateConfidence(input);

    expect(result.finalConfidence).toBe(3);
    expect(result.history[0]).toMatchObject({
      delta: 3,
      reason: 'MOTM vs FDR 5 opponent',
      fatigueApplied: false,
      confidenceAfter: 3,
      motmCounterAfter: 1,
    });
  });

  it('EX-02: Performance vs FDR 1 — base +1 × 0.5 = 0.5 → +1 (MID)', () => {
    const input: CalculatorInput = {
      position: 'MID',
      matches: [aMatch({ assists: 1, opponentFdr: 1, minutesPlayed: 85 })],
    };

    const result = calculateConfidence(input);

    expect(result.finalConfidence).toBe(1);
    expect(result.history[0]).toMatchObject({
      delta: 1,
      reason: 'Performance vs FDR 1 opponent',
      fatigueApplied: false,
      confidenceAfter: 1,
      motmCounterAfter: 0,
    });
  });

  it('EX-02b: Performance vs FDR 5 — base +1 × 1.5 = 1.5 → +2 (MID)', () => {
    const input: CalculatorInput = {
      position: 'MID',
      matches: [aMatch({ assists: 1, opponentFdr: 5 })],
    };

    const result = calculateConfidence(input);

    expect(result.finalConfidence).toBe(2);
    expect(result.history[0]).toMatchObject({
      delta: 2,
      reason: 'Performance vs FDR 5 opponent',
      fatigueApplied: false,
      confidenceAfter: 2,
      motmCounterAfter: 0,
    });
  });

  it('EX-03: Blank vs FDR 5 — base −1 × 0.5 = −0.5 → −1 (FWD)', () => {
    const input: CalculatorInput = {
      position: 'FWD',
      matches: [aMatch({ opponentFdr: 5 })],
    };

    const result = calculateConfidence(input);

    expect(result.finalConfidence).toBe(-1);
    expect(result.history[0]).toMatchObject({
      delta: -1,
      reason: 'Blank vs FDR 5 opponent',
      fatigueApplied: false,
      confidenceAfter: -1,
      motmCounterAfter: 0,
    });
  });

  it('EX-12: 2 assists qualifies as MOTM — base +2 × 1.0 = +2 (MID, FDR 3)', () => {
    const input: CalculatorInput = {
      position: 'MID',
      matches: [aMatch({ assists: 2 })], // default FDR 3
    };

    const result = calculateConfidence(input);

    expect(result.finalConfidence).toBe(2);
    expect(result.history[0]).toMatchObject({
      delta: 2,
      reason: 'MOTM vs FDR 3 opponent',
      fatigueApplied: false,
      confidenceAfter: 2,
      motmCounterAfter: 1,
    });
  });

  // ── GK / DEF scoring ───────────────────────────────────────────────────

  it('EX-04: Clean sheet vs FDR 2 — base +1 × 0.75 = 0.75 → +1 (DEF)', () => {
    const input: CalculatorInput = {
      position: 'DEF',
      matches: [aMatch({ cleanSheet: true, opponentFdr: 2 })],
    };

    const result = calculateConfidence(input);

    expect(result.finalConfidence).toBe(1);
    expect(result.history[0]).toMatchObject({
      delta: 1,
      reason: 'Clean sheet vs FDR 2 opponent',
      fatigueApplied: false,
      confidenceAfter: 1,
      motmCounterAfter: 0,
    });
  });

  it('EX-05: DEF assist vs FDR 5 — base +2 × 1.5 = 3.0 → +3 (MOTM)', () => {
    const input: CalculatorInput = {
      position: 'DEF',
      matches: [aMatch({ assists: 1, opponentFdr: 5 })],
    };

    const result = calculateConfidence(input);

    expect(result.finalConfidence).toBe(3);
    expect(result.history[0]).toMatchObject({
      delta: 3,
      reason: 'Assist vs FDR 5 opponent (MOTM)',
      fatigueApplied: false,
      confidenceAfter: 3,
      motmCounterAfter: 1,
    });
  });

  it('EX-05b: DEF goal vs FDR 2 — base +2 × 0.75 = 1.5 → +2 (MOTM)', () => {
    const input: CalculatorInput = {
      position: 'DEF',
      matches: [aMatch({ goals: 1, opponentFdr: 2 })],
    };

    const result = calculateConfidence(input);

    expect(result.finalConfidence).toBe(2);
    expect(result.history[0]).toMatchObject({
      delta: 2,
      reason: 'MOTM vs FDR 2 opponent',
      fatigueApplied: false,
      confidenceAfter: 2,
      motmCounterAfter: 1,
    });
  });

  it('EX-06: DEF goal + CS vs FDR 5 — (2×1.5)+(1×1.5) = 4.5 → +5', () => {
    const input: CalculatorInput = {
      position: 'DEF',
      matches: [aMatch({ goals: 1, opponentFdr: 5, cleanSheet: true })],
    };

    const result = calculateConfidence(input);

    expect(result.finalConfidence).toBe(5);
    expect(result.history[0]).toMatchObject({
      delta: 5,
      reason: 'MOTM vs FDR 5 opponent + Clean sheet vs FDR 5 opponent',
      fatigueApplied: false,
      confidenceAfter: 5,
      motmCounterAfter: 1,
    });
  });

  it('EX-11: GK CS vs FDR 5 — base +1 × 1.5 = 1.5 → +2', () => {
    const input: CalculatorInput = {
      position: 'GK',
      matches: [aMatch({ opponentFdr: 5, cleanSheet: true })],
    };

    const result = calculateConfidence(input);

    expect(result.finalConfidence).toBe(2);
    expect(result.history[0]).toMatchObject({
      delta: 2,
      reason: 'Clean sheet vs FDR 5 opponent',
      fatigueApplied: false,
      confidenceAfter: 2,
      motmCounterAfter: 0,
    });
  });

  it('EX-13: DEF blank vs FDR 5 — base −1 × 0.5 = −0.5 → −1', () => {
    const input: CalculatorInput = {
      position: 'DEF',
      matches: [aMatch({ opponentFdr: 5 })],
    };

    const result = calculateConfidence(input);

    expect(result.finalConfidence).toBe(-1);
    expect(result.history[0]).toMatchObject({
      delta: -1,
      reason: 'Blank vs FDR 5 opponent',
      fatigueApplied: false,
      confidenceAfter: -1,
      motmCounterAfter: 0,
    });
  });

  it('EX-13b: DEF blank vs FDR 2 — base −1 × 1.25 = −1.25 → −1', () => {
    const input: CalculatorInput = {
      position: 'DEF',
      matches: [aMatch({ opponentFdr: 2 })],
    };

    const result = calculateConfidence(input);

    expect(result.finalConfidence).toBe(-1);
    expect(result.history[0]).toMatchObject({
      delta: -1,
      reason: 'Blank vs FDR 2 opponent',
      fatigueApplied: false,
      confidenceAfter: -1,
      motmCounterAfter: 0,
    });
  });

  it('EX-13c: GK blank vs FDR 2 — base −1 × 1.25 = −1.25 → −1', () => {
    const input: CalculatorInput = {
      position: 'GK',
      matches: [aMatch({ opponentFdr: 2 })],
    };

    const result = calculateConfidence(input);

    expect(result.finalConfidence).toBe(-1);
    expect(result.history[0]).toMatchObject({
      delta: -1,
      reason: 'Blank vs FDR 2 opponent',
      fatigueApplied: false,
      confidenceAfter: -1,
      motmCounterAfter: 0,
    });
  });

  it('EX-15: DEF assist + goal in same match — assist branch fires once (FDR 3)', () => {
    const input: CalculatorInput = {
      position: 'DEF',
      matches: [aMatch({ goals: 1, assists: 1 })], // default FDR 3
    };

    const result = calculateConfidence(input);

    expect(result.finalConfidence).toBe(2);
    expect(result.history[0]).toMatchObject({
      delta: 2,
      reason: 'Assist vs FDR 3 opponent (MOTM)',
      fatigueApplied: false,
      confidenceAfter: 2,
      motmCounterAfter: 1,
    });
  });

  // ── Fatigue modifier ───────────────────────────────────────────────────

  it('EX-07: −2 fatigue fires after 3rd cumulative MOTM and resets counter (FDR 3)', () => {
    // GW1: +2 → conf=2, motm=1
    // GW2: +2 → conf=4, motm=2
    // GW3: MOTM +2 → confidenceAfterMotm = clamp(4+2)=5; fatigue fires;
    //       hypotheticalPostFatigue = 5+(−2) = 3 > 0 → applied → conf=3, delta=−1, motm=0
    const input: CalculatorInput = {
      position: 'FWD',
      matches: [
        aMatch({ gameweek: 1, goals: 1 }), // default FDR 3
        aMatch({ gameweek: 2, goals: 1 }),
        aMatch({ gameweek: 3, goals: 1 }),
      ],
    };

    const result = calculateConfidence(input);

    expect(result.finalConfidence).toBe(3);
    expect(result.history[0]).toMatchObject({
      confidenceAfter: 2,
      motmCounterAfter: 1,
      fatigueApplied: false,
    });
    expect(result.history[1]).toMatchObject({
      confidenceAfter: 4,
      motmCounterAfter: 2,
      fatigueApplied: false,
    });
    expect(result.history[2]).toMatchObject({
      confidenceAfter: 3,
      delta: -1,
      motmCounterAfter: 0,
      fatigueApplied: true,
    });
  });

  // ── Clamping ───────────────────────────────────────────────────────────

  it('EX-08: clamps at +5 — 4× Performance (FDR 3) reaches +4, then MOTM vs FDR 5 would hit +7', () => {
    // Four performances (1 assist, FDR 3) → +1 each → conf=+4, motmCount=0
    // Fifth match: MOTM vs FDR 5 → +3 → 4+3=7 → clamped to 5, delta=+1
    const performances = [1, 2, 3, 4].map(
      (gw) => aMatch({ gameweek: gw, assists: 1 }), // default FDR 3
    );
    const input: CalculatorInput = {
      position: 'MID',
      matches: [...performances, aMatch({ gameweek: 5, goals: 1, opponentFdr: 5 })],
    };

    const result = calculateConfidence(input);

    expect(result.finalConfidence).toBe(5);
    expect(result.history[4]).toMatchObject({ confidenceAfter: 5, delta: 1 });
  });

  it('EX-09: clamps at −4 — blanks vs FDR 1/5/1 bring FWD from 0 to −4', () => {
    // GW1: blank vs FDR 1 → base −1 × 1.5 = −1.5 → −2  → conf=−2
    // GW2: blank vs FDR 5 → base −1 × 0.5 = −0.5 → −1  → conf=−3
    // GW3: blank vs FDR 1 → base −1 × 1.5 = −1.5 → −2 → would be −5 → clamp −4, delta=−1
    const input: CalculatorInput = {
      position: 'FWD',
      matches: [
        aMatch({ gameweek: 1, opponentFdr: 1 }),
        aMatch({ gameweek: 2, opponentFdr: 5 }),
        aMatch({ gameweek: 3, opponentFdr: 1 }),
      ],
    };

    const result = calculateConfidence(input);

    expect(result.finalConfidence).toBe(-4);
    expect(result.history[2]).toMatchObject({ confidenceAfter: -4, delta: -1 });
  });

  it('EX-14: clamp + fatigue when confidence already at ceiling (FDR 5)', () => {
    // GW1: MOTM FDR 5 → +3 → conf=3, motm=1
    // GW2: MOTM FDR 5 → +3 → 3+3=6 → conf=5 (clamped), motm=2
    // GW3: MOTM FDR 5 → confidenceAfterMotm = clamp(5+3)=5;
    //       fatigue fires; hypotheticalPostFatigue = 5+(−2) = 3 > 0 → applied → conf=3, delta=−2
    const input: CalculatorInput = {
      position: 'MID',
      matches: [
        aMatch({ gameweek: 1, goals: 1, opponentFdr: 5 }),
        aMatch({ gameweek: 2, goals: 1, opponentFdr: 5 }),
        aMatch({ gameweek: 3, goals: 1, opponentFdr: 5 }),
      ],
    };

    const result = calculateConfidence(input);

    expect(result.finalConfidence).toBe(3);
    expect(result.history[2]).toMatchObject({
      confidenceAfter: 3,
      delta: -2,
      fatigueApplied: true,
      motmCounterAfter: 0,
    });
  });

  // ── Edge cases ─────────────────────────────────────────────────────────

  it('EX-10: empty match list → finalConfidence=0 and empty history', () => {
    const result = calculateConfidence({ position: 'MID', matches: [] });

    expect(result.finalConfidence).toBe(0);
    expect(result.history).toHaveLength(0);
  });

  // ── DefCon (Defensive Contribution) ───────────────────────────────────────

  it('EX-16: MID DefCon-only vs FDR 3 → flat +1, blank prevented', () => {
    const input: CalculatorInput = {
      position: 'MID',
      matches: [aMatch({ defensiveContribution: 12 })], // threshold=12 exactly met, default FDR 3
    };

    const result = calculateConfidence(input);

    expect(result.finalConfidence).toBe(1);
    expect(result.history[0]).toMatchObject({
      delta: 1,
      reason: 'DefCon vs FDR 3 opponent',
      fatigueApplied: false,
      confidenceAfter: 1,
      motmCounterAfter: 0,
    });
  });

  it('EX-17: MID blank (DefCon NOT met) vs FDR 3 → base −1 × 1.0 = −1', () => {
    // Old binary system penalised "non-big" blanks at −2. FDR 3 (neutral) gives −1.
    const input: CalculatorInput = {
      position: 'MID',
      matches: [aMatch({ defensiveContribution: 8 })], // 8 < 12 threshold, default FDR 3
    };

    const result = calculateConfidence(input);

    expect(result.finalConfidence).toBe(-1);
    expect(result.history[0]).toMatchObject({
      delta: -1,
      reason: 'Blank vs FDR 3 opponent',
      fatigueApplied: false,
      confidenceAfter: -1,
      motmCounterAfter: 0,
    });
  });

  it('EX-18: MID Performance + DefCon vs FDR 5 — Performance fires, DefCon silent', () => {
    // Performance: base +1 × 1.5 = 1.5 → +2
    const input: CalculatorInput = {
      position: 'MID',
      matches: [aMatch({ assists: 1, opponentFdr: 5, defensiveContribution: 12 })],
    };

    const result = calculateConfidence(input);

    expect(result.finalConfidence).toBe(2);
    expect(result.history[0]).toMatchObject({
      delta: 2,
      reason: 'Performance vs FDR 5 opponent',
      fatigueApplied: false,
      confidenceAfter: 2,
      motmCounterAfter: 0,
    });
  });

  it('EX-19: DEF CS + DefCon vs FDR 2 — CS fires (+0.75 → +1), DefCon silent', () => {
    const input: CalculatorInput = {
      position: 'DEF',
      matches: [aMatch({ cleanSheet: true, defensiveContribution: 10, opponentFdr: 2 })],
    };

    const result = calculateConfidence(input);

    expect(result.finalConfidence).toBe(1);
    expect(result.history[0]).toMatchObject({
      delta: 1,
      reason: 'Clean sheet vs FDR 2 opponent',
      fatigueApplied: false,
      confidenceAfter: 1,
      motmCounterAfter: 0,
    });
  });

  it('EX-19b: DEF DefCon-only vs FDR 2 — blank prevented, flat +1', () => {
    const input: CalculatorInput = {
      position: 'DEF',
      matches: [aMatch({ cleanSheet: false, defensiveContribution: 10, opponentFdr: 2 })],
    };

    const result = calculateConfidence(input);

    expect(result.finalConfidence).toBe(1);
    expect(result.history[0]).toMatchObject({
      delta: 1,
      reason: 'DefCon vs FDR 2 opponent',
      fatigueApplied: false,
      confidenceAfter: 1,
      motmCounterAfter: 0,
    });
  });

  it('EX-19c: DEF assist + high DefCon vs FDR 2 — Assist fires (+1.5 → +2), DefCon silent', () => {
    const input: CalculatorInput = {
      position: 'DEF',
      matches: [
        aMatch({ assists: 1, cleanSheet: false, defensiveContribution: 15, opponentFdr: 2 }),
      ],
    };

    const result = calculateConfidence(input);

    expect(result.finalConfidence).toBe(2);
    expect(result.history[0]).toMatchObject({
      delta: 2,
      reason: 'Assist vs FDR 2 opponent (MOTM)',
      fatigueApplied: false,
      confidenceAfter: 2,
      motmCounterAfter: 1,
    });
  });

  it('EX-20: MID MOTM + DefCon vs FDR 3 — MOTM fires, DefCon absorbed', () => {
    const input: CalculatorInput = {
      position: 'MID',
      matches: [aMatch({ assists: 2, defensiveContribution: 12 })], // default FDR 3
    };

    const result = calculateConfidence(input);

    expect(result.finalConfidence).toBe(2);
    expect(result.history[0]).toMatchObject({
      delta: 2,
      reason: 'MOTM vs FDR 3 opponent',
      fatigueApplied: false,
      confidenceAfter: 2,
      motmCounterAfter: 1,
    });
  });

  it('EX-21: GK DefCon never fires — high defensiveContribution still gives blank (FDR 3)', () => {
    const input: CalculatorInput = {
      position: 'GK',
      matches: [aMatch({ defensiveContribution: 15 })], // default FDR 3
    };

    const result = calculateConfidence(input);

    expect(result.finalConfidence).toBe(-1);
    expect(result.history[0]).toMatchObject({
      delta: -1,
      reason: 'Blank vs FDR 3 opponent',
      fatigueApplied: false,
      confidenceAfter: -1,
      motmCounterAfter: 0,
    });
  });

  it('EX-22: DEF defensiveContribution=9 (below threshold=10) → blank (FDR 3)', () => {
    const input: CalculatorInput = {
      position: 'DEF',
      matches: [aMatch({ defensiveContribution: 9 })], // default FDR 3
    };

    const result = calculateConfidence(input);

    expect(result.finalConfidence).toBe(-1);
    expect(result.history[0]).toMatchObject({
      delta: -1,
      reason: 'Blank vs FDR 3 opponent',
    });
  });

  it('EX-23: DEF defensiveContribution=10 (exactly at threshold=10) → DefCon fires (FDR 3)', () => {
    const input: CalculatorInput = {
      position: 'DEF',
      matches: [aMatch({ defensiveContribution: 10 })], // default FDR 3
    };

    const result = calculateConfidence(input);

    expect(result.finalConfidence).toBe(1);
    expect(result.history[0]).toMatchObject({
      delta: 1,
      reason: 'DefCon vs FDR 3 opponent',
      fatigueApplied: false,
      confidenceAfter: 1,
      motmCounterAfter: 0,
    });
  });

  // ── New FDR examples (EX-24 through EX-28) ────────────────────────────

  it('EX-24: MID blank vs FDR 3 — neutral multiplier × 1.0 has no effect', () => {
    const input: CalculatorInput = {
      position: 'MID',
      matches: [aMatch({ opponentFdr: 3 })], // explicit for clarity
    };

    const result = calculateConfidence(input);

    expect(result.finalConfidence).toBe(-1);
    expect(result.history[0]).toMatchObject({
      delta: -1,
      reason: 'Blank vs FDR 3 opponent',
      confidenceAfter: -1,
      motmCounterAfter: 0,
    });
  });

  it('EX-25: FWD MOTM vs FDR 1 — easier fixture: base +2 × 0.5 = 1.0 → +1', () => {
    const input: CalculatorInput = {
      position: 'FWD',
      matches: [aMatch({ goals: 1, opponentFdr: 1 })],
    };

    const result = calculateConfidence(input);

    expect(result.finalConfidence).toBe(1);
    expect(result.history[0]).toMatchObject({
      delta: 1,
      reason: 'MOTM vs FDR 1 opponent',
      confidenceAfter: 1,
      motmCounterAfter: 1,
    });
  });

  it('EX-26: DEF blank vs FDR 1 — must-perform fixture: base −1 × 1.5 = −1.5 → −2', () => {
    const input: CalculatorInput = {
      position: 'DEF',
      matches: [aMatch({ opponentFdr: 1 })],
    };

    const result = calculateConfidence(input);

    expect(result.finalConfidence).toBe(-2);
    expect(result.history[0]).toMatchObject({
      delta: -2,
      reason: 'Blank vs FDR 1 opponent',
      confidenceAfter: -2,
      motmCounterAfter: 0,
    });
  });

  it('EX-27: GK CS vs FDR 5 — hardest fixture: base +1 × 1.5 = 1.5 → +2', () => {
    const input: CalculatorInput = {
      position: 'GK',
      matches: [aMatch({ cleanSheet: true, opponentFdr: 5 })],
    };

    const result = calculateConfidence(input);

    expect(result.finalConfidence).toBe(2);
    expect(result.history[0]).toMatchObject({
      delta: 2,
      reason: 'Clean sheet vs FDR 5 opponent',
      confidenceAfter: 2,
      motmCounterAfter: 0,
    });
  });

  it('EX-28: MID DefCon vs FDR 5 — flat +1, FDR multiplier NOT applied', () => {
    // Contrast: a blank at FDR 5 would be −1 × 0.5 = −0.5 → −1.
    // DefCon is always +1 regardless.
    const input: CalculatorInput = {
      position: 'MID',
      matches: [aMatch({ defensiveContribution: 12, opponentFdr: 5 })],
    };

    const result = calculateConfidence(input);

    expect(result.finalConfidence).toBe(1);
    expect(result.history[0]).toMatchObject({
      delta: 1,
      reason: 'DefCon vs FDR 5 opponent',
      confidenceAfter: 1,
      motmCounterAfter: 0,
    });
  });

  it('EX-29: GK SaveCon vs FDR 5 — saves=8, no CS, no G/A → flat +1', () => {
    const input: CalculatorInput = {
      position: 'GK',
      matches: [aMatch({ saves: 8, opponentFdr: 5 })],
    };

    const result = calculateConfidence(input);

    expect(result.finalConfidence).toBe(1);
    expect(result.history[0]).toMatchObject({
      delta: 1,
      reason: 'SaveCon vs FDR 5 opponent',
      confidenceAfter: 1,
      motmCounterAfter: 0,
    });
  });

  it('EX-30: GK CS fires, SaveCon silent — saves=8, CS=true, vs FDR 3', () => {
    const input: CalculatorInput = {
      position: 'GK',
      matches: [aMatch({ saves: 8, cleanSheet: true, opponentFdr: 3 })],
    };

    const result = calculateConfidence(input);

    expect(result.finalConfidence).toBe(1);
    expect(result.history[0]).toMatchObject({
      delta: 1,
      reason: 'Clean sheet vs FDR 3 opponent',
      confidenceAfter: 1,
      motmCounterAfter: 0,
    });
  });

  it('EX-31: GK saves=3 (below threshold=4), Blank fires — vs FDR 1: −1 × 1.5 = −1.5 → −2', () => {
    const input: CalculatorInput = {
      position: 'GK',
      matches: [aMatch({ saves: 3, opponentFdr: 1 })],
    };

    const result = calculateConfidence(input);

    expect(result.finalConfidence).toBe(-2);
    expect(result.history[0]).toMatchObject({
      delta: -2,
      reason: 'Blank vs FDR 1 opponent',
      confidenceAfter: -2,
      motmCounterAfter: 0,
    });
  });

  it('EX-32: GK saves=4 (exactly at threshold=4) → SaveCon fires (boundary ≥ not >)', () => {
    const input: CalculatorInput = {
      position: 'GK',
      matches: [aMatch({ saves: 4, opponentFdr: 1 })],
    };

    const result = calculateConfidence(input);

    expect(result.finalConfidence).toBe(1);
    expect(result.history[0]).toMatchObject({
      delta: 1,
      reason: 'SaveCon vs FDR 1 opponent',
      confidenceAfter: 1,
      motmCounterAfter: 0,
    });
  });

  it('EX-33: DEF with saves=8 — SaveCon never fires for DEF, Blank applies', () => {
    const input: CalculatorInput = {
      position: 'DEF',
      matches: [aMatch({ saves: 8, opponentFdr: 3 })],
    };

    const result = calculateConfidence(input);

    expect(result.finalConfidence).toBe(-1);
    expect(result.history[0]).toMatchObject({
      delta: -1,
      reason: 'Blank vs FDR 3 opponent',
      confidenceAfter: -1,
      motmCounterAfter: 0,
    });
  });

  // ── Fatigue waiver (EX-34–EX-38) ──────────────────────────────────────

  it('EX-34: fatigue waived — recovering player, post-MOTM still negative', () => {
    // before=−3, motmCount=2, MOTM FDR 3 → motmRaw=+2
    // confidenceAfterMotm = clamp(−3+2) = −1
    // hypotheticalPostFatigue = −1+(−2) = −3 ≤ 0 → waived
    // Direct state setup: need conf=−3, motmCount=2
    // Path: 2× MOTM FDR1 (+1 each) → conf=2, motm=2; then 5× blank FDR1 (−2 each):
    //   conf=2→0→−2→−4→−4→−4... clamped. Need different approach.
    // Use FDR3 blanks (−1 each) from conf=0 after 2 MOTMs:
    // 2× MOTM FDR1 → conf=2, motm=2 (each MOTM at FDR1 = +1)
    // 5× blank FDR3 → conf=2,1,0,−1,−2,−3  → conf=−3, motm still 2 (blanks don't reset counter)
    const cleanInput: CalculatorInput = {
      position: 'FWD',
      matches: [
        aMatch({ gameweek: 1, goals: 1, opponentFdr: 1 }), // MOTM FDR1 → +1 → conf=1, motm=1
        aMatch({ gameweek: 2, goals: 1, opponentFdr: 1 }), // MOTM FDR1 → +1 → conf=2, motm=2
        aMatch({ gameweek: 3 }), // blank FDR3 → −1 → conf=1
        aMatch({ gameweek: 4 }), // blank FDR3 → −1 → conf=0
        aMatch({ gameweek: 5 }), // blank FDR3 → −1 → conf=−1
        aMatch({ gameweek: 6 }), // blank FDR3 → −1 → conf=−2
        aMatch({ gameweek: 7 }), // blank FDR3 → −1 → conf=−3, motm still 2
        aMatch({ gameweek: 8, goals: 1 }), // MOTM FDR3 → confidenceAfterMotm=clamp(−3+2)=−1
        //  → hypotheticalPostFatigue=−3 ≤ 0 → waived
      ],
    };

    const result = calculateConfidence(cleanInput);

    expect(result.history[7]).toMatchObject({
      confidenceAfter: -1,
      delta: 2,
      reason: 'MOTM vs FDR 3 opponent + Fatigue waived',
      fatigueApplied: false,
      motmCounterAfter: 0,
    });
  });

  it('EX-35: fatigue applies — post-MOTM positive, post-fatigue also positive', () => {
    // before=+1, motmCount=2, MOTM FDR3 → confidenceAfterMotm=clamp(1+2)=3
    // hypotheticalPostFatigue=3+(−2)=1 > 0 → applied → conf=1, delta=0
    // GW1 MOTM→motm=1,conf=2; GW2 MOTM→motm=2,conf=4; GW3–5 blanks→conf=1; GW6 MOTM is trigger.
    const cleanInput: CalculatorInput = {
      position: 'FWD',
      matches: [
        aMatch({ gameweek: 1, goals: 1 }), // MOTM FDR3 → +2 → conf=2, motm=1
        aMatch({ gameweek: 2, goals: 1 }), // MOTM FDR3 → +2 → conf=4, motm=2
        aMatch({ gameweek: 3 }), // blank FDR3 → −1 → conf=3, motm=2
        aMatch({ gameweek: 4 }), // blank FDR3 → −1 → conf=2, motm=2
        aMatch({ gameweek: 5 }), // blank FDR3 → −1 → conf=1, motm=2
        aMatch({ gameweek: 6, goals: 1 }), // MOTM FDR3 → confidenceAfterMotm=clamp(1+2)=3
        //  → hypotheticalPostFatigue=3+(−2)=1 > 0 → applied → conf=1, delta=0
      ],
    };

    const result = calculateConfidence(cleanInput);

    expect(result.history[5]).toMatchObject({
      confidenceAfter: 1,
      delta: 0,
      reason: 'MOTM vs FDR 3 opponent + Fatigue −2',
      fatigueApplied: true,
      motmCounterAfter: 0,
    });
  });

  it('EX-36: fatigue waived — post-MOTM lands at exactly 0 (inclusive boundary)', () => {
    // before=−2, motmCount=2, MOTM FDR3 → confidenceAfterMotm=clamp(−2+2)=0
    // hypotheticalPostFatigue=0+(−2)=−2 ≤ 0 → waived (0 ≤ 0 triggers waiver)
    const input: CalculatorInput = {
      position: 'FWD',
      matches: [
        aMatch({ gameweek: 1, goals: 1 }), // MOTM FDR3 → +2 → conf=2, motm=1
        aMatch({ gameweek: 2, goals: 1 }), // MOTM FDR3 → +2 → conf=4, motm=2
        aMatch({ gameweek: 3 }), // blank FDR3 → −1 → conf=3
        aMatch({ gameweek: 4 }), // blank FDR3 → −1 → conf=2
        aMatch({ gameweek: 5 }), // blank FDR3 → −1 → conf=1
        aMatch({ gameweek: 6 }), // blank FDR3 → −1 → conf=0
        aMatch({ gameweek: 7 }), // blank FDR3 → −1 → conf=−1
        aMatch({ gameweek: 8 }), // blank FDR3 → −1 → conf=−2, motm still 2
        aMatch({ gameweek: 9, goals: 1 }), // MOTM FDR3 → confidenceAfterMotm=clamp(−2+2)=0
        //  → hypotheticalPostFatigue=−2 ≤ 0 → waived
      ],
    };

    const result = calculateConfidence(input);

    expect(result.history[8]).toMatchObject({
      confidenceAfter: 0,
      delta: 2,
      reason: 'MOTM vs FDR 3 opponent + Fatigue waived',
      fatigueApplied: false,
      motmCounterAfter: 0,
    });
  });

  it('EX-37: fatigue waived — hypothetical would be exactly −1', () => {
    // before=−1, motmCount=2, MOTM FDR3 → confidenceAfterMotm=clamp(−1+2)=+1
    // hypotheticalPostFatigue=+1+(−2)=−1 ≤ 0 → waived
    const input: CalculatorInput = {
      position: 'FWD',
      matches: [
        aMatch({ gameweek: 1, goals: 1 }), // MOTM FDR3 → +2 → conf=2, motm=1
        aMatch({ gameweek: 2, goals: 1 }), // MOTM FDR3 → +2 → conf=4, motm=2
        aMatch({ gameweek: 3 }), // blank FDR3 → −1 → conf=3
        aMatch({ gameweek: 4 }), // blank FDR3 → −1 → conf=2
        aMatch({ gameweek: 5 }), // blank FDR3 → −1 → conf=1
        aMatch({ gameweek: 6 }), // blank FDR3 → −1 → conf=0
        aMatch({ gameweek: 7 }), // blank FDR3 → −1 → conf=−1, motm still 2
        aMatch({ gameweek: 8, goals: 1 }), // MOTM FDR3 → confidenceAfterMotm=clamp(−1+2)=+1
        //  → hypotheticalPostFatigue=−1 ≤ 0 → waived
      ],
    };

    const result = calculateConfidence(input);

    expect(result.history[7]).toMatchObject({
      confidenceAfter: 1,
      delta: 2,
      reason: 'MOTM vs FDR 3 opponent + Fatigue waived',
      fatigueApplied: false,
      motmCounterAfter: 0,
    });
  });

  it('EX-38: fatigue applies — comfortably above zero after penalty', () => {
    // before=+2, motmCount=2, MOTM FDR3 → confidenceAfterMotm=clamp(+2+2)=+4
    // hypotheticalPostFatigue=+4+(−2)=+2 > 0 → applied → conf=+2, delta=0
    const input: CalculatorInput = {
      position: 'FWD',
      matches: [
        aMatch({ gameweek: 1, goals: 1 }), // MOTM FDR3 → +2 → conf=2, motm=1
        aMatch({ gameweek: 2, goals: 1 }), // MOTM FDR3 → +2 → conf=4, motm=2
        aMatch({ gameweek: 3 }), // blank FDR3 → −1 → conf=3
        aMatch({ gameweek: 4 }), // blank FDR3 → −1 → conf=2, motm still 2
        aMatch({ gameweek: 5, goals: 1 }), // MOTM FDR3 → confidenceAfterMotm=clamp(2+2)=4
        //  → hypotheticalPostFatigue=2 > 0 → applied → conf=2, delta=0
      ],
    };

    const result = calculateConfidence(input);

    expect(result.history[4]).toMatchObject({
      confidenceAfter: 2,
      delta: 0,
      reason: 'MOTM vs FDR 3 opponent + Fatigue −2',
      fatigueApplied: true,
      motmCounterAfter: 0,
    });
  });

  // ── DC Fatigue (EX-39–EX-44) ──────────────────────────────────────────

  it('EX-39: DC Fatigue applies — 3× DefCon-as-primary from 0 (MID)', () => {
    // GW1: DefCon → flat +1; conf=+1, dcCount=1
    // GW2: DefCon → flat +1; conf=+2, dcCount=2
    // GW3: DefCon; confidenceAfterDefCon=clamp(+2+1)=+3; hypothetical=+1>0 → applied
    //      → conf=+1, delta=−1, dcCount=0, dcFatigueApplied=true
    const input: CalculatorInput = {
      position: 'MID',
      matches: [
        aMatch({ gameweek: 1, defensiveContribution: 12 }),
        aMatch({ gameweek: 2, defensiveContribution: 12 }),
        aMatch({ gameweek: 3, defensiveContribution: 12 }),
      ],
    };

    const result = calculateConfidence(input);

    expect(result.finalConfidence).toBe(1);
    expect(result.history[0]).toMatchObject({ confidenceAfter: 1, defConCounterAfter: 1 });
    expect(result.history[1]).toMatchObject({ confidenceAfter: 2, defConCounterAfter: 2 });
    expect(result.history[2]).toMatchObject({
      confidenceAfter: 1,
      delta: -1,
      reason: 'DefCon vs FDR 3 opponent + DC Fatigue −2',
      dcFatigueApplied: true,
      defConCounterAfter: 0,
    });
  });

  it('EX-40: DC Fatigue waived — 3× DefCon-as-primary from −2 (MID)', () => {
    // 2× blank FDR3 → conf=−2; then 3× DefCon:
    // GW3: DefCon → +1; conf=−1, dcCount=1
    // GW4: DefCon → +1; conf=0,  dcCount=2
    // GW5: DefCon; confidenceAfterDefCon=clamp(0+1)=+1; hypothetical=−1≤0 → waived
    //      → conf=+1, delta=+1, dcCount=0, dcFatigueApplied=false
    const input: CalculatorInput = {
      position: 'MID',
      matches: [
        aMatch({ gameweek: 1 }), // blank → −1
        aMatch({ gameweek: 2 }), // blank → −2
        aMatch({ gameweek: 3, defensiveContribution: 12 }),
        aMatch({ gameweek: 4, defensiveContribution: 12 }),
        aMatch({ gameweek: 5, defensiveContribution: 12 }),
      ],
    };

    const result = calculateConfidence(input);

    expect(result.finalConfidence).toBe(1);
    expect(result.history[4]).toMatchObject({
      confidenceAfter: 1,
      delta: 1,
      reason: 'DefCon vs FDR 3 opponent + DC Fatigue waived',
      dcFatigueApplied: false,
      defConCounterAfter: 0,
    });
  });

  it('EX-41: DC Fatigue boundary — confidenceAfterDefCon=0, hypothetical=−2 → waived', () => {
    // Build conf=−1, dcCount=2: 2× DefCon → conf=+2, dcCount=2; 3× blank → conf=−1
    // Then 3rd DefCon: confidenceAfterDefCon=clamp(−1+1)=0; hypothetical=0+(−2)=−2≤0 → waived
    //   → conf=0, delta=+1, dcFatigueApplied=false
    const input: CalculatorInput = {
      position: 'MID',
      matches: [
        aMatch({ gameweek: 1, defensiveContribution: 12 }), // DefCon, dcCount=1, conf=+1
        aMatch({ gameweek: 2, defensiveContribution: 12 }), // DefCon, dcCount=2, conf=+2
        aMatch({ gameweek: 3 }), // blank, conf=+1
        aMatch({ gameweek: 4 }), // blank, conf=0
        aMatch({ gameweek: 5 }), // blank, conf=−1; dcCount still 2
        aMatch({ gameweek: 6, defensiveContribution: 12 }), // boundary: waived at exactly 0
      ],
    };

    const result = calculateConfidence(input);

    expect(result.history[5]).toMatchObject({
      confidenceAfter: 0,
      delta: 1,
      reason: 'DefCon vs FDR 3 opponent + DC Fatigue waived',
      dcFatigueApplied: false,
      defConCounterAfter: 0,
    });
  });

  it('EX-42: Counter independence — DefCon fires when motmCount=2, only defConCounterAfter increments', () => {
    // 2× MOTM FDR3 → conf=+4, motm=2; 3× blank → conf=+1; DefCon → conf=+2
    const input: CalculatorInput = {
      position: 'MID',
      matches: [
        aMatch({ gameweek: 1, goals: 1 }), // MOTM, motm=1, conf=+2
        aMatch({ gameweek: 2, goals: 1 }), // MOTM, motm=2, conf=+4
        aMatch({ gameweek: 3 }), // blank, conf=+3
        aMatch({ gameweek: 4 }), // blank, conf=+2
        aMatch({ gameweek: 5 }), // blank, conf=+1
        aMatch({ gameweek: 6, defensiveContribution: 12 }), // DefCon, dcCount=1
      ],
    };

    const result = calculateConfidence(input);

    expect(result.history[5]).toMatchObject({
      confidenceAfter: 2,
      delta: 1,
      reason: 'DefCon vs FDR 3 opponent',
      fatigueApplied: false,
      dcFatigueApplied: false,
      motmCounterAfter: 2, // unchanged — DefCon does not touch motmCount
      defConCounterAfter: 1, // incremented
    });
  });

  it('EX-43: DefCon silent (CS fires) → defConCounterAfter unchanged', () => {
    // GW1: blank → conf=−1
    // GW2: DefCon-only → conf=0, dcCount=1
    // GW3: CS fires, DefCon silent → conf=+1, dcCount must still be 1
    const input: CalculatorInput = {
      position: 'DEF',
      matches: [
        aMatch({ gameweek: 1 }), // blank FDR3 → −1
        aMatch({ gameweek: 2, defensiveContribution: 10 }), // DefCon-only, dcCount=1
        aMatch({ gameweek: 3, cleanSheet: true, defensiveContribution: 10 }), // CS fires
      ],
    };

    const result = calculateConfidence(input);

    expect(result.history[2]).toMatchObject({
      confidenceAfter: 1,
      delta: 1,
      reason: 'Clean sheet vs FDR 3 opponent',
      dcFatigueApplied: false,
      defConCounterAfter: 1, // unchanged — DefCon was silent
    });
  });

  it('EX-44: Cross-counter isolation — MOTM fatigue fires, defConCounterAfter stays 2', () => {
    // Build conf=+3, motm=2, dcCount=2:
    //   2× MOTM → conf=+4, motm=2; 3× blank → conf=+1; 2× DefCon → conf=+2,+3, dcCount=1,2
    // Then MOTM: motm=3 → fatigue fires; conf=+3, motm=0; dcCount must remain 2
    const input: CalculatorInput = {
      position: 'MID',
      matches: [
        aMatch({ gameweek: 1, goals: 1 }), // MOTM, motm=1, conf=+2
        aMatch({ gameweek: 2, goals: 1 }), // MOTM, motm=2, conf=+4
        aMatch({ gameweek: 3 }), // blank, conf=+3
        aMatch({ gameweek: 4 }), // blank, conf=+2
        aMatch({ gameweek: 5 }), // blank, conf=+1
        aMatch({ gameweek: 6, defensiveContribution: 12 }), // DefCon, dcCount=1, conf=+2
        aMatch({ gameweek: 7, defensiveContribution: 12 }), // DefCon, dcCount=2, conf=+3
        aMatch({ gameweek: 8, goals: 1 }), // MOTM → fatigue; conf=+3, motm=0
      ],
    };

    const result = calculateConfidence(input);

    expect(result.history[7]).toMatchObject({
      confidenceAfter: 3,
      delta: 0,
      reason: 'MOTM vs FDR 3 opponent + Fatigue −2',
      fatigueApplied: true,
      dcFatigueApplied: false,
      motmCounterAfter: 0, // reset by MOTM fatigue
      defConCounterAfter: 2, // untouched by MOTM fatigue path
    });
  });

  // ── SC Fatigue (EX-45–EX-47) ──────────────────────────────────────────

  it('EX-45: SC Fatigue applies — 3× SaveCon-as-primary from 0 (GK)', () => {
    // GW1: SaveCon → flat +1; conf=+1, scCount=1
    // GW2: SaveCon → flat +1; conf=+2, scCount=2
    // GW3: SaveCon; confidenceAfterSaveCon=+3; hypothetical=+1>0 → applied
    //      → conf=+1, delta=−1, scCount=0, scFatigueApplied=true
    const input: CalculatorInput = {
      position: 'GK',
      matches: [
        aMatch({ gameweek: 1, saves: 5 }),
        aMatch({ gameweek: 2, saves: 5 }),
        aMatch({ gameweek: 3, saves: 5 }),
      ],
    };

    const result = calculateConfidence(input);

    expect(result.finalConfidence).toBe(1);
    expect(result.history[0]).toMatchObject({ confidenceAfter: 1, saveConCounterAfter: 1 });
    expect(result.history[1]).toMatchObject({ confidenceAfter: 2, saveConCounterAfter: 2 });
    expect(result.history[2]).toMatchObject({
      confidenceAfter: 1,
      delta: -1,
      reason: 'SaveCon vs FDR 3 opponent + SC Fatigue −2',
      scFatigueApplied: true,
      saveConCounterAfter: 0,
    });
  });

  it('EX-46: SC Fatigue waived — GK at −3, saveConCount=2, 3rd SaveCon waived', () => {
    // Build conf=−3, scCount=2:
    //   blank FDR1 → −2; SaveCon → −1, scCount=1;
    //   blank FDR1 → −3; SaveCon → −2, scCount=2;
    //   blank FDR3 → −3 (scCount stays 2)
    // Then 3rd SaveCon: confidenceAfterSaveCon=clamp(−3+1)=−2; hypothetical=−4≤0 → waived
    //   → conf=−2, delta=+1, scFatigueApplied=false, scCount=0
    const input: CalculatorInput = {
      position: 'GK',
      matches: [
        aMatch({ gameweek: 1, opponentFdr: 1 }), // blank FDR1 → −2
        aMatch({ gameweek: 2, saves: 5 }), // SaveCon, scCount=1, conf=−1
        aMatch({ gameweek: 3, opponentFdr: 1 }), // blank FDR1 → −2; conf=−3
        aMatch({ gameweek: 4, saves: 5 }), // SaveCon, scCount=2, conf=−2
        aMatch({ gameweek: 5 }), // blank FDR3 → −1; conf=−3
        aMatch({ gameweek: 6, saves: 5 }), // 3rd SaveCon — waived
      ],
    };

    const result = calculateConfidence(input);

    expect(result.history[5]).toMatchObject({
      confidenceAfter: -2,
      delta: 1,
      reason: 'SaveCon vs FDR 3 opponent + SC Fatigue waived',
      scFatigueApplied: false,
      saveConCounterAfter: 0,
    });
  });

  it('EX-47a: GK SaveCon — defConCounterAfter stays 0, saveConCounterAfter increments to 1', () => {
    const result = calculateConfidence({
      position: 'GK',
      matches: [aMatch({ saves: 5 })],
    });

    expect(result.history[0]).toMatchObject({
      defConCounterAfter: 0,
      saveConCounterAfter: 1,
    });
  });

  it('EX-47b: DEF DefCon — saveConCounterAfter stays 0, defConCounterAfter increments to 1', () => {
    const result = calculateConfidence({
      position: 'DEF',
      matches: [aMatch({ defensiveContribution: 10 })],
    });

    expect(result.history[0]).toMatchObject({
      defConCounterAfter: 1,
      saveConCounterAfter: 0,
    });
  });

  // ── Rounding via calculator path ───────────────────────────────────────

  it('rounding: MOTM MID vs FDR 4 — base +2 × 1.25 = +2.5 → rounds away from zero → +3', () => {
    const input: CalculatorInput = {
      position: 'MID',
      matches: [aMatch({ goals: 1, opponentFdr: 4 })],
    };

    const result = calculateConfidence(input);

    expect(result.finalConfidence).toBe(3);
    expect(result.history[0]).toMatchObject({ delta: 3, reason: 'MOTM vs FDR 4 opponent' });
  });

  it('rounding: DEF blank vs FDR 1 — base −1 × 1.5 = −1.5 → rounds away from zero → −2', () => {
    // Covered by EX-26 above; explicit here as a labeled rounding test.
    const result = calculateConfidence({
      position: 'DEF',
      matches: [aMatch({ opponentFdr: 1 })],
    });
    expect(result.history[0]).toMatchObject({ delta: -2 });
  });

  // ── Property tests ─────────────────────────────────────────────────────

  describe('property tests', () => {
    const arbPosition = (): fc.Arbitrary<Position> =>
      fc.constantFrom<Position>('GK', 'DEF', 'MID', 'FWD');

    const arbMatchEvent = (): fc.Arbitrary<MatchEvent> =>
      fc.record({
        gameweek: fc.integer({ min: 1, max: 38 }),
        opponentTeamId: fc.integer({ min: 1, max: 20 }),
        opponentFdr: fc.integer({ min: 1, max: 5 }),
        minutesPlayed: fc.integer({ min: 1, max: 90 }),
        goals: fc.integer({ min: 0, max: 5 }),
        assists: fc.integer({ min: 0, max: 5 }),
        cleanSheet: fc.boolean(),
        saves: fc.integer({ min: 0, max: 20 }),
        defensiveContribution: fc.integer({ min: 0, max: 30 }),
      });

    const arbCalculatorInput = (): fc.Arbitrary<CalculatorInput> =>
      fc.record({
        position: arbPosition(),
        matches: fc.array(arbMatchEvent(), { maxLength: 38 }),
      });

    it('PROP-01: finalConfidence and every history entry are always in [−4, +5]', () => {
      fc.assert(
        fc.property(arbCalculatorInput(), (input) => {
          const result = calculateConfidence(input);

          expect(result.finalConfidence).toBeGreaterThanOrEqual(-4);
          expect(result.finalConfidence).toBeLessThanOrEqual(5);
          for (const entry of result.history) {
            expect(entry.confidenceAfter).toBeGreaterThanOrEqual(-4);
            expect(entry.confidenceAfter).toBeLessThanOrEqual(5);
          }
        }),
      );
    });

    it('PROP-02: empty match list always produces finalConfidence=0 for any position', () => {
      fc.assert(
        fc.property(arbPosition(), (position) => {
          const result = calculateConfidence({ position, matches: [] });
          expect(result.finalConfidence).toBe(0);
        }),
      );
    });

    it('PROP-03: calling with the same input twice produces deeply equal output (pure function)', () => {
      fc.assert(
        fc.property(arbCalculatorInput(), (input) => {
          const first = calculateConfidence(input);
          const second = calculateConfidence(input);
          expect(first).toEqual(second);
        }),
      );
    });

    it('PROP-04: DefCon never increments the MOTM counter', () => {
      const arbDefConOnlyPosition = (): fc.Arbitrary<'DEF' | 'MID' | 'FWD'> =>
        fc.constantFrom<'DEF' | 'MID' | 'FWD'>('DEF', 'MID', 'FWD');

      const arbDefConOnlyMatch = (position: 'DEF' | 'MID' | 'FWD'): fc.Arbitrary<MatchEvent> => {
        const threshold = position === 'DEF' ? 10 : 12;
        return fc.record({
          gameweek: fc.integer({ min: 1, max: 38 }),
          opponentTeamId: fc.integer({ min: 1, max: 20 }),
          opponentFdr: fc.integer({ min: 1, max: 5 }),
          minutesPlayed: fc.integer({ min: 1, max: 90 }),
          goals: fc.constant(0),
          assists: fc.constant(0),
          cleanSheet: fc.constant(false),
          saves: fc.constant(0),
          defensiveContribution: fc.integer({ min: threshold, max: 30 }),
        });
      };

      fc.assert(
        fc.property(
          arbDefConOnlyPosition().chain((position) =>
            fc.tuple(
              fc.constant(position),
              fc.array(arbDefConOnlyMatch(position), { minLength: 1, maxLength: 10 }),
            ),
          ),
          ([position, matches]) => {
            const result = calculateConfidence({ position, matches });
            for (const entry of result.history) {
              expect(entry.motmCounterAfter).toBe(0);
            }
          },
        ),
      );
    });

    it('PROP-05: FDR multiplier never produces out-of-range values for any valid opponentFdr', () => {
      // Tighter version of PROP-01: constrains opponentFdr explicitly to {1,2,3,4,5}
      // to verify FDR scaling specifically cannot escape the clamp bounds.
      fc.assert(
        fc.property(arbCalculatorInput(), (input) => {
          const result = calculateConfidence(input);
          expect(result.finalConfidence).toBeGreaterThanOrEqual(-4);
          expect(result.finalConfidence).toBeLessThanOrEqual(5);
          for (const entry of result.history) {
            expect(entry.confidenceAfter).toBeGreaterThanOrEqual(-4);
            expect(entry.confidenceAfter).toBeLessThanOrEqual(5);
          }
        }),
      );
    });

    it('PROP-06: SaveCon never increments the MOTM counter', () => {
      const arbSaveConOnlyMatch = (): fc.Arbitrary<MatchEvent> =>
        fc.record({
          gameweek: fc.integer({ min: 1, max: 38 }),
          opponentTeamId: fc.integer({ min: 1, max: 20 }),
          opponentFdr: fc.integer({ min: 1, max: 5 }),
          minutesPlayed: fc.integer({ min: 1, max: 90 }),
          goals: fc.constant(0),
          assists: fc.constant(0),
          cleanSheet: fc.constant(false),
          saves: fc.integer({ min: 4, max: 20 }),
          defensiveContribution: fc.constant(0),
        });

      fc.assert(
        fc.property(fc.array(arbSaveConOnlyMatch(), { minLength: 1, maxLength: 10 }), (matches) => {
          const result = calculateConfidence({ position: 'GK', matches });
          for (const entry of result.history) {
            expect(entry.motmCounterAfter).toBe(0);
          }
        }),
      );
    });

    it('PROP-07: MOTM Fatigue never pushes confidence to ≤ 0 (waiver guarantee)', () => {
      // When fatigueApplied === true, confidenceAfter must be > 0.
      fc.assert(
        fc.property(arbCalculatorInput(), (input) => {
          const result = calculateConfidence(input);
          for (const entry of result.history) {
            if (entry.fatigueApplied) {
              expect(entry.confidenceAfter).toBeGreaterThan(0);
            }
          }
        }),
      );
    });

    it('PROP-08: DC Fatigue never pushes confidence to ≤ 0', () => {
      fc.assert(
        fc.property(arbCalculatorInput(), (input) => {
          const result = calculateConfidence(input);
          for (const entry of result.history) {
            if (entry.dcFatigueApplied) {
              expect(entry.confidenceAfter).toBeGreaterThan(0);
            }
          }
        }),
      );
    });

    it('PROP-09: SC Fatigue never pushes confidence to ≤ 0', () => {
      fc.assert(
        fc.property(arbCalculatorInput(), (input) => {
          const result = calculateConfidence(input);
          for (const entry of result.history) {
            if (entry.scFatigueApplied) {
              expect(entry.confidenceAfter).toBeGreaterThan(0);
            }
          }
        }),
      );
    });

    it('PROP-10: counter mutual exclusivity — at most one counter increments per match', () => {
      fc.assert(
        fc.property(arbCalculatorInput(), (input) => {
          const result = calculateConfidence(input);
          let prevMotm = 0;
          let prevDc = 0;
          let prevSc = 0;
          for (const entry of result.history) {
            const motmIncremented = entry.motmCounterAfter > prevMotm;
            const dcIncremented = entry.defConCounterAfter > prevDc;
            const scIncremented = entry.saveConCounterAfter > prevSc;
            // At most one counter can increment in a single match.
            const increments = [motmIncremented, dcIncremented, scIncremented].filter(
              Boolean,
            ).length;
            expect(increments).toBeLessThanOrEqual(1);
            // Snapshot counters for next iteration (use the after values, not the reset values).
            prevMotm = entry.motmCounterAfter;
            prevDc = entry.defConCounterAfter;
            prevSc = entry.saveConCounterAfter;
          }
        }),
      );
    });
  });
});
