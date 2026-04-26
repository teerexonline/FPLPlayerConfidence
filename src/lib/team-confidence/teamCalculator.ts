import type { Position } from '@/lib/confidence/types';
import type {
  PositionalRating,
  Result,
  TeamCalculatorInput,
  TeamCalculatorOutput,
  TeamValidationError,
} from './types';

// ── Constants ─────────────────────────────────────────────────────────────────

const STARTER_THRESHOLD = 11; // squadPosition ≤ this = starter
const REQUIRED_PICKS = 15;
const REQUIRED_STARTERS = 11;

// ── Validation ────────────────────────────────────────────────────────────────

function validate(input: TeamCalculatorInput): TeamValidationError | null {
  const total = input.picks.length;
  if (total !== REQUIRED_PICKS) {
    return {
      code: 'WRONG_PICK_COUNT',
      message: `Expected ${REQUIRED_PICKS.toString()} picks, got ${total.toString()}.`,
    };
  }

  const starterCount = input.picks.filter((p) => p.squadPosition <= STARTER_THRESHOLD).length;
  if (starterCount !== REQUIRED_STARTERS) {
    return {
      code: 'WRONG_STARTER_COUNT',
      message: `Expected ${REQUIRED_STARTERS.toString()} starters (squadPosition 1–11), got ${starterCount.toString()}.`,
    };
  }

  return null;
}

// ── Core algorithm ────────────────────────────────────────────────────────────

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function roundTo2dp(n: number): number {
  return Math.round(n * 100) / 100;
}

function groupStarters(input: TeamCalculatorInput): Record<'GK' | 'DEF' | 'MID' | 'FWD', number[]> {
  const groups: Record<'GK' | 'DEF' | 'MID' | 'FWD', number[]> = {
    GK: [],
    DEF: [],
    MID: [],
    FWD: [],
  };

  for (const pick of input.picks) {
    if (pick.squadPosition > STARTER_THRESHOLD) continue;
    const data = input.playerData.get(pick.playerId);
    if (data === undefined) continue;
    groups[data.position].push(data.confidence);
  }

  return groups;
}

function computePositional(
  groups: Record<'GK' | 'DEF' | 'MID' | 'FWD', number[]>,
): PositionalRating {
  // Defence = GK + DEF starters combined
  const defenceValues: number[] = [...groups.GK, ...groups.DEF];
  return {
    defence: mean(defenceValues),
    midfield: mean(groups.MID),
    attack: mean(groups.FWD),
  };
}

/**
 * Piecewise mapping from a confidence value in [-4, +5] to a percentage in [0, 100].
 * 50% is the neutral baseline for both sides regardless of the asymmetric internal scale:
 *   [0, +5] → [50%, 100%]  (positive branch: symmetric 10 pts per %)
 *   [-4, 0) → [0%, 50%)    (negative branch: 12.5 pts per %)
 * Key mappings: −4 → 0%, −2 → 25%, 0 → 50%, +2.5 → 75%, +5 → 100%.
 */
export function confidenceToPercent(value: number): number {
  if (value >= 0) return roundTo2dp(50 + (value / 5) * 50);
  return roundTo2dp(50 + (value / 4) * 50);
}

// ── Public entry point ────────────────────────────────────────────────────────

export function calculateTeamConfidence(
  input: TeamCalculatorInput,
): Result<TeamCalculatorOutput, TeamValidationError> {
  const validationError = validate(input);
  if (validationError !== null) {
    return { ok: false, error: validationError };
  }

  const groups = groupStarters(input);
  const positional = computePositional(groups);

  const lineAverage = mean([positional.defence, positional.midfield, positional.attack]);
  const teamConfidencePercent = confidenceToPercent(lineAverage);

  const starterCount = input.picks.filter((p) => p.squadPosition <= STARTER_THRESHOLD).length;

  return {
    ok: true,
    value: {
      teamConfidencePercent,
      positional,
      starterCount,
    },
  };
}

// Re-export Position for callers building inputs.
export type { Position };
