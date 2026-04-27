import { describe, expect, it } from 'vitest';
import { BASELINE_TEAM_GOALS_PER_MATCH, FDR_MULTIPLIERS } from './constants';
import { computeMatchOpenness, MatchOpenness } from './fixture';

// Helper: derive expected values from constants for round-trip verification
const BASELINE = BASELINE_TEAM_GOALS_PER_MATCH; // 1.4
const BASELINE_TOTAL = 2 * BASELINE; // 2.8

describe('computeMatchOpenness', () => {
  it('neutral match (both FDR 3) produces openness_factor = 1 and team_event_strength = BASELINE_XG', () => {
    const result = computeMatchOpenness(3, 3);

    // Both multipliers are 1.0 (FDR 3 = neutral)
    const xgPlayer = BASELINE * FDR_MULTIPLIERS[3]; // 1.4
    const xgOpponent = BASELINE * FDR_MULTIPLIERS[3]; // 1.4
    const openness = (xgPlayer + xgOpponent) / BASELINE_TOTAL; // 1.0

    expect(result.xgPlayerTeam).toBeCloseTo(xgPlayer, 5);
    expect(result.xgOpponentTeam).toBeCloseTo(xgOpponent, 5);
    expect(result.opennessFactor).toBeCloseTo(1.0, 5);
    expect(result.teamEventStrength).toBeCloseTo(xgPlayer * openness, 5);
  });

  it('easy fixture (player FDR 1, opponent FDR 5) gives highest team event strength', () => {
    const easy = computeMatchOpenness(1, 5); // player team has FDR 1 = easy
    const hard = computeMatchOpenness(5, 1); // player team has FDR 5 = hard

    expect(easy.xgPlayerTeam).toBeGreaterThan(hard.xgPlayerTeam);
    expect(easy.teamEventStrength).toBeGreaterThan(hard.teamEventStrength);
  });

  it('both-teams-attack (FDR 1 each) boosts teamEventStrength above a neutral match', () => {
    // When both teams have easy fixtures, overall match openness is high
    const bothAttack = computeMatchOpenness(1, 1);
    const neutral = computeMatchOpenness(3, 3);

    expect(bothAttack.opennessFactor).toBeGreaterThan(neutral.opennessFactor);
    expect(bothAttack.teamEventStrength).toBeGreaterThan(neutral.teamEventStrength);
  });

  it('both-teams-defend (FDR 5 each) suppresses teamEventStrength below a neutral match', () => {
    const bothDefend = computeMatchOpenness(5, 5);
    const neutral = computeMatchOpenness(3, 3);

    expect(bothDefend.opennessFactor).toBeLessThan(neutral.opennessFactor);
    expect(bothDefend.teamEventStrength).toBeLessThan(neutral.teamEventStrength);
  });

  it('FDR 1 vs 5 mismatch: openness_factor ≈ 1.0 (strong attack cancels strong defense)', () => {
    // Player team FDR=1 (easy) + Opponent FDR=5 (hard for opponent → opponent attacks a lot)
    // This is actually: player team is strong attacker, opponent is also strong attacker
    // Total xg = 1.4*1.4 + 1.4*0.6 = 1.96 + 0.84 = 2.8 = baseline → openness = 1.0
    const result = computeMatchOpenness(1, 5);
    expect(result.opennessFactor).toBeCloseTo(1.0, 4);
  });

  it('Issue 1 correction: teamEventStrength uses xg_player_team × openness (not raw xg)', () => {
    // Verify Issue 1 fix: team_event_strength = xg_player_team * openness_factor
    // (NOT xg_player_team alone, which was the transcription error in the base spec)
    const result = computeMatchOpenness(1, 1);
    const expectedTeamEventStrength = result.xgPlayerTeam * result.opennessFactor;
    expect(result.teamEventStrength).toBeCloseTo(expectedTeamEventStrength, 5);

    // For FDR 1 vs FDR 1: xg = 1.4*1.4=1.96, openness=(1.96+1.96)/2.8=1.4
    // teamEventStrength = 1.96 * 1.4 = 2.744 (NOT 1.96 as the raw xg alone would be)
    expect(result.teamEventStrength).toBeGreaterThan(result.xgPlayerTeam);
  });

  it('output fields match the MatchOpenness type', () => {
    const result: MatchOpenness = computeMatchOpenness(2, 4);
    expect(typeof result.xgPlayerTeam).toBe('number');
    expect(typeof result.xgOpponentTeam).toBe('number');
    expect(typeof result.opennessFactor).toBe('number');
    expect(typeof result.teamEventStrength).toBe('number');
  });

  it('all FDR combinations produce positive output', () => {
    const fdrs = [1, 2, 3, 4, 5] as const;
    for (const p of fdrs) {
      for (const o of fdrs) {
        const result = computeMatchOpenness(p, o);
        expect(result.xgPlayerTeam).toBeGreaterThan(0);
        expect(result.xgOpponentTeam).toBeGreaterThan(0);
        expect(result.opennessFactor).toBeGreaterThan(0);
        expect(result.teamEventStrength).toBeGreaterThan(0);
      }
    }
  });
});
