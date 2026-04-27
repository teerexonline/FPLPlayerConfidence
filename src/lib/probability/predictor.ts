import {
  BASELINE_ATTACKING_EVENTS_PER_MATCH,
  BASELINE_TEAM_GOALS_PER_MATCH,
  DEFENDER_THREAT_SCALE,
  GK_ASSIST_SCALE,
  MAX_ASSIST_PROB,
  MAX_GOAL_PROB,
} from './constants';
import { clampFdr, computeMatchOpenness } from './fixture';
import { buildPositionCohort, computePercentileRanks } from './normalize';
import type {
  FixtureInput,
  LeagueData,
  PlayerInput,
  PlayerPrediction,
  Position,
  PositionCohort,
} from './types';

/**
 * Precompute the league cohort data needed for all player predictions in a
 * given gameweek. Call once per gameweek; pass the result to predict().
 *
 * Players with minutes == 0 are excluded from cohort percentile computation
 * but may still receive predictions if the caller passes them to predict()
 * (they'll get 0,0 due to the expectedMinutes guard).
 */
export function buildLeagueData(players: readonly PlayerInput[]): LeagueData {
  const positions: readonly Position[] = ['GK', 'DEF', 'MID', 'FWD'];

  const zeroCohort: PositionCohort = {
    medianInfluenceP90: 0,
    medianThreatP90: 0,
    medianCreativityP90: 0,
  };
  const cohorts: Record<Position, PositionCohort> = {
    GK: zeroCohort,
    DEF: zeroCohort,
    MID: zeroCohort,
    FWD: zeroCohort,
  };
  for (const pos of positions) {
    const group = players.filter((p) => p.position === pos && p.minutes > 0);
    cohorts[pos] = group.length > 0 ? buildPositionCohort(group) : zeroCohort;
  }

  const percentilesByPlayer = computePercentileRanks(players);

  return { cohorts, percentilesByPlayer };
}

/**
 * Predict p_goal and p_assist for a single player in a single fixture.
 *
 * Implements Steps 2–5 of the v1.3 spec with all patches applied:
 *   - Gap A: uses BASELINE_ATTACKING_EVENTS_PER_MATCH and teamEventStrength (Issue 1 fix)
 *   - Gap C: effective_role removed
 *   - Gap D: teamConversionFactor applied to lambda_assist only
 *
 * @param playerId - Used for the returned PlayerPrediction.playerId
 * @param player   - Player season stats (position, minutes, ICT)
 * @param fixture  - Per-fixture context (FDR, expected minutes, optional overrides)
 * @param league   - Precomputed cohort data from buildLeagueData()
 */
export function predict(
  playerId: number,
  player: PlayerInput,
  fixture: FixtureInput,
  league: LeagueData,
): PlayerPrediction {
  // Guard: player not expected to play → (0, 0)
  if (fixture.expectedMinutes <= 0) {
    return { playerId, pGoal: 0, pAssist: 0 };
  }

  const seasonPos = player.position;
  const effectivePos = fixture.effectivePosition ?? seasonPos;

  // ── Step 2: retrieve precomputed percentiles for this player ─────────────
  const percentiles = league.percentilesByPlayer.get(playerId);
  if (!percentiles) {
    // Player not in cohort (0 minutes or not in players list) → (0, 0)
    return { playerId, pGoal: 0, pAssist: 0 };
  }

  const { influencePct, creativityPct } = percentiles;
  let { threatPct } = percentiles;

  // Defender Threat Scale: apply when effective position is DEF (not season DEF).
  // Prevents top-percentile attacking fullbacks from matching strikers on p_goal.
  if (effectivePos === 'DEF') {
    threatPct = threatPct * DEFENDER_THREAT_SCALE;
  }

  // Lightweight Threat boost when a non-FWD is deployed as a striker.
  // Conservative 1.25× — their history still mostly reflects normal deployment.
  if (effectivePos === 'FWD' && (seasonPos === 'MID' || seasonPos === 'DEF')) {
    threatPct = Math.min(threatPct * 1.25, 1.0);
  }

  // ── Step 3: match openness (both teams' FDR) ─────────────────────────────
  const { teamEventStrength } = computeMatchOpenness(
    clampFdr(fixture.playerTeamFdr),
    clampFdr(fixture.opponentTeamFdr),
  );

  // ── Step 4: per-player lambdas ────────────────────────────────────────────
  const pInvolved = influencePct;
  const pGoalGivenInvolved = threatPct;
  const pAssistGivenInvolved = creativityPct;

  const pGoalPerEvent = pInvolved * pGoalGivenInvolved;
  const pAssistPerEvent = pInvolved * pAssistGivenInvolved;

  const minutesFactor = fixture.expectedMinutes / 90;

  // Gap A (patch): team_events uses teamEventStrength (Issue 1 fix), not raw xg_player_team.
  // team_events = BASELINE_EVENTS × (teamEventStrength / BASELINE_GOALS)
  const teamEvents =
    BASELINE_ATTACKING_EVENTS_PER_MATCH * (teamEventStrength / BASELINE_TEAM_GOALS_PER_MATCH);

  const lambdaGoal = teamEvents * pGoalPerEvent * minutesFactor;

  // Gap D (patch): teamConversionFactor scales the assist lambda only.
  // Default 1.0 (league average) when not provided.
  const conversionFactor = fixture.teamConversionFactor ?? 1.0;
  const lambdaAssist = teamEvents * pAssistPerEvent * minutesFactor * conversionFactor;

  let pGoal = 1 - Math.exp(-lambdaGoal);
  let pAssist = 1 - Math.exp(-lambdaAssist);

  // ── Step 5: caps and GK special-case ─────────────────────────────────────
  // GKs never score; their Creativity model isn't calibrated for assists.
  if (seasonPos === 'GK') {
    pGoal = 0;
    pAssist = pAssist * GK_ASSIST_SCALE;
  }

  pGoal = Math.min(pGoal, MAX_GOAL_PROB);
  pAssist = Math.min(pAssist, MAX_ASSIST_PROB);

  return { playerId, pGoal, pAssist };
}
