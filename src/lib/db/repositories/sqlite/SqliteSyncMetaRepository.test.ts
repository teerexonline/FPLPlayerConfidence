import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDb } from '@/lib/db/client';
import { SqliteSyncMetaRepository } from './SqliteSyncMetaRepository';

let dbPath: string;
let db: Database.Database;
let repo: SqliteSyncMetaRepository;

beforeEach(() => {
  const dir = mkdtempSync(join(tmpdir(), 'fpl-test-'));
  dbPath = join(dir, 'test.db');
  db = createDb(dbPath);
  repo = new SqliteSyncMetaRepository(db);
});

afterEach(() => {
  db.close();
  rmSync(dbPath, { force: true });
});

describe('SqliteSyncMetaRepository', () => {
  it('set stores a value and get retrieves it', async () => {
    await repo.set('bootstrap_etag', 'abc123', 1_700_000_000);

    expect(await repo.get('bootstrap_etag')).toBe('abc123');
  });

  it('get returns undefined for a key that has never been set', async () => {
    expect(await repo.get('nonexistent_key')).toBeUndefined();
  });

  it('set on an existing key replaces the value', async () => {
    await repo.set('last_sync', '2025-08-01', 1_700_000_000);
    await repo.set('last_sync', '2025-08-08', 1_700_100_000);

    expect(await repo.get('last_sync')).toBe('2025-08-08');
  });

  it('stores multiple independent keys without conflict', async () => {
    await repo.set('key_a', 'value_a', 1_000);
    await repo.set('key_b', 'value_b', 2_000);

    expect(await repo.get('key_a')).toBe('value_a');
    expect(await repo.get('key_b')).toBe('value_b');
  });
});
