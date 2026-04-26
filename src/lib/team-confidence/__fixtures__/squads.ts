import type { Position } from '@/lib/confidence/types';
import type { SquadPick, TeamCalculatorInput } from '../types';

export const aSquadPick = (overrides: Partial<SquadPick> = {}): SquadPick => ({
  playerId: 1,
  squadPosition: 1,
  isCaptain: false,
  isViceCaptain: false,
  ...overrides,
});

interface StarterSpec {
  readonly confidence: number;
  readonly position: Position;
}

interface SquadSpec {
  readonly starters?: readonly StarterSpec[];
  readonly bench?: readonly StarterSpec[];
}

/**
 * Build a valid 15-pick squad (11 starters + 4 bench).
 * Defaults to a neutral 1-GK/4-DEF/4-MID/2-FWD 4-4-2 with all confidence = 0.
 * Pass overrides for starters and/or bench to test specific scenarios.
 */
export const aSquad = (overrides: SquadSpec = {}): TeamCalculatorInput => {
  const defaultStarters: readonly StarterSpec[] = [
    { confidence: 0, position: 'GK' },
    { confidence: 0, position: 'DEF' },
    { confidence: 0, position: 'DEF' },
    { confidence: 0, position: 'DEF' },
    { confidence: 0, position: 'DEF' },
    { confidence: 0, position: 'MID' },
    { confidence: 0, position: 'MID' },
    { confidence: 0, position: 'MID' },
    { confidence: 0, position: 'MID' },
    { confidence: 0, position: 'FWD' },
    { confidence: 0, position: 'FWD' },
  ];

  const defaultBench: readonly StarterSpec[] = [
    { confidence: 0, position: 'GK' },
    { confidence: 0, position: 'DEF' },
    { confidence: 0, position: 'MID' },
    { confidence: 0, position: 'FWD' },
  ];

  const starters = overrides.starters ?? defaultStarters;
  const bench = overrides.bench ?? defaultBench;

  const picks: SquadPick[] = [];
  const playerData = new Map<
    number,
    { readonly confidence: number; readonly position: Position }
  >();

  let nextId = 1;
  for (const [i, spec] of starters.entries()) {
    picks.push(
      aSquadPick({
        playerId: nextId,
        squadPosition: i + 1,
        isCaptain: i === 0,
        isViceCaptain: i === 1,
      }),
    );
    playerData.set(nextId, { confidence: spec.confidence, position: spec.position });
    nextId++;
  }
  for (const [i, spec] of bench.entries()) {
    picks.push(
      aSquadPick({
        playerId: nextId,
        squadPosition: 12 + i,
        isCaptain: false,
        isViceCaptain: false,
      }),
    );
    playerData.set(nextId, { confidence: spec.confidence, position: spec.position });
    nextId++;
  }

  return { picks, playerData };
};
