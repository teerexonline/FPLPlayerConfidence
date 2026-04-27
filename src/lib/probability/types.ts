export type Position = 'GK' | 'DEF' | 'MID' | 'FWD';

/**
 * Season-aggregate stats for one player, sourced from FPL bootstrap-static.
 * ICT values are numeric (callers parse the FPL API strings before passing in).
 * Only players with minutes > 0 should be included in league cohorts.
 */
export interface PlayerInput {
  readonly id: number;
  readonly position: Position;
  readonly minutes: number; // season total
  readonly influence: number; // season total
  readonly threat: number; // season total
  readonly creativity: number; // season total
}

/**
 * Per-fixture context for one player.
 * FDRs are from the FPL fixtures endpoint (team_h_difficulty / team_a_difficulty).
 */
export interface FixtureInput {
  readonly playerTeamFdr: number; // 1..5 — difficulty facing the player's team
  readonly opponentTeamFdr: number; // 1..5 — difficulty facing the opponent
  readonly expectedMinutes: number; // 0..90 projected playing time for this fixture
  readonly effectivePosition?: Position; // tactical override (v1.3); defaults to season position
  /**
   * Gap D (patch): team finishing efficiency, clamped to [0.5, 1.5].
   * 1.0 = league-average conversion (default; no adjustment).
   * Computed externally as (team_goals_scored / team_shots_on_target) / LEAGUE_AVG_CONVERSION.
   * Defaults to 1.0 when not provided (FPL API does not expose shot data).
   */
  readonly teamConversionFactor?: number;
}

/**
 * Per-position summary used during shrinkage (median per-90 values).
 */
export interface PositionCohort {
  readonly medianInfluenceP90: number;
  readonly medianThreatP90: number;
  readonly medianCreativityP90: number;
}

/**
 * Pre-computed percentile ranks for one player within their season-default
 * position cohort. Percentiles are raw (no effective-position adjustments);
 * adjustments are applied at prediction time.
 */
export interface PlayerPercentiles {
  readonly seasonPosition: Position;
  readonly influencePct: number; // 0..1
  readonly threatPct: number; // 0..1
  readonly creativityPct: number; // 0..1
}

/**
 * Precomputed league data — build once per gameweek, reuse for all predictions.
 */
export interface LeagueData {
  readonly cohorts: Readonly<Record<Position, PositionCohort>>;
  readonly percentilesByPlayer: ReadonlyMap<number, PlayerPercentiles>;
}

/** Output of predict(). Probabilities are bounded by MAX_GOAL_PROB / MAX_ASSIST_PROB. */
export interface PlayerPrediction {
  readonly playerId: number;
  readonly pGoal: number; // 0..MAX_GOAL_PROB
  readonly pAssist: number; // 0..MAX_ASSIST_PROB
}
