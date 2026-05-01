import type { DbPlayer } from '../types';

export interface PlayerRepository {
  /** Inserts or replaces a single player row. */
  upsert(player: DbPlayer): Promise<void>;

  /** Inserts or replaces multiple player rows in a single transaction. */
  upsertMany(players: readonly DbPlayer[]): Promise<void>;

  /** Returns a player by primary key, or `undefined` if not found. */
  findById(id: number): Promise<DbPlayer | undefined>;

  /** Returns all players in insertion order. */
  listAll(): Promise<readonly DbPlayer[]>;
}
