import type { DbManagerSquadPick } from '../types';

export interface ManagerSquadRepository {
  /**
   * Inserts or replaces all picks for a manager's squad in a single
   * transaction. Each pick must carry the owning `user_id`. The caller is
   * responsible for deleting stale rows if the squad has changed.
   */
  upsertMany(picks: readonly DbManagerSquadPick[]): Promise<void>;

  /**
   * Returns all picks for a given user, manager team, and gameweek, ordered by
   * `squad_position` ascending (starters first).
   */
  listByTeamAndGameweek(
    userId: number,
    teamId: number,
    gameweek: number,
  ): Promise<readonly DbManagerSquadPick[]>;

  /**
   * Returns the highest gameweek number for which picks have been stored for
   * this user+team combination, or `null` if no squad has been synced yet.
   */
  latestGameweekForTeam(userId: number, teamId: number): Promise<number | null>;

  /**
   * Returns all gameweek numbers for which picks have been cached for this
   * user+team combination, sorted ascending. Used by the GW scrubber timeline.
   */
  listGameweeksForTeam(userId: number, teamId: number): Promise<readonly number[]>;
}
