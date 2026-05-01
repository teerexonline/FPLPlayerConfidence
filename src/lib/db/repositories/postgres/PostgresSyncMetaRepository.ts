import type postgres from 'postgres';
import type { SyncMetaRepository } from '../SyncMetaRepository';

interface SyncMetaRow {
  key: string;
  value: string;
  updated_at: string;
}

export class PostgresSyncMetaRepository implements SyncMetaRepository {
  constructor(private readonly sql: postgres.Sql) {}

  async get(key: string): Promise<string | undefined> {
    const rows = await this.sql<SyncMetaRow[]>`
      SELECT key, value, updated_at FROM sync_meta WHERE key = ${key}
    `;
    return rows[0]?.value;
  }

  async set(key: string, value: string, updatedAt: number): Promise<void> {
    await this.sql`
      INSERT INTO sync_meta (key, value, updated_at)
      VALUES (${key}, ${value}, ${updatedAt})
      ON CONFLICT (key) DO UPDATE SET
        value = EXCLUDED.value,
        updated_at = EXCLUDED.updated_at
    `;
  }
}
