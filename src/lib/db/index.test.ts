import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDb, createRepositories } from '@/lib/db';

let dbPath: string;
let db: Database.Database;

beforeEach(() => {
  const dir = mkdtempSync(join(tmpdir(), 'fpl-test-'));
  dbPath = join(dir, 'test.db');
  db = createDb(dbPath);
});

afterEach(() => {
  db.close();
  rmSync(dbPath, { force: true });
});

describe('createRepositories', () => {
  it('returns all five repositories backed by the provided database', () => {
    const repos = createRepositories(db);

    expect(repos.players).toBeDefined();
    expect(repos.teams).toBeDefined();
    expect(repos.confidenceSnapshots).toBeDefined();
    expect(repos.syncMeta).toBeDefined();
    expect(repos.managerSquads).toBeDefined();
  });

  it('repositories are functional — basic round-trip through the factory', () => {
    const repos = createRepositories(db);

    repos.syncMeta.set('test_key', 'hello', 1_000);
    expect(repos.syncMeta.get('test_key')).toBe('hello');
  });
});
