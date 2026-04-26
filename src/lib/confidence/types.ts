export type Position = 'GK' | 'DEF' | 'MID' | 'FWD';

export interface MatchEvent {
  readonly gameweek: number; // 1..38
  readonly opponentTeamId: number;
  readonly opponentFdr: number; // 1–5 integer from FPL fixtures endpoint
  readonly minutesPlayed: number; // > 0 by precondition (caller filters)
  readonly goals: number;
  readonly assists: number;
  readonly cleanSheet: boolean; // true iff minutes >= 60 AND team conceded 0
  readonly saves: number; // non-negative integer from FPL match history
  readonly defensiveContribution: number; // raw aggregate from FPL; 0 when unavailable
}

export interface CalculatorInput {
  readonly position: Position;
  readonly matches: readonly MatchEvent[]; // chronological, appearances only
}

export interface MatchDelta {
  readonly gameweek: number;
  readonly delta: number; // post-clamp net change
  readonly reason: string;
  readonly fatigueApplied: boolean;
  readonly confidenceAfter: number; // clamped, -4..+5
  readonly motmCounterAfter: number;
}

export interface CalculatorOutput {
  readonly finalConfidence: number;
  readonly history: readonly MatchDelta[];
}
