import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { Position } from '@/lib/confidence/types';
import { calculateTeamConfidence } from './teamCalculator';
import type { SquadPick, TeamCalculatorInput } from './types';
import { aSquad, aSquadPick } from './__fixtures__/squads';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build a TeamCalculatorInput directly from parallel arrays — useful for bespoke cases. */
function buildInput(
  starters: readonly { confidence: number; position: Position }[],
  bench: readonly { confidence: number; position: Position }[],
): TeamCalculatorInput {
  const picks: SquadPick[] = [];
  const playerData = new Map<
    number,
    { readonly confidence: number; readonly position: Position }
  >();
  let id = 1;
  for (const [i, spec] of starters.entries()) {
    picks.push(aSquadPick({ playerId: id, squadPosition: i + 1 }));
    playerData.set(id, spec);
    id++;
  }
  for (const [i, spec] of bench.entries()) {
    picks.push(aSquadPick({ playerId: id, squadPosition: 12 + i }));
    playerData.set(id, spec);
    id++;
  }
  return { picks, playerData };
}

const defaultBench = [
  { confidence: 0, position: 'GK' as Position },
  { confidence: 0, position: 'DEF' as Position },
  { confidence: 0, position: 'MID' as Position },
  { confidence: 0, position: 'FWD' as Position },
] as const;

// ── Worked examples ───────────────────────────────────────────────────────────

describe('calculateTeamConfidence — worked examples', () => {
  it('TEAM-EX-01: fully positive squad returns 100.00%', () => {
    const input = buildInput(
      [
        { confidence: 5, position: 'GK' },
        { confidence: 5, position: 'DEF' },
        { confidence: 5, position: 'DEF' },
        { confidence: 5, position: 'DEF' },
        { confidence: 5, position: 'DEF' },
        { confidence: 5, position: 'MID' },
        { confidence: 5, position: 'MID' },
        { confidence: 5, position: 'MID' },
        { confidence: 5, position: 'MID' },
        { confidence: 5, position: 'FWD' },
        { confidence: 5, position: 'FWD' },
      ],
      defaultBench,
    );

    const result = calculateTeamConfidence(input);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.teamConfidencePercent).toBe(100);
    expect(result.value.starterCount).toBe(11);
  });

  it('TEAM-EX-02: fully negative squad (at new floor −4) returns 0.00%', () => {
    // −4 is the new CONFIDENCE_MIN. confidenceToPercent(−4) = 50 + (−4/4)×50 = 0.
    const input = buildInput(
      [
        { confidence: -4, position: 'GK' },
        { confidence: -4, position: 'DEF' },
        { confidence: -4, position: 'DEF' },
        { confidence: -4, position: 'DEF' },
        { confidence: -4, position: 'DEF' },
        { confidence: -4, position: 'MID' },
        { confidence: -4, position: 'MID' },
        { confidence: -4, position: 'MID' },
        { confidence: -4, position: 'MID' },
        { confidence: -4, position: 'FWD' },
        { confidence: -4, position: 'FWD' },
      ],
      defaultBench,
    );

    const result = calculateTeamConfidence(input);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.teamConfidencePercent).toBe(0);
  });

  it('TEAM-EX-03: neutral squad returns 50.00%', () => {
    const result = calculateTeamConfidence(aSquad());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.teamConfidencePercent).toBe(50);
    expect(result.value.positional.defence).toBe(0);
    expect(result.value.positional.midfield).toBe(0);
    expect(result.value.positional.attack).toBe(0);
  });

  it('TEAM-EX-04: mixed lines produce correct weighted average', () => {
    // GK + 3 DEF: [+3, +2, +2, -1] → defence mean = +1.50
    // 4 MID:       [+4, +2,  0, -2] → midfield mean = +1.00
    // 3 FWD:       [+5, +3, +1]     → attack mean   = +3.00
    // lineAverage = (1.50 + 1.00 + 3.00) / 3 = 1.8333...
    // percent = ((1.8333... + 5) / 10) × 100 = 68.33 (rounded)
    const input = buildInput(
      [
        { confidence: 3, position: 'GK' },
        { confidence: 2, position: 'DEF' },
        { confidence: 2, position: 'DEF' },
        { confidence: -1, position: 'DEF' },
        { confidence: 4, position: 'MID' },
        { confidence: 2, position: 'MID' },
        { confidence: 0, position: 'MID' },
        { confidence: -2, position: 'MID' },
        { confidence: 5, position: 'FWD' },
        { confidence: 3, position: 'FWD' },
        { confidence: 1, position: 'FWD' },
      ],
      defaultBench,
    );

    const result = calculateTeamConfidence(input);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.positional.defence).toBeCloseTo(1.5, 5);
    expect(result.value.positional.midfield).toBeCloseTo(1.0, 5);
    expect(result.value.positional.attack).toBeCloseTo(3.0, 5);
    expect(result.value.teamConfidencePercent).toBe(68.33);
  });

  it('TEAM-EX-05: bench players are excluded from the calculation', () => {
    // All 11 starters at 0, all bench at +5 → should still be 50%
    const input = buildInput(
      [
        { confidence: 0, position: 'GK' },
        { confidence: 0, position: 'DEF' },
        { confidence: 0, position: 'DEF' },
        { confidence: 0, position: 'DEF' },
        { confidence: 0, position: 'DEF' },
        { confidence: 0, position: 'MID' },
        { confidence: 0, position: 'MID' },
        { confidence: 0, position: 'MID' },
        { confidence: 0, position: 'MID' },
        { confidence: 0, position: 'FWD' },
        { confidence: 0, position: 'FWD' },
      ],
      [
        { confidence: 5, position: 'GK' },
        { confidence: 5, position: 'DEF' },
        { confidence: 5, position: 'MID' },
        { confidence: 5, position: 'FWD' },
      ],
    );

    const result = calculateTeamConfidence(input);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.teamConfidencePercent).toBe(50);
  });

  it('TEAM-EX-06: missing FWD line falls back to 0 (neutral) for that line', () => {
    // 1 GK + 4 DEF + 6 MID, no FWD starters at all — malformed but graceful
    // Defence: 1 GK + 4 DEF, all at +4 → mean = +4.00
    // Midfield: 6 MID, all at +2 → mean = +2.00
    // Attack: 0 FWD → fallback = 0
    // lineAverage = (4 + 2 + 0) / 3 = 2.00
    // confidenceToPercent(2) = 50 + (2/5)×50 = 70.00 (positive branch — same as old formula)
    const picks: SquadPick[] = [];
    const playerData = new Map<
      number,
      { readonly confidence: number; readonly position: Position }
    >();
    const starterSpecs: { confidence: number; position: Position }[] = [
      { confidence: 4, position: 'GK' },
      { confidence: 4, position: 'DEF' },
      { confidence: 4, position: 'DEF' },
      { confidence: 4, position: 'DEF' },
      { confidence: 4, position: 'DEF' },
      { confidence: 2, position: 'MID' },
      { confidence: 2, position: 'MID' },
      { confidence: 2, position: 'MID' },
      { confidence: 2, position: 'MID' },
      { confidence: 2, position: 'MID' },
      { confidence: 2, position: 'MID' },
    ];
    let id = 1;
    for (const [i, spec] of starterSpecs.entries()) {
      picks.push(aSquadPick({ playerId: id, squadPosition: i + 1 }));
      playerData.set(id, spec);
      id++;
    }
    for (let i = 0; i < 4; i++) {
      picks.push(aSquadPick({ playerId: id, squadPosition: 12 + i }));
      playerData.set(id, { confidence: 0, position: 'FWD' });
      id++;
    }
    const input: TeamCalculatorInput = { picks, playerData };

    const result = calculateTeamConfidence(input);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.positional.attack).toBe(0);
    expect(result.value.positional.defence).toBeCloseTo(4.0, 5);
    expect(result.value.positional.midfield).toBeCloseTo(2.0, 5);
    expect(result.value.teamConfidencePercent).toBe(70);
  });

  it('TEAM-EX-07: starter missing from playerData is silently excluded from that line', () => {
    // Build a standard squad but remove one DEF from playerData entirely.
    // Defence group: 1 GK(0) + 3 DEF(0) = mean 0. Midfield(0), Attack(0) → 50%.
    const base = aSquad();
    // playerId 3 is starter 3 (squadPosition 3, DEF in the default 4-4-2)
    const trimmed = new Map(base.playerData);
    trimmed.delete(3);
    const input: TeamCalculatorInput = { picks: base.picks, playerData: trimmed };

    const result = calculateTeamConfidence(input);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // All remaining starters are confidence 0, so result is still 50%
    expect(result.value.teamConfidencePercent).toBe(50);
  });
});

