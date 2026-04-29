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

/**
 * v1.7: MOTM uses a dedicated table with a raised floor (×0.75 at FDR 1–2) so a
 * goal against any opponent is worth at least +2. FDR 4 is boosted to ×2.0
 * (was ×1.5) to make +4 reachable and distinguish warm from mild.
 */
export const MOTM_FDR_MULTIPLIERS: Record<number, number> = {
  1: 0.75,
  2: 0.75,
  3: 1.0,
  4: 2.0,
  5: 2.5,
};

/**
 * v1.7: Performance (single assist for MID/FWD, single assist for GK/DEF) uses a
 * separate table that scales more aggressively at high FDR. A solo assist at
 * FDR 4 gives +3 (mild streak trigger); at FDR 5/BIG it gives +4 (warm trigger).
 */
export const PERFORMANCE_FDR_MULTIPLIERS: Record<number, number> = {
  1: 0.5,
  2: 0.75,
  3: 1.0,
  4: 2.5,
  5: 3.5,
};

/**
 * v1.7: Clean sheet uses a separate multiplier table. CS at FDR 1–4 rounds to +1;
 * at FDR 5 (×1.5) it rounds to +2. The big-team override does NOT apply here —
 * CS always uses the actual FPL FDR.
 */
const CS_FDR_MULTIPLIERS: Record<number, number> = {
  1: 0.5,
  2: 0.75,
  3: 1.0,
  4: 1.25,
  5: 1.5,
};

/**
 * Opponents whose team ID causes their opponents to be treated as effective FDR 5,
 * regardless of the difficulty value FPL assigns to a given fixture.
 *
 * IDs are stable FPL team IDs verified against the teams table:
 *   7 = Chelsea, 12 = Liverpool, 13 = Man City, 14 = Man Utd
 */
const BIG_TEAM_IDS: ReadonlySet<number> = new Set([7, 12, 13, 14]);

/** Returns the effective FDR and reason label for the opponent, applying the big team override. */
function getOpponentLabel(match: MatchEvent): { fdr: number; label: string } {
  if (BIG_TEAM_IDS.has(match.opponentTeamId)) {
    return { fdr: 5, label: 'BIG' };
  }
  return { fdr: match.opponentFdr, label: `FDR ${match.opponentFdr.toString()}` };
}

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
  readonly isDefCon: boolean; // DefCon fired as primary (no goal/assist/CS in same match)
  readonly isSaveCon: boolean; // SaveCon fired as primary (GK only, same conditions)
}

function resolveMidFwd(match: MatchEvent, defconHit: boolean): MatchAdjustment {
  // getOpponentLabel applies the big-team override for goal/assist and blank events only.
  // DefCon is a flat recovery point — no override, uses FPL's actual FDR in the label.
  const { fdr, label } = getOpponentLabel(match);
  const motmMul = MOTM_FDR_MULTIPLIERS[fdr] ?? 1;
  const perfMul = PERFORMANCE_FDR_MULTIPLIERS[fdr] ?? 1;
  const blkMul = FDR_BLANK_MULTIPLIER[fdr] ?? 1;

  if (match.goals >= 1 || match.assists >= 2) {
    return {
      raw: roundAwayFromZero(2 * motmMul),
      reasons: [`MOTM vs ${label} opponent`],
      isMotm: true,
      isDefCon: false,
      isSaveCon: false,
    };
  }

  if (match.assists === 1) {
    const raw = roundAwayFromZero(1 * perfMul);
    // A Performance that rounds to +3 or more against a tough opponent is
    // reclassified as MOTM. The delta is not recalculated — only the label
    // and fatigue-counter eligibility change.
    const reclassified = raw >= 3;
    return {
      raw,
      reasons: [reclassified ? `MOTM vs ${label} opponent` : `Performance vs ${label} opponent`],
      isMotm: reclassified,
      isDefCon: false,
      isSaveCon: false,
    };
  }

  if (defconHit) {
    // Flat +1 recovery point — FDR and big-team status do not affect the delta or label.
    return {
      raw: 1,
      reasons: [`DefCon vs FDR ${match.opponentFdr.toString()} opponent`],
      isMotm: false,
      isDefCon: true,
      isSaveCon: false,
    };
  }

  return {
    raw: roundAwayFromZero(-1 * blkMul),
    reasons: [`Blank vs ${label} opponent`],
    isMotm: false,
    isDefCon: false,
    isSaveCon: false,
  };
}

