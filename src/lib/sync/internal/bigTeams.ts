import type { TeamId } from '@/lib/db/types';
import { teamId } from '@/lib/db/types';
import type { Team } from '@/lib/fpl/types';
import type { Logger } from '@/lib/logger';

/**
 * Resolves a list of team name strings to a set of TeamIds using the teams
 * returned by bootstrap-static. Matching is case-insensitive.
 *
 * Names that do not match any team log a warning and are silently dropped —
 * an unrecognised name never fails the sync.
 */
export function resolveBigTeamIds(
  teamNames: readonly string[],
  teams: readonly Team[],
  logger: Logger,
): ReadonlySet<TeamId> {
  const byName = new Map(teams.map((t) => [t.name.toLowerCase(), t]));
  const result = new Set<TeamId>();

  for (const name of teamNames) {
    const match = byName.get(name.toLowerCase());
    if (match === undefined) {
      logger.warn('Big team name not found — dropping from set', { name });
    } else {
      result.add(teamId(match.id));
    }
  }

  return result;
}
