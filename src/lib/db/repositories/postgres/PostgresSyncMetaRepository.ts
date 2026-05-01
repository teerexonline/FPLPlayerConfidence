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

  async tryClaimSync(
    key: string,
    claimedValue: string,
    updatedAt: number,
    staleMs: number,
  ): Promise<boolean> {
    const staleThreshold = updatedAt - staleMs;
    // Single atomic statement: insert if key is absent, or update if the
    // stored phase is idle/failed, or if startedAt is older than staleThreshold.
    // The DO UPDATE WHERE filter ensures 0 rows are affected when a live sync
    // is in flight, which the caller interprets as "lock not acquired".
    const result = await this.sql`
      INSERT INTO sync_meta (key, value, updated_at)
      VALUES (${key}, ${claimedValue}, ${updatedAt})
      ON CONFLICT (key) DO UPDATE SET
        value    = EXCLUDED.value,
        updated_at = EXCLUDED.updated_at
      WHERE (sync_meta.value::json->>'phase') IN ('idle', 'failed')
         OR  sync_meta.value::json->>'startedAt' IS NULL
         OR (sync_meta.value::json->>'startedAt')::bigint < ${staleThreshold}
    `;
    return result.count === 1;
  }
}
