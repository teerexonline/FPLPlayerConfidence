/**
 * Tunable constants for the FPL Goal & Assist Probability algorithm (v1.3 + patches).
 *
 * Source: docs/v2/fpl_probability_algorithm.md (v1.3.3 spec)
 *         docs/v2/fpl_probability_algorithm_v1.3_patch.md (Gap A, C, D)
 *
 * These are calibration starting points. Once backtest results are available
 * (docs/v2/calibration-results.md), revisit BASELINE_TEAM_GOALS_PER_MATCH,
 * FDR_MULTIPLIERS, and the probability caps.
 */

/** Premier League long-run average goals per team per match. */
export const BASELINE_TEAM_GOALS_PER_MATCH = 1.4;

/**
 * Base involvement ratio — the reference scaling constant for MID (the baseline
 * position). Applied to all three per-event probability components before
 * position-specific multipliers are applied (v1.3.2 calibrated value).
 *
 * Without scaling, raw percentiles produce lambdas >> 3 at 90 min for median
 * players, saturating the probability caps. With 0.15, a median MID produces
 * p_goal ≈ 6.5% at 90 min (neutral fixture). The position-specific multipliers
 * in INVOLVEMENT_MULTIPLIERS layer on top to handle inter-position differences.
 *
 * v1.3.2 calibrated value (unchanged from v1.3.2 — only the multipliers move).
 * v1.3.3 renamed from MAX_INVOLVEMENT_RATIO; FWD/DEF scaling extracted to INVOLVEMENT_MULTIPLIERS.
 */
export const BASE_INVOLVEMENT_RATIO = 0.15;

/**
 * Position-specific multipliers applied on top of BASE_INVOLVEMENT_RATIO.
 *
 * Captures structural differences in how often each position converts attacking
 * event involvement into goals vs assists. MID = 1.0 by definition (the reference
 * position; its predictions are identical to the v1.3.2 single-constant model).
 *
 * Only goal and assist multipliers are position-specific. p_involved keeps just
 * the base constant — being involved in attacking events is roughly position-agnostic
 * within each position's own percentile cohort.
 *
 * GK is included for type completeness. GK goal probability is zeroed in Step 5
 * regardless; the GK assist multiplier (0.05) replaces the former GK_ASSIST_SCALE
 * and captures that goalkeepers almost never register attacking assists.
 *
 * Calibration history in docs/v2/calibration-results.md. Starting values are
 * intuition-informed; the backtest iteration loop will adjust them empirically.
 */
export const INVOLVEMENT_MULTIPLIERS: Readonly<
  Record<'GK' | 'DEF' | 'MID' | 'FWD', { readonly goal: number; readonly assist: number }>
> = {
  GK: { goal: 0.0, assist: 0.05 }, // GK goal zeroed in Step 5; assist replaces GK_ASSIST_SCALE
  DEF: { goal: 0.7, assist: 1.0 }, // Defenders score ~5–10% of league goals
  MID: { goal: 1.0, assist: 1.0 }, // Reference baseline — identical to v1.3.2
  FWD: { goal: 1.5, assist: 0.8 }, // Forwards score more goals, create fewer assists
} as const;

/**
 * Gap A (patch): expected attacking events per match for a league-average team.
 * Introduced to fix the Poisson interpretation: team xG is NOT the same as the
 * count of attacking events. This constant converts xG into an event count.
 * step 4 formula: team_events = BASELINE_ATTACKING_EVENTS * (team_event_strength / BASELINE_GOALS)
 */
export const BASELINE_ATTACKING_EVENTS_PER_MATCH = 12;

/**
 * Maps a team's Fixture Difficulty Rating to an xG multiplier.
 * Low FDR = easy fixture = higher expected goals; high FDR = hard fixture.
 */
export const FDR_MULTIPLIERS: Readonly<Record<1 | 2 | 3 | 4 | 5, number>> = {
  1: 1.4,
  2: 1.2,
  3: 1.0,
  4: 0.8,
  5: 0.6,
};

/** Hard ceiling on p_goal output. */
export const MAX_GOAL_PROB = 0.65;

/** Hard ceiling on p_assist output. */
export const MAX_ASSIST_PROB = 0.55;

/**
 * Players with fewer than this many minutes get their per-90 stats shrunk
 * toward the position median, reducing small-sample-size distortion.
 */
export const MIN_MINUTES_FOR_RANKING = 270;

/**
 * After computing position-relative Threat percentile for defenders, scale it
 * by this factor. Defenders score ~5–10% of league goals; without this, a
 * top-percentile attacking fullback would get the same goal probability as a
 * top-percentile striker, which is wrong.
 * Applied when effective_position == "DEF" (spec v1.1, effective-position-aware v1.3).
 */
export const DEFENDER_THREAT_SCALE = 0.35;

/**
 * Weight blending recent form-based xG against the FDR baseline (v1.1 optional).
 * Default 0 keeps v1.0 behavior (FDR-only). Set to ~0.4 when rolling xG data
 * is available. FPL bootstrap-static does not expose per-team rolling xG, so
 * this stays at 0 for all current implementations.
 */
export const FORM_WEIGHT = 0.0;

/**
 * Gap D (patch): league-average team conversion rate (goals / shots on target).
 * Used to normalise per-team conversion into a factor applied to the assist lambda.
 * Shots on target are not available from the FPL API; callers who have external
 * data can compute the factor and pass it in via FixtureInput.teamConversionFactor.
 */
export const LEAGUE_AVG_CONVERSION = 0.33;

/**
 * @deprecated Superseded by INVOLVEMENT_MULTIPLIERS['GK'].assist in v1.3.3.
 * The GK assist scaling is now applied in Step 4 via the position multiplier
 * rather than as a post-hoc Step 5 correction. Retained for export compatibility.
 */
export const GK_ASSIST_SCALE = 0.05;
