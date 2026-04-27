import { assert, describe, expect, it } from 'vitest';
import { MAX_ASSIST_PROB, MAX_GOAL_PROB, MIN_MINUTES_FOR_RANKING } from './constants';
import { buildLeagueData, predict } from './predictor';
import type { FixtureInput, PlayerInput } from './types';

/** Safe indexed accessor — fails fast rather than silently returning undefined. */
function at<T>(arr: T[], n: number): T {
  const el = arr.at(n);
  assert(el !== undefined, `arr.at(${String(n)}) is undefined (length=${String(arr.length)})`);
  return el;
}

// ── Fixture helpers ─────────────────────────────────────────────────────────
//
// NOTE ON EXPECTED MINUTES: Since v1.3.2 introduced MAX_INVOLVEMENT_RATIO=0.15,
// cap saturation at 90 min no longer occurs for typical players (median player
// p_goal ≈ 6.5%; top striker in an easy fixture ≈ 34%). Ordering tests still use
// expectedMinutes = 20 to keep probabilities in a narrow range where differences
// are numerically clear, but the old concern about median players hitting 0.65 cap
// no longer applies.

const NEUTRAL_FIXTURE: FixtureInput = { playerTeamFdr: 3, opponentTeamFdr: 3, expectedMinutes: 90 };
const NEUTRAL_SUB: FixtureInput = { playerTeamFdr: 3, opponentTeamFdr: 3, expectedMinutes: 20 };
const EASY_SUB: FixtureInput = { playerTeamFdr: 1, opponentTeamFdr: 3, expectedMinutes: 20 };
const HARD_SUB: FixtureInput = { playerTeamFdr: 5, opponentTeamFdr: 3, expectedMinutes: 20 };

/** 10 FWDs of varying ICT (all with 2700 min, no shrinkage). */
function makeFwdLeague(): PlayerInput[] {
  return Array.from({ length: 10 }, (_, i) => ({
    id: i + 1,
    position: 'FWD' as const,
    minutes: 2700,
    influence: (i + 1) * 100,
    threat: (i + 1) * 200,
    creativity: (i + 1) * 50,
  }));
}

/** Full league: 2 GKs, 5 DEFs, 5 MIDs, 5 FWDs. */
function makeFullLeague(): PlayerInput[] {
  const positions: { pos: PlayerInput['position']; n: number }[] = [
    { pos: 'GK', n: 2 },
    { pos: 'DEF', n: 5 },
    { pos: 'MID', n: 5 },
    { pos: 'FWD', n: 5 },
  ];
  let id = 1;
  const players: PlayerInput[] = [];
  for (const { pos, n } of positions) {
    for (let i = 0; i < n; i++) {
      players.push({
        id: id++,
        position: pos,
        minutes: 2700,
        influence: (i + 1) * 100,
        threat: (i + 1) * 150,
        creativity: (i + 1) * 80,
      });
    }
  }
  return players;
}

// ── buildLeagueData ───────────────────────────────────────────────────────────

describe('buildLeagueData', () => {
  it('includes every player with minutes > 0 in percentilesByPlayer', () => {
    const players = makeFwdLeague();
    const league = buildLeagueData(players);
    expect(league.percentilesByPlayer.size).toBe(players.length);
  });

  it('records the correct season position for each player', () => {
    const players = makeFullLeague();
    const league = buildLeagueData(players);
    for (const p of players) {
      expect(league.percentilesByPlayer.get(p.id)?.seasonPosition).toBe(p.position);
    }
  });

  it('excludes players with minutes == 0 from the cohort', () => {
    const players: PlayerInput[] = [
      { id: 1, position: 'FWD', minutes: 0, influence: 999, threat: 999, creativity: 999 },
      { id: 2, position: 'FWD', minutes: 900, influence: 100, threat: 100, creativity: 100 },
    ];
    const league = buildLeagueData(players);
    expect(league.percentilesByPlayer.has(1)).toBe(false);
    expect(league.percentilesByPlayer.has(2)).toBe(true);
  });

  it('produces cohort medians > 0 for each position group', () => {
    const players = makeFullLeague();
    const league = buildLeagueData(players);
    for (const pos of ['GK', 'DEF', 'MID', 'FWD'] as const) {
      expect(league.cohorts[pos].medianInfluenceP90).toBeGreaterThan(0);
    }
  });
});

