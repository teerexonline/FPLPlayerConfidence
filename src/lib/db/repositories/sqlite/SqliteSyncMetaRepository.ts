import type Database from 'better-sqlite3';
import type { SyncMetaRepository } from '../SyncMetaRepository';

interface SyncMetaRow {
  key: string;
  value: string;
  updated_at: number;
}

export class SqliteSyncMetaRepository implements SyncMetaRepository {
  private readonly stmtGet: Database.Statement<[string], SyncMetaRow>;
  private readonly stmtSet: Database.Statement<[string, string, number]>;
  private readonly stmtInsertIgnore: Database.Statement<[string, string, number]>;
  private readonly stmtClaimUpdate: Database.Statement<[string, number, string, number]>;

  constructor(db: Database.Database) {
    this.stmtGet = db.prepare<[string], SyncMetaRow>(
      'SELECT key, value, updated_at FROM sync_meta WHERE key = ?',
    );
    this.stmtSet = db.prepare(
      'INSERT OR REPLACE INTO sync_meta (key, value, updated_at) VALUES (?, ?, ?)',
    );
    // INSERT OR IGNORE handles the "no row yet" case atomically.
    this.stmtInsertIgnore = db.prepare(
      'INSERT OR IGNORE INTO sync_meta (key, value, updated_at) VALUES (?, ?, ?)',
    );
    // Conditional UPDATE: succeeds only when phase is idle/failed or startedAt is stale.
    // SQLite is single-threaded in tests so INSERT OR IGNORE + conditional UPDATE is atomic
    // within a single synchronous call stack.
    this.stmtClaimUpdate = db.prepare(
      `UPDATE sync_meta SET value = ?, updated_at = ?
       WHERE key = ?
         AND (
           json_extract(value, '$.phase') IN ('idle', 'failed')
           OR json_extract(value, '$.startedAt') IS NULL
           OR CAST(json_extract(value, '$.startedAt') AS INTEGER) < ?
         )`,
    );
  }

  get(key: string): Promise<string | undefined> {
    return Promise.resolve(this.stmtGet.get(key)?.value);
  }

  set(key: string, value: string, updatedAt: number): Promise<void> {
    this.stmtSet.run(key, value, updatedAt);
    return Promise.resolve();
  }

  tryClaimSync(
    key: string,
    claimedValue: string,
    updatedAt: number,
    staleMs: number,
  ): Promise<boolean> {
    const staleThreshold = updatedAt - staleMs;
    // Try inserting the row if it doesn't exist yet.
    const inserted = this.stmtInsertIgnore.run(key, claimedValue, updatedAt);
    if (inserted.changes > 0) return Promise.resolve(true);
    // Row exists — try the conditional update.
    const updated = this.stmtClaimUpdate.run(claimedValue, updatedAt, key, staleThreshold);
    return Promise.resolve(updated.changes > 0);
  }
}
