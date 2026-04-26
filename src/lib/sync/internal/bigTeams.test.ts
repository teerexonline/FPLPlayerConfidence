import { describe, expect, it, vi } from 'vitest';
import type { Team } from '@/lib/fpl/types';
import type { Logger } from '@/lib/logger';
import { teamId } from '@/lib/db/types';
import { resolveBigTeamIds } from './bigTeams';

function makeLogger(): Logger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

const TEAMS: readonly Team[] = [
  { id: 1, code: 3, name: 'Arsenal', short_name: 'ARS' },
  { id: 2, code: 7, name: 'Chelsea', short_name: 'CHE' },
  { id: 3, code: 8, name: 'Manchester City', short_name: 'MCI' },
];

describe('resolveBigTeamIds', () => {
  it('resolves matching team names to their IDs', () => {
    const result = resolveBigTeamIds(['Arsenal', 'Chelsea'], TEAMS, makeLogger());

    expect(result.has(teamId(1))).toBe(true);
    expect(result.has(teamId(2))).toBe(true);
    expect(result.size).toBe(2);
  });

  it('matching is case-insensitive', () => {
    const result = resolveBigTeamIds(['ARSENAL', 'chelsea'], TEAMS, makeLogger());

    expect(result.has(teamId(1))).toBe(true);
    expect(result.has(teamId(2))).toBe(true);
  });

  it('unrecognised name logs a warning and is excluded from the result', () => {
    const warnSpy = vi.fn();
    const logger: Logger = { debug: vi.fn(), info: vi.fn(), warn: warnSpy, error: vi.fn() };

    const result = resolveBigTeamIds(['Arsenal', 'NotATeam'], TEAMS, logger);

    expect(result.size).toBe(1);
    expect(warnSpy).toHaveBeenCalledOnce();
  });

  it('returns an empty Set when no names match any team', () => {
    const result = resolveBigTeamIds(['Tottenham', 'Everton'], TEAMS, makeLogger());

    expect(result.size).toBe(0);
  });

  it('returns an empty Set when bigTeamNames is empty', () => {
    const result = resolveBigTeamIds([], TEAMS, makeLogger());

    expect(result.size).toBe(0);
  });

  it('matches against team.name only — short_name does not resolve a team', () => {
    // 'ARS' is Arsenal's short_name; it should NOT match the 'Arsenal' name
    const byShortName = resolveBigTeamIds(['ARS'], TEAMS, makeLogger());
    expect(byShortName.size).toBe(0);

    // 'Arsenal' is the name and should resolve correctly
    const byName = resolveBigTeamIds(['Arsenal'], TEAMS, makeLogger());
    expect(byName.has(teamId(1))).toBe(true);
  });
});
