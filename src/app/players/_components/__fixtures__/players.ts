import type { PlayerWithConfidence } from '../types';
import { playerId, teamId } from '@/lib/db';

export function makePlayer(overrides: Partial<PlayerWithConfidence> = {}): PlayerWithConfidence {
  return {
    id: playerId(1),
    webName: 'Test Player',
    teamId: teamId(1),
    teamCode: 14,
    teamShortName: 'TST',
    position: 'MID',
    nowCost: 100,
    confidence: 0,
    recentDeltas: [1, 0, -1, 1, 0],
    gameweek: 20,
    status: 'a',
    chanceOfPlaying: null,
    news: '',
    recentAppearances: 3,
    ...overrides,
  };
}

export const SALAH = makePlayer({
  id: playerId(100),
  webName: 'M. Salah',
  teamShortName: 'LIV',
  teamCode: 14,
  position: 'MID',
  nowCost: 130,
  confidence: 3,
  recentDeltas: [2, 1, 2, 3, 2],
});

export const HAALAND = makePlayer({
  id: playerId(200),
  webName: 'E. Haaland',
  teamShortName: 'MCI',
  teamCode: 43,
  position: 'FWD',
  nowCost: 145,
  confidence: 0,
  recentDeltas: [1, -1, 1, -1, 0],
});

export const SAKA = makePlayer({
  id: playerId(300),
  webName: 'B. Saka',
  teamShortName: 'ARS',
  teamCode: 3,
  position: 'MID',
  nowCost: 100,
  confidence: 2,
  recentDeltas: [1, 2, -1, 2, 1],
});

export const VAN_DIJK = makePlayer({
  id: playerId(400),
  webName: 'V. van Dijk',
  teamShortName: 'LIV',
  teamCode: 14,
  position: 'DEF',
  nowCost: 65,
  confidence: 0,
  recentDeltas: [-1, -1, 1, -1, 0],
});

export const PICKFORD = makePlayer({
  id: playerId(500),
  webName: 'J. Pickford',
  teamShortName: 'EVE',
  teamCode: 11,
  position: 'GK',
  nowCost: 55,
  confidence: -4,
  recentDeltas: [-1, -1, -1, -1, -1],
});

export const SMOKE_PLAYERS: readonly PlayerWithConfidence[] = [
  SALAH,
  HAALAND,
  SAKA,
  VAN_DIJK,
  PICKFORD,
];
