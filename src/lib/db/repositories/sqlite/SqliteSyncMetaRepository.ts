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

  constructor(db: Database.Database) {
    this.stmtGet = db.prepare<[string], SyncMetaRow>(
      'SELECT key, value, updated_at FROM sync_meta WHERE key = ?',
    );
    this.stmtSet = db.prepare(
      'INSERT OR REPLACE INTO sync_meta (key, value, updated_at) VALUES (?, ?, ?)',
    );
  }

  get(key: string): Promise<string | undefined> {
    return Promise.resolve(this.stmtGet.get(key)?.value);
  }

  set(key: string, value: string, updatedAt: number): Promise<void> {
    this.stmtSet.run(key, value, updatedAt);
    return Promise.resolve();
  }
}
