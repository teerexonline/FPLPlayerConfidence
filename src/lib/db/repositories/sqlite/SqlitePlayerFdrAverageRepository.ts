import type Database from 'better-sqlite3';
import type { DbPlayerFdrAverage, FdrBucketName } from '../../types';
import type { PlayerFdrAverageRepository } from '../PlayerFdrAverageRepository';

interface AverageRow {
  player_id: number;
  bucket: FdrBucketName;
  avg_points: number;
  sample_count: number;
  updated_at: number;
}

const SELECT_COLS = 'player_id, bucket, avg_points, sample_count, updated_at';

function rowToAverage(row: AverageRow): DbPlayerFdrAverage {
  return {
    player_id: row.player_id,
    bucket: row.bucket,
    avg_points: row.avg_points,
    sample_count: row.sample_count,
    updated_at: row.updated_at,
  };
}

export class SqlitePlayerFdrAverageRepository implements PlayerFdrAverageRepository {
  private readonly stmtUpsert: Database.Statement<[number, FdrBucketName, number, number, number]>;
  private readonly stmtListForPlayer: Database.Statement<[number], AverageRow>;
  private readonly stmtDeleteAll: Database.Statement<[]>;

  constructor(private readonly db: Database.Database) {
    this.stmtUpsert = db.prepare(
      `INSERT OR REPLACE INTO player_fdr_averages
       (player_id, bucket, avg_points, sample_count, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
    );
    this.stmtListForPlayer = db.prepare<[number], AverageRow>(
      `SELECT ${SELECT_COLS} FROM player_fdr_averages WHERE player_id = ?`,
    );
    this.stmtDeleteAll = db.prepare('DELETE FROM player_fdr_averages');
  }

  upsertMany(rows: readonly DbPlayerFdrAverage[]): Promise<void> {
    const tx = this.db.transaction(() => {
      for (const r of rows) {
        this.stmtUpsert.run(r.player_id, r.bucket, r.avg_points, r.sample_count, r.updated_at);
      }
    });
    tx();
    return Promise.resolve();
  }

  listForPlayer(playerId: number): Promise<readonly DbPlayerFdrAverage[]> {
    return Promise.resolve(this.stmtListForPlayer.all(playerId).map(rowToAverage));
  }

  averagesForPlayers(
    playerIds: readonly number[],
  ): Promise<ReadonlyMap<number, ReadonlyMap<FdrBucketName, number>>> {
    const result = new Map<number, Map<FdrBucketName, number>>();
    if (playerIds.length === 0) return Promise.resolve(result);

    // Build a parameterised IN(?,?,…) clause. better-sqlite3 doesn't expand arrays.
    const placeholders = playerIds.map(() => '?').join(',');
    const sql = `SELECT ${SELECT_COLS} FROM player_fdr_averages WHERE player_id IN (${placeholders})`;
    const rows = this.db.prepare<number[], AverageRow>(sql).all(...playerIds);

    for (const row of rows) {
      let perBucket = result.get(row.player_id);
      if (perBucket === undefined) {
        perBucket = new Map();
        result.set(row.player_id, perBucket);
      }
      perBucket.set(row.bucket, row.avg_points);
    }

    return Promise.resolve(result);
  }

  deleteAll(): Promise<void> {
    this.stmtDeleteAll.run();
    return Promise.resolve();
  }
}
