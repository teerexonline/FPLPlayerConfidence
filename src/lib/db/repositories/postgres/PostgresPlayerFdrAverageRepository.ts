import type postgres from 'postgres';
import type { DbPlayerFdrAverage, FdrBucketName } from '../../types';
import type { PlayerFdrAverageRepository } from '../PlayerFdrAverageRepository';

interface AverageRow {
  player_id: number;
  bucket: FdrBucketName;
  avg_points: number;
  sample_count: number;
  updated_at: string; // BIGINT round-trips as string
}

const SELECT_COLS = ['player_id', 'bucket', 'avg_points', 'sample_count', 'updated_at'] as const;

function rowToAverage(row: AverageRow): DbPlayerFdrAverage {
  return {
    player_id: row.player_id,
    bucket: row.bucket,
    avg_points: row.avg_points,
    sample_count: row.sample_count,
    updated_at: Number(row.updated_at),
  };
}

export class PostgresPlayerFdrAverageRepository implements PlayerFdrAverageRepository {
  constructor(private readonly sql: postgres.Sql) {}

  async upsertMany(rows: readonly DbPlayerFdrAverage[]): Promise<void> {
    if (rows.length === 0) return;
    const values = rows.map((r) => ({
      player_id: r.player_id,
      bucket: r.bucket,
      avg_points: r.avg_points,
      sample_count: r.sample_count,
      updated_at: r.updated_at,
    }));
    await this.sql`
      INSERT INTO player_fdr_averages ${this.sql(values)}
      ON CONFLICT (player_id, bucket) DO UPDATE SET
        avg_points    = EXCLUDED.avg_points,
        sample_count  = EXCLUDED.sample_count,
        updated_at    = EXCLUDED.updated_at
    `;
  }

  async listForPlayer(playerId: number): Promise<readonly DbPlayerFdrAverage[]> {
    const rows = await this.sql<AverageRow[]>`
      SELECT ${this.sql(SELECT_COLS)} FROM player_fdr_averages
      WHERE player_id = ${playerId}
    `;
    return rows.map(rowToAverage);
  }

  async averagesForPlayers(
    playerIds: readonly number[],
  ): Promise<ReadonlyMap<number, ReadonlyMap<FdrBucketName, number>>> {
    const result = new Map<number, Map<FdrBucketName, number>>();
    if (playerIds.length === 0) return result;

    const rows = await this.sql<AverageRow[]>`
      SELECT player_id, bucket, avg_points FROM player_fdr_averages
      WHERE player_id IN ${this.sql(playerIds)}
    `;

    for (const row of rows) {
      let perBucket = result.get(row.player_id);
      if (perBucket === undefined) {
        perBucket = new Map();
        result.set(row.player_id, perBucket);
      }
      perBucket.set(row.bucket, row.avg_points);
    }

    return result;
  }

  async deleteAll(): Promise<void> {
    await this.sql`DELETE FROM player_fdr_averages`;
  }
}
