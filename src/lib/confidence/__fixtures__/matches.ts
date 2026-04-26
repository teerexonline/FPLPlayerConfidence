import type { MatchEvent } from '../types';

export const aMatch = (overrides: Partial<MatchEvent> = {}): MatchEvent => ({
  gameweek: 1,
  opponentTeamId: 1,
  opponentFdr: 3, // neutral — FDR 3 multiplier is ×1.0 on both sides
  minutesPlayed: 90,
  goals: 0,
  assists: 0,
  cleanSheet: false,
  saves: 0,
  defensiveContribution: 0,
  ...overrides,
});