// ── Validation ────────────────────────────────────────────────────────────────

describe('calculateTeamConfidence — validation', () => {
  it('rejects a squad with fewer than 15 picks', () => {
    const input = buildInput(
      [
        { confidence: 0, position: 'GK' },
        { confidence: 0, position: 'DEF' },
        { confidence: 0, position: 'DEF' },
        { confidence: 0, position: 'DEF' },
        { confidence: 0, position: 'DEF' },
        { confidence: 0, position: 'MID' },
        { confidence: 0, position: 'MID' },
        { confidence: 0, position: 'MID' },
        { confidence: 0, position: 'MID' },
        { confidence: 0, position: 'FWD' },
        { confidence: 0, position: 'FWD' },
      ],
      // Only 3 bench picks (valid squads need 4)
      [
        { confidence: 0, position: 'GK' },
        { confidence: 0, position: 'DEF' },
        { confidence: 0, position: 'MID' },
      ],
    );

    const result = calculateTeamConfidence(input);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('WRONG_PICK_COUNT');
  });

  it('rejects a squad with more than 15 picks', () => {
    const input = buildInput(
      [
        { confidence: 0, position: 'GK' },
        { confidence: 0, position: 'DEF' },
        { confidence: 0, position: 'DEF' },
        { confidence: 0, position: 'DEF' },
        { confidence: 0, position: 'DEF' },
        { confidence: 0, position: 'MID' },
        { confidence: 0, position: 'MID' },
        { confidence: 0, position: 'MID' },
        { confidence: 0, position: 'MID' },
        { confidence: 0, position: 'FWD' },
        { confidence: 0, position: 'FWD' },
        // 12th starter — invalid
        { confidence: 0, position: 'MID' },
      ],
      defaultBench,
    );

    const result = calculateTeamConfidence(input);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('WRONG_PICK_COUNT');
  });

  it('rejects when starter count (squadPosition ≤ 11) does not equal 11', () => {
    // 10 starters + 5 bench = 15 picks, but wrong starter/bench split
    const picks: SquadPick[] = [];
    const playerData = new Map<
      number,
      { readonly confidence: number; readonly position: Position }
    >();
    for (let i = 1; i <= 10; i++) {
      picks.push(aSquadPick({ playerId: i, squadPosition: i }));
      playerData.set(i, { confidence: 0, position: 'MID' });
    }
    for (let i = 11; i <= 15; i++) {
      picks.push(aSquadPick({ playerId: i, squadPosition: i + 1 })); // positions 12–16
      playerData.set(i, { confidence: 0, position: 'MID' });
    }
    const input: TeamCalculatorInput = { picks, playerData };

    const result = calculateTeamConfidence(input);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('WRONG_STARTER_COUNT');
  });
});

