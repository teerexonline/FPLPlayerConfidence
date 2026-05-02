import type { DbManagerSquadPick } from '../types';

export interface ManagerSquadRepository {
  /**
   * Inserts or replaces all picks for a manager's squad in a single
   * transaction. The `user_id` DB column is populated via DEFAULT (1) —
   * it is vestigial and not represented in the pick type.
   */
  upsertMany(picks: readonly DbManagerSquadPick[]): Promise<void>;

  /**
   * Returns all picks for a given manager team and gameweek, ordered by
   * `squad_position` ascending (starters first).
   */
  listByTeamAndGameweek(teamId: number, gameweek: number): Promise<readonly DbManagerSquadPick[]>;

  /**
   * Returns the highest gameweek number for which picks have been stored for
   * this team, or `null` if no squad has been synced yet.
   */
  latestGameweekForTeam(teamId: number): Promise<number | null>;

  /**
   * Returns all gameweek numbers for which picks have been cached for this
   * team, sorted ascending. Used by the GW scrubber timeline.
   */
  listGameweeksForTeam(teamId: number): Promise<readonly number[]>;
}
