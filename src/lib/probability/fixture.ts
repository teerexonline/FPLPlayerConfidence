import { BASELINE_TEAM_GOALS_PER_MATCH, FDR_MULTIPLIERS } from './constants';

export interface MatchOpenness {
  /** Player team's expected goals, scaled by FDR. */
  readonly xgPlayerTeam: number;
  /** Opponent team's expected goals, scaled by FDR. */
  readonly xgOpponentTeam: number;
  /**
   * Match openness: total expected goals / baseline total.
   * ~1.0 for an average match; >1 for open games, <1 for defensive battles.
   */
  readonly opennessFactor: number;
  /**
   * Issue 1 correction: team_event_strength = xg_player_team × openness_factor.
   *
   * The base spec (Step 3) computed this value but Step 4 incorrectly used
   * xg_player_team alone. Using teamEventStrength instead means BOTH the player
   * team's FDR (direct) AND match openness (via opponent FDR) feed into the
   * lambda calculation. See docs/v2/fpl_probability_algorithm.md v1.3.1 note.
   */
  readonly teamEventStrength: number;
}

/**
 * Compute match-level attacking context from both teams' FDR values.
 *
 * Step 3 of the probability algorithm. Returns teamEventStrength which is
 * the corrected quantity to feed into Step 4's lambda calculation (Gap A).
 */
export function computeMatchOpenness(
  playerTeamFdr: 1 | 2 | 3 | 4 | 5,
  opponentTeamFdr: 1 | 2 | 3 | 4 | 5,
): MatchOpenness {
  const baseline = BASELINE_TEAM_GOALS_PER_MATCH;

  const xgPlayerTeam = baseline * FDR_MULTIPLIERS[playerTeamFdr];
  const xgOpponentTeam = baseline * FDR_MULTIPLIERS[opponentTeamFdr];

  const matchTotalXg = xgPlayerTeam + xgOpponentTeam;
  const baselineTotalXg = 2 * baseline;
  const opennessFactor = matchTotalXg / baselineTotalXg;

  // Issue 1 fix: teamEventStrength incorporates BOTH the player team's FDR
  // and match openness (opponent FDR). The base spec had xg_player_team here,
  // making Step 3's openness computation a dead calculation.
  const teamEventStrength = xgPlayerTeam * opennessFactor;

  return { xgPlayerTeam, xgOpponentTeam, opennessFactor, teamEventStrength };
}

/** Narrow a raw FDR integer to the valid 1..5 union type, clamping at boundaries. */
export function clampFdr(fdr: number): 1 | 2 | 3 | 4 | 5 {
  const clamped = Math.max(1, Math.min(5, Math.round(fdr)));
  return clamped as 1 | 2 | 3 | 4 | 5;
}
