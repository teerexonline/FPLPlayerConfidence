import type { Position } from '@/lib/confidence/types';

/** One player in a manager's squad as returned by the picks endpoint. */
export interface SquadPick {
  readonly playerId: number;
  readonly squadPosition: number; // 1–15; 1–11 = starters, 12–15 = bench
  readonly isCaptain: boolean;
  readonly isViceCaptain: boolean;
}

/** Input to the team calculator. */
export interface TeamCalculatorInput {
  readonly picks: readonly SquadPick[];
  /** Map from playerId → { confidence, position } — caller resolves from confidence snapshots. */
  readonly playerData: ReadonlyMap<
    number,
    { readonly confidence: number; readonly position: Position }
  >;
}

/** Positional line averages, each in [-5, +5]. */
export interface PositionalRating {
  readonly defence: number; // average of GK + all DEF starters
  readonly midfield: number; // average of all MID starters
  readonly attack: number; // average of all FWD starters
}

export interface TeamCalculatorOutput {
  readonly teamConfidencePercent: number; // 0..100, two decimal places
  readonly positional: PositionalRating;
  readonly starterCount: number; // always 11 for a valid squad
}

// ── Validation ────────────────────────────────────────────────────────────────

export type TeamValidationErrorCode =
  | 'WRONG_PICK_COUNT' // total picks ≠ 15
  | 'WRONG_STARTER_COUNT'; // starters (squadPosition 1–11) ≠ 11
// Note: bench count is omitted — it is always 15−11=4 once the two checks above pass.

export interface TeamValidationError {
  readonly code: TeamValidationErrorCode;
  readonly message: string;
}

// ── Result monad ─────────────────────────────────────────────────────────────

export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };
