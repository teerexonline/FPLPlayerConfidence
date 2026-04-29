import { describe, expect, it } from 'vitest';
import { computeFormation } from './computeFormation';
import type { SquadPlayerRow } from './types';

function makeStarters(positions: ('GK' | 'DEF' | 'MID' | 'FWD')[]): SquadPlayerRow[] {
  return positions.map((position, i) => ({
    playerId: i + 1,
    webName: `Player${(i + 1).toString()}`,
    teamCode: 14,
    teamShortName: 'LIV',
    position,
    squadPosition: i + 1,
    isCaptain: false,
    isViceCaptain: false,
    confidence: 0,
    status: 'a',
    chanceOfPlaying: null,
    news: '',
    hotStreak: null,
  }));
}

describe('computeFormation', () => {
  it('4-3-3: 1 GK + 4 DEF + 3 MID + 3 FWD', () => {
    const starters = makeStarters([
      'GK',
      'DEF',
      'DEF',
      'DEF',
      'DEF',
      'MID',
      'MID',
      'MID',
      'FWD',
      'FWD',
      'FWD',
    ]);
    expect(computeFormation(starters)).toBe('4-3-3');
  });

  it('4-4-2: 1 GK + 4 DEF + 4 MID + 2 FWD', () => {
    const starters = makeStarters([
      'GK',
      'DEF',
      'DEF',
      'DEF',
      'DEF',
      'MID',
      'MID',
      'MID',
      'MID',
      'FWD',
      'FWD',
    ]);
    expect(computeFormation(starters)).toBe('4-4-2');
  });

  it('4-5-1: 1 GK + 4 DEF + 5 MID + 1 FWD', () => {
    const starters = makeStarters([
      'GK',
      'DEF',
      'DEF',
      'DEF',
      'DEF',
      'MID',
      'MID',
      'MID',
      'MID',
      'MID',
      'FWD',
    ]);
    expect(computeFormation(starters)).toBe('4-5-1');
  });

  it('3-5-2: 1 GK + 3 DEF + 5 MID + 2 FWD', () => {
    const starters = makeStarters([
      'GK',
      'DEF',
      'DEF',
      'DEF',
      'MID',
      'MID',
      'MID',
      'MID',
      'MID',
      'FWD',
      'FWD',
    ]);
    expect(computeFormation(starters)).toBe('3-5-2');
  });

  it('3-4-3: 1 GK + 3 DEF + 4 MID + 3 FWD', () => {
    const starters = makeStarters([
      'GK',
      'DEF',
      'DEF',
      'DEF',
      'MID',
      'MID',
      'MID',
      'MID',
      'FWD',
      'FWD',
      'FWD',
    ]);
    expect(computeFormation(starters)).toBe('3-4-3');
  });

  it('5-3-2: 1 GK + 5 DEF + 3 MID + 2 FWD', () => {
    const starters = makeStarters([
      'GK',
      'DEF',
      'DEF',
      'DEF',
      'DEF',
      'DEF',
      'MID',
      'MID',
      'MID',
      'FWD',
      'FWD',
    ]);
    expect(computeFormation(starters)).toBe('5-3-2');
  });

  it('5-4-1: 1 GK + 5 DEF + 4 MID + 1 FWD', () => {
    const starters = makeStarters([
      'GK',
      'DEF',
      'DEF',
      'DEF',
      'DEF',
      'DEF',
      'MID',
      'MID',
      'MID',
      'MID',
      'FWD',
    ]);
    expect(computeFormation(starters)).toBe('5-4-1');
  });

  it('ignores bench players beyond position 11', () => {
    // GK is also a DEF in some DB representations — only starters are passed
    const starters = makeStarters([
      'GK',
      'DEF',
      'DEF',
      'DEF',
      'DEF',
      'MID',
      'MID',
      'MID',
      'FWD',
      'FWD',
      'FWD',
    ]);
    expect(computeFormation(starters)).toBe('4-3-3');
  });

  it('returns 0-0-0 for an empty array (pre-season / no data guard)', () => {
    expect(computeFormation([])).toBe('0-0-0');
  });
});
