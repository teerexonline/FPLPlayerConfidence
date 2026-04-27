import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDb, createRepositories } from '@/lib/db';
import { SYSTEM_USER_ID } from '@/lib/db/constants';

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
  it('returns all six repositories backed by the provided database', () => {
    const repos = createRepositories(db);

    expect(repos.players).toBeDefined();
    expect(repos.teams).toBeDefined();
    expect(repos.confidenceSnapshots).toBeDefined();
    expect(repos.syncMeta).toBeDefined();
    expect(repos.managerSquads).toBeDefined();
    expect(repos.users).toBeDefined();
  });

  it('repositories are functional — basic round-trip through the factory', () => {
    const repos = createRepositories(db);

    repos.syncMeta.set('test_key', 'hello', 1_000);
    expect(repos.syncMeta.get('test_key')).toBe('hello');
  });
});

describe('createDb migrations', () => {
  it('seeds SYSTEM_USER (id=1) in the users table on a fresh database', () => {
    const repos = createRepositories(db);
    const user = repos.users.findById(SYSTEM_USER_ID);

    expect(user).not.toBeNull();
    expect(user?.id).toBe(SYSTEM_USER_ID);
    expect(user?.email).toBe('system@fpltool.internal');
  });

  it('seeds SYSTEM_USER idempotently — calling createDb twice does not duplicate the row', () => {
    // Close the first connection and re-open the same file to simulate a restart.
    const savedPath = dbPath;
    db.close();
    const db2 = createDb(savedPath);
    const repos2 = createRepositories(db2);

    const users = repos2.users.listAll();
    db2.close();

    expect(users).toHaveLength(1);
    expect(users[0]?.id).toBe(SYSTEM_USER_ID);
  });

  it('adds user_id column to manager_squads with DEFAULT 1', () => {
    // Insert a row without specifying user_id — should default to SYSTEM_USER_ID.
    db.prepare(
      `INSERT INTO manager_squads
       (team_id, gameweek, player_id, squad_position, is_captain, is_vice_captain, fetched_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(1, 1, 100, 1, 0, 0, 1_700_000_000);

    const row = db.prepare('SELECT user_id FROM manager_squads WHERE team_id = 1').get() as {
      user_id: number;
    };
    expect(row.user_id).toBe(SYSTEM_USER_ID);
  });
});
