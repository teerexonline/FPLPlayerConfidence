import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDb } from '@/lib/db/client';
import type { DbPlayerFdrAverage } from '@/lib/db/types';
import { SqlitePlayerFdrAverageRepository } from './SqlitePlayerFdrAverageRepository';

function aRow(overrides: Partial<DbPlayerFdrAverage> = {}): DbPlayerFdrAverage {
  return {
    player_id: 100,
    bucket: 'LOW',
    avg_points: 4.0,
    sample_count: 10,
    updated_at: 1_700_000_000,
    ...overrides,
  };
}

let dbPath: string;
let db: Database.Database;
let repo: SqlitePlayerFdrAverageRepository;

beforeEach(() => {
  const dir = mkdtempSync(join(tmpdir(), 'fpl-pfa-test-'));
  dbPath = join(dir, 'test.db');
  db = createDb(dbPath);
  repo = new SqlitePlayerFdrAverageRepository(db);
});

afterEach(() => {
  db.close();
  rmSync(dbPath, { force: true });
});

describe('SqlitePlayerFdrAverageRepository', () => {
  it('upsertMany stores all three buckets and listForPlayer returns them', async () => {
    await repo.upsertMany([
      aRow({ player_id: 100, bucket: 'LOW', avg_points: 4.5 }),
      aRow({ player_id: 100, bucket: 'MID', avg_points: 5.5 }),
      aRow({ player_id: 100, bucket: 'HIGH', avg_points: 3.5 }),
    ]);

    const result = await repo.listForPlayer(100);

    expect(result).toHaveLength(3);
    expect(new Set(result.map((r) => r.bucket))).toEqual(new Set(['LOW', 'MID', 'HIGH']));
  });

  it('listForPlayer returns empty array for unknown player', async () => {
    expect(await repo.listForPlayer(9999)).toEqual([]);
  });

  it('upsertMany is idempotent on (player_id, bucket) PK', async () => {
    await repo.upsertMany([aRow({ player_id: 100, bucket: 'LOW', avg_points: 3.0 })]);
    await repo.upsertMany([aRow({ player_id: 100, bucket: 'LOW', avg_points: 5.0 })]);

    const result = await repo.listForPlayer(100);
    expect(result).toHaveLength(1);
    expect(result[0]?.avg_points).toBe(5.0);
  });

  it('rejects unknown bucket values via CHECK constraint', () => {
    expect(() =>
      repo.upsertMany([
        // @ts-expect-error — testing runtime CHECK constraint
        aRow({ bucket: 'EXTREME' }),
      ]),
    ).toThrow();
  });

  it('averagesForPlayers returns a nested map keyed by player_id then bucket', async () => {
    await repo.upsertMany([
      aRow({ player_id: 100, bucket: 'LOW', avg_points: 4.0 }),
      aRow({ player_id: 100, bucket: 'MID', avg_points: 5.0 }),
      aRow({ player_id: 200, bucket: 'HIGH', avg_points: 2.5 }),
    ]);

    const map = await repo.averagesForPlayers([100, 200]);

    expect(map.size).toBe(2);
    expect(map.get(100)?.get('LOW')).toBe(4.0);
    expect(map.get(100)?.get('MID')).toBe(5.0);
    expect(map.get(100)?.get('HIGH')).toBeUndefined();
    expect(map.get(200)?.get('HIGH')).toBe(2.5);
  });

  it('averagesForPlayers omits players with no rows', async () => {
    await repo.upsertMany([aRow({ player_id: 100, bucket: 'LOW' })]);

    const map = await repo.averagesForPlayers([100, 999]);

    expect(map.has(100)).toBe(true);
    expect(map.has(999)).toBe(false);
  });

  it('averagesForPlayers returns empty map for empty input', async () => {
    const map = await repo.averagesForPlayers([]);
    expect(map.size).toBe(0);
  });

  it('deleteAll empties the table', async () => {
    await repo.upsertMany([aRow({ player_id: 100 }), aRow({ player_id: 200 })]);

    await repo.deleteAll();

    expect(await repo.listForPlayer(100)).toEqual([]);
    expect(await repo.listForPlayer(200)).toEqual([]);
  });

  it('preserves sample_count for downstream consumers', async () => {
    await repo.upsertMany([aRow({ player_id: 100, bucket: 'LOW', sample_count: 12 })]);

    const result = await repo.listForPlayer(100);
    expect(result[0]?.sample_count).toBe(12);
  });
});
