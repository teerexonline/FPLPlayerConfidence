import type { DbPlayerFdrAverage, FdrBucketName } from '../types';

export interface PlayerFdrAverageRepository {
  /**
   * Inserts or replaces all per-player per-bucket averages in a single
   * transaction. Idempotent — safe to call on every sync.
   */
  upsertMany(rows: readonly DbPlayerFdrAverage[]): Promise<void>;

  /**
   * Returns all stored averages for a single player. The returned array has
   * 0–3 entries depending on which buckets the player has appearances in.
   */
  listForPlayer(playerId: number): Promise<readonly DbPlayerFdrAverage[]>;

  /**
   * Bulk read: returns a map keyed by player_id, where each value is the
   * subset of (bucket → avg_points) pairs that exist for that player.
   * Players with no rows at all are omitted. Used by the My Team API to
   * compute xP for every starter without N+1 reads.
   */
  averagesForPlayers(
    playerIds: readonly number[],
  ): Promise<ReadonlyMap<number, ReadonlyMap<FdrBucketName, number>>>;

  /**
   * Deletes every row in the table. Used by the sync pipeline before
   * upserting freshly recomputed averages.
   */
  deleteAll(): Promise<void>;
}
