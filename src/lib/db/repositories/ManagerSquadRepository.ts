import type { DbManagerSquadPick } from '../types';

export interface ManagerSquadRepository {
  /**
   * Inserts or replaces all picks for a manager's squad in a single
   * transaction. The caller is responsible for deleting stale rows if the
   * squad has changed.
   */
  upsertMany(picks: readonly DbManagerSquadPick[]): void;

  /**
   * Returns all picks for a given manager team and gameweek, ordered by
   * `squad_position` ascending (starters first).
   */
  listByTeamAndGameweek(teamId: number, gameweek: number): readonly DbManagerSquadPick[];

  /**
   * Returns the highest gameweek number for which picks have been stored for
   * this team, or `null` if no squad has been synced yet. Used by the My Team
   * page to resolve which GW to load without a cross-repository call.
   */
  latestGameweekForTeam(teamId: number): number | null;

  /**
   * Returns all gameweek numbers for which picks have been cached for this team,
   * sorted ascending. Used by the GW scrubber timeline to distinguish clickable
   * (available) pills from greyed-out (no data) ones.
   */
  listGameweeksForTeam(teamId: number): readonly number[];
}