// ── predict — Spec test case 1: high-ICT striker at 90 min hits cap ──────────

describe('predict — spec test cases', () => {
  it('(1) star striker (top-percentile) vs easy fixture → p_goal > 0.25', () => {
    const players = makeFwdLeague();
    const league = buildLeagueData(players);
    const starStriker = at(players, players.length - 1);
    // Top-percentile FWD (0.95 pct in 10-player cohort), FDR1 vs FDR3, 90 min.
    // With MAX_INVOLVEMENT_RATIO=0.15: lambda ≈ 0.41 → p_goal ≈ 0.34.
    const result = predict(
      starStriker.id,
      starStriker,
      { ...NEUTRAL_FIXTURE, playerTeamFdr: 1 },
      league,
    );
    expect(result.pGoal).toBeGreaterThan(0.25);
  });

  it('(2) same striker vs hard fixture → lower p_goal than easy fixture (tested at 20 min to avoid cap saturation)', () => {
    const players = makeFwdLeague();
    const league = buildLeagueData(players);
    const striker = at(players, 4); // 50th-percentile player

    const easyResult = predict(striker.id, striker, EASY_SUB, league);
    const hardResult = predict(striker.id, striker, HARD_SUB, league);

    expect(easyResult.pGoal).toBeGreaterThan(hardResult.pGoal);
    expect(easyResult.pGoal - hardResult.pGoal).toBeGreaterThan(0.01);
  });

  it('(3) both-teams FDR 2 → higher p_goal than same player-team FDR 2 vs defensive opponent FDR 4', () => {
    const players = makeFwdLeague();
    const league = buildLeagueData(players);
    const player = at(players, 4);

    const bothOpen = predict(
      player.id,
      player,
      { playerTeamFdr: 2, opponentTeamFdr: 2, expectedMinutes: 20 },
      league,
    );
    const mixed = predict(
      player.id,
      player,
      { playerTeamFdr: 2, opponentTeamFdr: 4, expectedMinutes: 20 },
      league,
    );

    expect(bothOpen.pGoal).toBeGreaterThan(mixed.pGoal);
  });

  it('(4) player with higher creativity percentile has higher p_assist than player with lower creativity percentile', () => {
    // The spec states top-creative MIDs should rank above lower-creative FWDs on p_assist.
    // The algorithm normalises within position groups, so what matters is the PERCENTILE.
    // We construct: target FWD at bottom of a large FWD cohort (low creativity_pct)
    // vs target MID at top of their small cohort (high creativity_pct).
    const players: PlayerInput[] = [
      // 5 FWDs — target FWD (id=1) has the LOWEST creativity in the group
      { id: 1, position: 'FWD', minutes: 2700, influence: 200, threat: 200, creativity: 100 },
      { id: 2, position: 'FWD', minutes: 2700, influence: 200, threat: 200, creativity: 200 },
      { id: 3, position: 'FWD', minutes: 2700, influence: 200, threat: 200, creativity: 300 },
      { id: 4, position: 'FWD', minutes: 2700, influence: 200, threat: 200, creativity: 400 },
      { id: 5, position: 'FWD', minutes: 2700, influence: 200, threat: 200, creativity: 500 },
      // 2 MIDs — target MID (id=10) has the HIGHEST creativity in the group
      { id: 10, position: 'MID', minutes: 2700, influence: 200, threat: 100, creativity: 800 },
      { id: 11, position: 'MID', minutes: 2700, influence: 200, threat: 100, creativity: 200 },
    ];
    const league = buildLeagueData(players);

    // FWD id=1: creativity_pct = (0 + 0.5) / 5 = 0.1 (bottom of FWD cohort)
    // MID id=10: creativity_pct = (1 + 0.5) / 2 = 0.75 (top of MID cohort)
    // → MID has much higher p_assist
    const lowPctFwd = predict(1, at(players, 0), NEUTRAL_SUB, league);
    const highPctMid = predict(10, at(players, 5), NEUTRAL_SUB, league);

    expect(highPctMid.pAssist).toBeGreaterThan(lowPctFwd.pAssist);
  });

  it('(5) player with 60 min and freakish stats does not dominate over stable players by > 6×', () => {
    // The raw per-90 ratio is 135:1 (900 vs 6.7). After shrinkage (60/270 = 0.22 weight),
    // adjusted P90s are 205 vs 6.7 (30:1), yielding percentile ratio ≈ 2.2:1 and a
    // p_goal ratio ≈ 2.2² ≈ 4.8 in the linear lambda region (MAX_INVOLVEMENT_RATIO keeps
    // lambdas well below saturation). The threshold of 6× confirms shrinkage dramatically
    // reduces the raw imbalance while being robust to the linear vs saturation regime.
    const players: PlayerInput[] = [
      { id: 1, position: 'FWD', minutes: 60, influence: 600, threat: 600, creativity: 600 },
      ...Array.from({ length: 5 }, (_, i) => ({
        id: i + 10,
        position: 'FWD' as const,
        minutes: 2700,
        influence: 200,
        threat: 200,
        creativity: 200,
      })),
    ];
    const league = buildLeagueData(players);
    const shortStint = predict(1, at(players, 0), NEUTRAL_SUB, league);
    const stable = predict(10, at(players, 1), NEUTRAL_SUB, league);

    if (stable.pGoal > 0) {
      expect(shortStint.pGoal / stable.pGoal).toBeLessThan(6);
    }
  });

  it('(6) GK always returns p_goal == 0', () => {
    const players: PlayerInput[] = [
      { id: 1, position: 'GK', minutes: 2700, influence: 900, threat: 900, creativity: 900 },
    ];
    const league = buildLeagueData(players);
    const result = predict(1, at(players, 0), { ...NEUTRAL_FIXTURE, playerTeamFdr: 1 }, league);
    expect(result.pGoal).toBe(0);
  });

  it('(6a) GK p_assist is heavily suppressed (< 0.05)', () => {
    const players: PlayerInput[] = [
      { id: 1, position: 'GK', minutes: 2700, influence: 900, threat: 900, creativity: 900 },
    ];
    const league = buildLeagueData(players);
    const result = predict(1, at(players, 0), { ...NEUTRAL_FIXTURE, playerTeamFdr: 1 }, league);
    expect(result.pAssist).toBeLessThan(0.05);
  });

  it('(7) synthetic perfect-score input cannot exceed MAX_GOAL_PROB or MAX_ASSIST_PROB', () => {
    const players: PlayerInput[] = [
      { id: 1, position: 'FWD', minutes: 2700, influence: 99999, threat: 99999, creativity: 99999 },
    ];
    const league = buildLeagueData(players);
    const result = predict(
      1,
      at(players, 0),
      { playerTeamFdr: 1, opponentTeamFdr: 1, expectedMinutes: 90 },
      league,
    );
    expect(result.pGoal).toBeLessThanOrEqual(MAX_GOAL_PROB);
    expect(result.pAssist).toBeLessThanOrEqual(MAX_ASSIST_PROB);
  });

  it('(8) median player (50th pct, neutral fixture, 90 min) → p_goal in [0.04, 0.10]', () => {
    // A single-player cohort produces percentile = 0.5 by definition (mid-rank).
    // With MAX_INVOLVEMENT_RATIO=0.15: pGoalPerEvent = (0.5×0.15)² = 0.005625,
    // lambda = 12 × 0.005625 × 1.0 = 0.0675 → p_goal ≈ 0.065.
    const players: PlayerInput[] = [
      { id: 1, position: 'FWD', minutes: 2700, influence: 500, threat: 500, creativity: 500 },
    ];
    const league = buildLeagueData(players);
    const result = predict(1, at(players, 0), NEUTRAL_FIXTURE, league);
    expect(result.pGoal).toBeGreaterThan(0.04);
    expect(result.pGoal).toBeLessThan(0.1);
  });

  it('(9) top-percentile striker FDR1 at 90 min → p_goal in [0.25, 0.45]', () => {
    // Top FWD (0.95 pct in a 10-player cohort) vs easy FDR1 fixture at 90 min.
    // With MAX_INVOLVEMENT_RATIO=0.15: pGoalPerEvent = (0.95×0.15)² ≈ 0.0203,
    // team_events ≈ 20.2 (FDR1 vs FDR3), lambda ≈ 0.41 → p_goal ≈ 0.34.
    const players = makeFwdLeague();
    const league = buildLeagueData(players);
    const starStriker = at(players, players.length - 1);
    const result = predict(
      starStriker.id,
      starStriker,
      { playerTeamFdr: 1, opponentTeamFdr: 3, expectedMinutes: 90 },
      league,
    );
    expect(result.pGoal).toBeGreaterThan(0.25);
    expect(result.pGoal).toBeLessThan(0.45);
  });
});

