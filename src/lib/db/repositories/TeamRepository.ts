import type { DbTeam } from '../types';

export interface TeamRepository {
  /** Inserts or replaces a single team row. */
  upsert(team: DbTeam): Promise<void>;

  /** Inserts or replaces multiple team rows in a single transaction. */
  upsertMany(teams: readonly DbTeam[]): Promise<void>;

  /** Returns a team by primary key, or `undefined` if not found. */
  findById(id: number): Promise<DbTeam | undefined>;

  /** Returns all teams in insertion order. */
  listAll(): Promise<readonly DbTeam[]>;
}
