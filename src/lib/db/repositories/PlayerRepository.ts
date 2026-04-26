import type { DbPlayer } from '../types';

export interface PlayerRepository {
  /** Inserts or replaces a single player row. */
  upsert(player: DbPlayer): void;

  /** Inserts or replaces multiple player rows in a single transaction. */
  upsertMany(players: readonly DbPlayer[]): void;

  /** Returns a player by primary key, or `undefined` if not found. */
  findById(id: number): DbPlayer | undefined;

  /** Returns all players in insertion order. */
  listAll(): readonly DbPlayer[];
}