function resolveGkDef(
  match: MatchEvent,
  position: 'GK' | 'DEF',
  defconHit: boolean,
): MatchAdjustment {
  // getOpponentLabel applies the big-team override for goal/assist and blank events only.
  // CS, DefCon, and SaveCon are flat recovery points — their reason strings use FPL's
  // actual FDR for display accuracy (no big-team override).
  const { fdr, label } = getOpponentLabel(match);
  const motmMul = MOTM_FDR_MULTIPLIERS[fdr] ?? 1;
  const perfMul = PERFORMANCE_FDR_MULTIPLIERS[fdr] ?? 1;
  // CS always uses actual FPL FDR — big-team override does not apply.
  const csMul = CS_FDR_MULTIPLIERS[match.opponentFdr] ?? 1;
  const blkMul = FDR_BLANK_MULTIPLIER[fdr] ?? 1;
  const actualFdr = match.opponentFdr;
  const defContrib = position === 'DEF' && defconHit;
  let rawFloat = 0;
  const reasons: string[] = [];
  let isMotm = false;
  let isPerformance = false;

  // v1.7: goals >= 1 or assists >= 2 → MOTM (2× MOTM table).
  // Single assist only → Performance (1× Performance table, no MOTM reclassification
  // in the GK/DEF path — assists are inherently rarer and the reclassification rule
  // is a MID/FWD-specific concept).
  if (match.goals >= 1 || match.assists >= 2) {
    if (match.goals >= 1) {
      reasons.push(`MOTM vs ${label} opponent`);
    } else {
      // assists >= 2, no goal
      reasons.push(`Assist vs ${label} opponent (MOTM)`);
    }
    rawFloat += 2 * motmMul;
    isMotm = true;
  } else if (match.assists === 1) {
    rawFloat += 1 * perfMul;
    reasons.push(`Assist vs ${label} opponent`);
    isPerformance = true;
  }

  // v1.7: CS fires only when MOTM did not fire. CS + Performance still stacks.
  if (!isMotm && match.cleanSheet) {
    rawFloat += 1 * csMul;
    reasons.push(`Clean sheet vs FDR ${actualFdr.toString()} opponent`);
  }

  // SaveCon/DefCon/Blank fire only when no positive event has already fired.
  // Single-assist Performance is a positive event — it silences the fallback branch.
  let isDefCon = false;
  let isSaveCon = false;
  if (!isMotm && !isPerformance && !match.cleanSheet) {
    if (defContrib) {
      rawFloat += 1; // flat recovery point — no FDR multiplier, no big-team override
      reasons.push(`DefCon vs FDR ${actualFdr.toString()} opponent`);
      isDefCon = true;
    } else if (position === 'GK' && match.saves >= SAVECON_THRESHOLD) {
      rawFloat += 1; // flat recovery point — no FDR multiplier, no big-team override
      reasons.push(`SaveCon vs FDR ${actualFdr.toString()} opponent`);
      isSaveCon = true;
    } else {
      rawFloat += -1 * blkMul;
      reasons.push(`Blank vs ${label} opponent`);
    }
  }

  const raw = roundAwayFromZero(rawFloat);
  // Safety guard: catches unexpected non-MOTM stacking (e.g. future event types)
  // that produce raw ≥ 3. Gated on !isPerformance so Performance+CS at high FDR
  // does not accidentally reclassify — the spec treats that as Performance, not MOTM.
  if (raw >= 3 && !isMotm && !isPerformance) {
    isMotm = true;
  }
  return { raw, reasons, isMotm, isDefCon, isSaveCon };
}

export function calculateConfidence(input: CalculatorInput): CalculatorOutput {
  let confidence = 0;
  let motmCount = 0;
  let defConFatigueCount = 0;
  let saveConFatigueCount = 0;
  const history: MatchDelta[] = [];

  for (const match of input.matches) {
    const before = confidence;
    const defconHit = isDefConThresholdMet(input.position, match.defensiveContribution);

    const { raw, reasons, isMotm, isDefCon, isSaveCon } =
      input.position === 'GK' || input.position === 'DEF'
        ? resolveGkDef(match, input.position, defconHit)
        : resolveMidFwd(match, defconHit);

    const reasonList = [...reasons];
    let fatigueApplied = false;
    let dcFatigueApplied = false;
    let scFatigueApplied = false;

    // Clamp after the event gain first. rawDelta captures the pre-fatigue clamped
    // delta — used for streak threshold and level so fatigue doesn't mask a hot boost.
    confidence = clamp(before + raw, CONFIDENCE_MIN, CONFIDENCE_MAX);
    const rawDelta = confidence - before;

    // Fatigue (if triggered) is applied to the already-clamped value so the ceiling
    // cannot silently absorb the penalty.
    // isMotm, isDefCon, and isSaveCon are mutually exclusive — the resolver only
    // sets one of them per match. The else-if chain encodes this structurally (§6.4).
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
    } else if (isDefCon) {
      defConFatigueCount += 1;
      if (defConFatigueCount >= FATIGUE_THRESHOLD) {
        const hypotheticalPostFatigue = confidence + FATIGUE_PENALTY;
        if (hypotheticalPostFatigue > 0) {
          confidence = hypotheticalPostFatigue;
          reasonList.push('DC Fatigue −2');
          dcFatigueApplied = true;
        } else {
          reasonList.push('DC Fatigue waived');
        }
        defConFatigueCount = 0;
      }
    } else if (isSaveCon) {
      saveConFatigueCount += 1;
      if (saveConFatigueCount >= FATIGUE_THRESHOLD) {
        const hypotheticalPostFatigue = confidence + FATIGUE_PENALTY;
        if (hypotheticalPostFatigue > 0) {
          confidence = hypotheticalPostFatigue;
          reasonList.push('SC Fatigue −2');
          scFatigueApplied = true;
        } else {
          reasonList.push('SC Fatigue waived');
        }
        saveConFatigueCount = 0;
      }
    }

    history.push({
      gameweek: match.gameweek,
      delta: confidence - before,
      rawDelta,
      reason: reasonList.join(' + '),
      fatigueApplied,
      dcFatigueApplied,
      scFatigueApplied,
      confidenceAfter: confidence,
      motmCounterAfter: motmCount,
      defConCounterAfter: defConFatigueCount,
      saveConCounterAfter: saveConFatigueCount,
    });
  }

  return { finalConfidence: confidence, history };
}
