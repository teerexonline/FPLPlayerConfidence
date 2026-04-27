/**
 * Tunable constants for the FPL Goal & Assist Probability algorithm (v1.3 + patches).
 *
 * Source: docs/v2/fpl_probability_algorithm.md (v1.3.2 spec)
 *         docs/v2/fpl_probability_algorithm_v1.3_patch.md (Gap A, C, D)
 *
 * These are calibration starting points. Once backtest results are available
 * (docs/v2/calibration-results.md), revisit BASELINE_TEAM_GOALS_PER_MATCH,
 * FDR_MULTIPLIERS, and the probability caps.
 */

/** Premier League long-run average goals per team per match. */
export const BASELINE_TEAM_GOALS_PER_MATCH = 1.4;

/**
 * Scales all three per-event probability components (p_involved,
 * p_goal_given_involved, p_assist_given_involved) from raw percentile ranks
 * (0..1) into realistic involvement shares.
 *
 * Without scaling, raw percentiles used directly as probabilities produce
 * lambdas >> 3 at 90 min for median players, saturating the probability caps.
 * With 0.15, the median outfield player produces p_goal ≈ 6–7% at 90 min (neutral
 * fixture), while the top striker in an easy fixture reaches ~33%. The caps
 * (MAX_GOAL_PROB, MAX_ASSIST_PROB) remain as safety rails but stop dominating.
 *
 * v1.3.2 calibration fix — see docs/v2/fpl_probability_algorithm.md changelog.
 */
export const MAX_INVOLVEMENT_RATIO = 0.15;

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
 * GK assist probability is multiplied by this factor. Goalkeepers rarely assist
 * outside of very unusual circumstances; the ICT Creativity model is not designed
 * for them (spec §Step 5).
 */
export const GK_ASSIST_SCALE = 0.05;