// ── Property tests ────────────────────────────────────────────────────────────

describe('calculateTeamConfidence — properties', () => {
  const arbConfidence = (): fc.Arbitrary<number> => fc.integer({ min: -4, max: 5 });
  const arbPosition = (): fc.Arbitrary<Position> =>
    fc.constantFrom<Position>('GK', 'DEF', 'MID', 'FWD');
  const arbPlayerSpec = (): fc.Arbitrary<{ confidence: number; position: Position }> =>
    fc.record({ confidence: arbConfidence(), position: arbPosition() });

  /** Arbitrary for a fully valid 11-starter + 4-bench squad. */
  const arbValidSquadInput = (): fc.Arbitrary<TeamCalculatorInput> =>
    fc
      .record({
        starters: fc.array(arbPlayerSpec(), { minLength: 11, maxLength: 11 }),
        bench: fc.array(arbPlayerSpec(), { minLength: 4, maxLength: 4 }),
      })
      .map(({ starters, bench }) => buildInput(starters, bench));

  it('TEAM-PROP-01: teamConfidencePercent is always in [0, 100] for valid inputs', () => {
    fc.assert(
      fc.property(arbValidSquadInput(), (input) => {
        const result = calculateTeamConfidence(input);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.value.teamConfidencePercent).toBeGreaterThanOrEqual(0);
        expect(result.value.teamConfidencePercent).toBeLessThanOrEqual(100);
      }),
    );
  });

  it('TEAM-PROP-02: a squad where every starter has confidence = 0 always yields 50.00%', () => {
    const arbNeutralStarters = fc.array(
      arbPosition().map((position) => ({ confidence: 0 as const, position })),
      { minLength: 11, maxLength: 11 },
    );

    fc.assert(
      fc.property(
        arbNeutralStarters,
        fc.array(arbPlayerSpec(), { minLength: 4, maxLength: 4 }),
        (starters, bench) => {
          const result = calculateTeamConfidence(buildInput(starters, bench));
          expect(result.ok).toBe(true);
          if (!result.ok) return;
          expect(result.value.teamConfidencePercent).toBe(50);
        },
      ),
    );
  });

  it('TEAM-PROP-03: replacing all bench confidences with arbitrary values does not change the output', () => {
    const arbBenchConfidence = (): fc.Arbitrary<number> => fc.integer({ min: -4, max: 5 });

    fc.assert(
      fc.property(
        arbValidSquadInput(),
        fc.array(arbBenchConfidence(), { minLength: 4, maxLength: 4 }),
        (original, newBenchConfidences) => {
          // Reconstruct input with same starters, different bench confidences
          const { picks, playerData } = original;
          const starters = picks
            .filter((p) => p.squadPosition <= 11)
            .sort((a, b) => a.squadPosition - b.squadPosition)
            .flatMap((p) => {
              const spec = playerData.get(p.playerId);
              return spec !== undefined ? [spec] : [];
            });
          const bench = picks
            .filter((p) => p.squadPosition > 11)
            .sort((a, b) => a.squadPosition - b.squadPosition)
            .flatMap((p, i) => {
              const spec = playerData.get(p.playerId);
              const conf = newBenchConfidences[i];
              if (spec === undefined || conf === undefined) return [];
              return [{ confidence: conf, position: spec.position }];
            });

          const altInput = buildInput(starters, bench);
          const originalResult = calculateTeamConfidence(original);
          const altResult = calculateTeamConfidence(altInput);

          expect(originalResult.ok).toBe(true);
          expect(altResult.ok).toBe(true);
          if (!originalResult.ok || !altResult.ok) return;
          expect(altResult.value.teamConfidencePercent).toBe(
            originalResult.value.teamConfidencePercent,
          );
          expect(altResult.value.positional).toEqual(originalResult.value.positional);
        },
      ),
    );
  });
});
