import type { DbTeam } from '../types';

export interface TeamRepository {
  /** Inserts or replaces a single team row. */
  upsert(team: DbTeam): void;

  /** Inserts or replaces multiple team rows in a single transaction. */
  upsertMany(teams: readonly DbTeam[]): void;

  /** Returns a team by primary key, or `undefined` if not found. */
  findById(id: number): DbTeam | undefined;

  /** Returns all teams in insertion order. */
  listAll(): readonly DbTeam[];
}
