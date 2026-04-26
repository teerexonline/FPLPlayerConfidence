import { clamp } from '@/lib/utils/math';
import type { CalculatorInput, CalculatorOutput, MatchDelta, MatchEvent, Position } from './types';

const CONFIDENCE_MIN = -4;
const CONFIDENCE_MAX = 5;
const FATIGUE_THRESHOLD = 3;
const FATIGUE_PENALTY = -2;
// 4 saves represents above-average shot-stopping workload — exceeds the FPL save-point threshold (3)
// plus signals the keeper had to work.
const SAVECON_THRESHOLD = 4;

// Threshold values from FPL 2025/26 scoring rules (not exposed via API).
const DEFCON_THRESHOLD: Record<Position, number | null> = {
  GK: null,
  DEF: 10,
  MID: 12,
  FWD: 12,
};

/** Multiplier applied to positive events (MOTM, Performance, CS, Assist-MOTM). */
const FDR_POSITIVE_MULTIPLIER: Record<number, number> = {
  1: 0.5,
  2: 0.75,
  3: 1.0,
  4: 1.25,
  5: 1.5,
};

/** Multiplier applied to blank penalties. Inverse relationship to positive multiplier. */
const FDR_BLANK_MULTIPLIER: Record<number, number> = {
  1: 1.5,
  2: 1.25,
  3: 1.0,
  4: 0.75,
  5: 0.5,
};

/**
 * Rounds x to the nearest integer, breaking ties away from zero.
 * Math.round(-1.5) === -1 in JavaScript (rounds toward +∞), not -2.
 * This function guarantees -1.5 → -2, +0.5 → +1, +2.5 → +3, -2.5 → -3.
 */
export function roundAwayFromZero(x: number): number {
  return Math.sign(x) * Math.round(Math.abs(x));
}

function isDefConThresholdMet(position: Position, defensiveContribution: number): boolean {
  const threshold = DEFCON_THRESHOLD[position];
  return threshold !== null && defensiveContribution >= threshold;
}

interface MatchAdjustment {
  readonly raw: number;
  readonly reasons: readonly string[];
  readonly isMotm: boolean;
}

function resolveMidFwd(match: MatchEvent, defconHit: boolean): MatchAdjustment {
  const fdr = match.opponentFdr;
  const posMul = FDR_POSITIVE_MULTIPLIER[fdr] ?? 1;
  const blkMul = FDR_BLANK_MULTIPLIER[fdr] ?? 1;

  if (match.goals >= 1 || match.assists >= 2) {
    return {
      raw: roundAwayFromZero(2 * posMul),
      reasons: [`MOTM vs FDR ${fdr.toString()} opponent`],
      isMotm: true,
    };
  }

  if (match.assists === 1) {
    return {
      raw: roundAwayFromZero(1 * posMul),
      reasons: [`Performance vs FDR ${fdr.toString()} opponent`],
      isMotm: false,
    };
  }

  if (defconHit) {
    return {
      raw: 1,
      reasons: [`DefCon vs FDR ${fdr.toString()} opponent`],
      isMotm: false,
    };
  }

  return {
    raw: roundAwayFromZero(-1 * blkMul),
    reasons: [`Blank vs FDR ${fdr.toString()} opponent`],
    isMotm: false,
  };
}

function resolveGkDef(
  match: MatchEvent,
  position: 'GK' | 'DEF',
  defconHit: boolean,
): MatchAdjustment {
  const fdr = match.opponentFdr;
  const posMul = FDR_POSITIVE_MULTIPLIER[fdr] ?? 1;
  const blkMul = FDR_BLANK_MULTIPLIER[fdr] ?? 1;
  const defContrib = position === 'DEF' && defconHit;
  let rawFloat = 0;
  const reasons: string[] = [];
  let isMotm = false;

  if (match.assists >= 1) {
    rawFloat += 2 * posMul;
    reasons.push(`Assist vs FDR ${fdr.toString()} opponent (MOTM)`);
    isMotm = true;
  } else if (match.goals >= 1) {
    rawFloat += 2 * posMul;
    reasons.push(`MOTM vs FDR ${fdr.toString()} opponent`);
    isMotm = true;
  }

  if (match.cleanSheet) {
    rawFloat += 1 * posMul;
    reasons.push(`Clean sheet vs FDR ${fdr.toString()} opponent`);
  }

  // SaveCon/DefCon fire only when no positive event has already fired (Blank substitutes).
  // Exactly one of these three branches executes.
  if (!isMotm && !match.cleanSheet) {
    if (defContrib) {
      rawFloat += 1; // flat, no FDR
      reasons.push(`DefCon vs FDR ${fdr.toString()} opponent`);
    } else if (position === 'GK' && match.saves >= SAVECON_THRESHOLD) {
      rawFloat += 1; // flat, no FDR
      reasons.push(`SaveCon vs FDR ${fdr.toString()} opponent`);
    } else {
      rawFloat += -1 * blkMul;
      reasons.push(`Blank vs FDR ${fdr.toString()} opponent`);
    }
  }

  return { raw: roundAwayFromZero(rawFloat), reasons, isMotm };
}

export function calculateConfidence(input: CalculatorInput): CalculatorOutput {
  let confidence = 0;
  let motmCount = 0;
  const history: MatchDelta[] = [];

  for (const match of input.matches) {
    const before = confidence;
    const defconHit = isDefConThresholdMet(input.position, match.defensiveContribution);

    const { raw, reasons, isMotm } =
      input.position === 'GK' || input.position === 'DEF'
        ? resolveGkDef(match, input.position, defconHit)
        : resolveMidFwd(match, defconHit);

    const reasonList = [...reasons];
    let fatigueApplied = false;

    // Clamp after the MOTM gain first. When fatigue fires, it is applied to the
    // already-clamped value so the ceiling cannot silently absorb the penalty.
    confidence = clamp(before + raw, CONFIDENCE_MIN, CONFIDENCE_MAX);

    if (isMotm) {
      motmCount += 1;
      if (motmCount >= FATIGUE_THRESHOLD) {
        const hypotheticalPostFatigue = confidence + FATIGUE_PENALTY;
        if (hypotheticalPostFatigue > 0) {
          confidence = hypotheticalPostFatigue;
          reasonList.push('Fatigue −2');
          fatigueApplied = true;
        } else {
          // Waive: applying the penalty would push the player to or below neutral.
          reasonList.push('Fatigue waived');
        }
        motmCount = 0;
      }
    }

    history.push({
      gameweek: match.gameweek,
      delta: confidence - before,
      reason: reasonList.join(' + '),
      fatigueApplied,
      confidenceAfter: confidence,
      motmCounterAfter: motmCount,
    });
  }

  return { finalConfidence: confidence, history };
}