// ── predict — Additional behavioural tests ─────────────────────────────────

describe('predict — additional behaviours', () => {
  it('player with expectedMinutes == 0 returns (0, 0)', () => {
    const players = makeFwdLeague();
    const league = buildLeagueData(players);
    const result = predict(
      at(players, 9).id,
      at(players, 9),
      { playerTeamFdr: 1, opponentTeamFdr: 1, expectedMinutes: 0 },
      league,
    );
    expect(result.pGoal).toBe(0);
    expect(result.pAssist).toBe(0);
  });

  it('defender effective position FWD removes DEFENDER_THREAT_SCALE → higher p_goal (tested at 20 min)', () => {
    // Three DEFs so the top defender has ~83rd-percentile threat
    const players: PlayerInput[] = [
      { id: 1, position: 'DEF', minutes: 2700, influence: 300, threat: 900, creativity: 100 },
      { id: 2, position: 'DEF', minutes: 2700, influence: 200, threat: 600, creativity: 80 },
      { id: 3, position: 'DEF', minutes: 2700, influence: 100, threat: 300, creativity: 60 },
    ];
    const league = buildLeagueData(players);
    const topDef = at(players, 0);

    const asDefender = predict(topDef.id, topDef, NEUTRAL_SUB, league);
    const asForward = predict(
      topDef.id,
      topDef,
      { ...NEUTRAL_SUB, effectivePosition: 'FWD' },
      league,
    );

    expect(asForward.pGoal).toBeGreaterThan(asDefender.pGoal);
  });

  it('effective position FWD boost increases p_goal for MID deployed as striker', () => {
    const players: PlayerInput[] = [
      { id: 1, position: 'MID', minutes: 2700, influence: 300, threat: 400, creativity: 200 },
      { id: 2, position: 'MID', minutes: 2700, influence: 200, threat: 300, creativity: 150 },
    ];
    const league = buildLeagueData(players);
    const mid = at(players, 0);

    const asMid = predict(mid.id, mid, NEUTRAL_SUB, league);
    const asFwd = predict(mid.id, mid, { ...NEUTRAL_SUB, effectivePosition: 'FWD' }, league);

    expect(asFwd.pGoal).toBeGreaterThanOrEqual(asMid.pGoal);
  });

  it('DEFENDER_THREAT_SCALE suppresses top defender p_goal well below top striker p_goal in same fixture', () => {
    const players: PlayerInput[] = [
      { id: 1, position: 'DEF', minutes: 2700, influence: 200, threat: 500, creativity: 100 },
      { id: 2, position: 'FWD', minutes: 2700, influence: 200, threat: 500, creativity: 100 },
    ];
    const league = buildLeagueData(players);

    // Both at 50th percentile in their own group (single-player groups → pct = 0.5)
    // DEF gets threat_pct * DEFENDER_THREAT_SCALE = 0.5 * 0.35 = 0.175
    // FWD gets threat_pct = 0.5 (no scaling)
    const defResult = predict(1, at(players, 0), NEUTRAL_SUB, league);
    const fwdResult = predict(2, at(players, 1), NEUTRAL_SUB, league);

    expect(defResult.pGoal).toBeLessThan(fwdResult.pGoal);
  });

  it('Gap D: teamConversionFactor > 1 increases p_assist (tested at 20 min)', () => {
    const players = makeFwdLeague();
    const league = buildLeagueData(players);
    const player = at(players, 3); // 40th percentile

    const baseline = predict(player.id, player, NEUTRAL_SUB, league);
    const clinical = predict(
      player.id,
      player,
      { ...NEUTRAL_SUB, teamConversionFactor: 1.5 },
      league,
    );

    expect(clinical.pAssist).toBeGreaterThan(baseline.pAssist);
  });

  it('Gap D: teamConversionFactor < 1 decreases p_assist', () => {
    const players = makeFwdLeague();
    const league = buildLeagueData(players);
    const player = at(players, 3);

    const baseline = predict(player.id, player, NEUTRAL_SUB, league);
    const profligate = predict(
      player.id,
      player,
      { ...NEUTRAL_SUB, teamConversionFactor: 0.5 },
      league,
    );

    expect(profligate.pAssist).toBeLessThan(baseline.pAssist);
  });

  it('Gap D: teamConversionFactor only affects p_assist, not p_goal', () => {
    const players = makeFwdLeague();
    const league = buildLeagueData(players);
    const player = at(players, 3);

    const baseline = predict(player.id, player, NEUTRAL_SUB, league);
    const clinical = predict(
      player.id,
      player,
      { ...NEUTRAL_SUB, teamConversionFactor: 1.5 },
      league,
    );

    expect(clinical.pGoal).toBeCloseTo(baseline.pGoal, 8);
    expect(clinical.pAssist).not.toBeCloseTo(baseline.pAssist, 8);
  });

  it('higher expectedMinutes produces higher p_goal (monotonic)', () => {
    const players = makeFwdLeague();
    const league = buildLeagueData(players);
    const player = at(players, 2); // 30th percentile — low enough to avoid cap at 25 min

    const sub = predict(
      player.id,
      player,
      { playerTeamFdr: 3, opponentTeamFdr: 3, expectedMinutes: 20 },
      league,
    );
    const starter = predict(
      player.id,
      player,
      { playerTeamFdr: 3, opponentTeamFdr: 3, expectedMinutes: 90 },
      league,
    );

    expect(starter.pGoal).toBeGreaterThan(sub.pGoal);
    expect(starter.pAssist).toBeGreaterThan(sub.pAssist);
  });

  it('returns playerId matching the input', () => {
    const players = makeFwdLeague();
    const league = buildLeagueData(players);
    const player = at(players, 3);
    const result = predict(player.id, player, NEUTRAL_FIXTURE, league);
    expect(result.playerId).toBe(player.id);
  });

  it('p_goal and p_assist are always non-negative across all fixtures', () => {
    const players = makeFullLeague();
    const league = buildLeagueData(players);
    const fdrs = [1, 2, 3, 4, 5] as const;
    for (const p of players) {
      for (const fdr of fdrs) {
        const result = predict(
          p.id,
          p,
          { playerTeamFdr: fdr, opponentTeamFdr: 3, expectedMinutes: 90 },
          league,
        );
        expect(result.pGoal).toBeGreaterThanOrEqual(0);
        expect(result.pAssist).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('player not in league (unknown id) returns (0, 0)', () => {
    const players = makeFwdLeague();
    const league = buildLeagueData(players);
    const ghost: PlayerInput = {
      id: 9999,
      position: 'FWD',
      minutes: 2700,
      influence: 200,
      threat: 200,
      creativity: 200,
    };
    const result = predict(9999, ghost, NEUTRAL_FIXTURE, league);
    expect(result.pGoal).toBe(0);
    expect(result.pAssist).toBe(0);
  });

  it('minutes == 0 player not in cohort when minutes > 0 needed for shrinkage test', () => {
    // Verifies low-minutes (MIN_MINUTES/3) player doesn't get shrunken to exactly median
    const players: PlayerInput[] = [
      {
        id: 1,
        position: 'FWD',
        minutes: MIN_MINUTES_FOR_RANKING / 3,
        influence: 300,
        threat: 300,
        creativity: 300,
      },
      { id: 2, position: 'FWD', minutes: 2700, influence: 100, threat: 100, creativity: 100 },
    ];
    const league = buildLeagueData(players);
    // Player 1 has much higher absolute ICT but only 1/3 of the min threshold
    // After shrinkage, they should still rank higher than player 2
    const p1 = predict(1, at(players, 0), NEUTRAL_SUB, league);
    const p2 = predict(2, at(players, 1), NEUTRAL_SUB, league);
    // p1's adjusted ICT is shrinkage * high + (1-shrinkage) * median
    // They should still produce higher probabilities than the low-ICT stable player
    expect(p1.pGoal).toBeGreaterThanOrEqual(p2.pGoal);
  });
});
