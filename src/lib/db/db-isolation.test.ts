import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type Database from 'better-sqlite3';
import { createDb, createRepositories } from '@/lib/db';

let prodDir: string;
let testDir: string;
let prodDb: Database.Database;
let testDb: Database.Database;

beforeEach(() => {
  prodDir = mkdtempSync(join(tmpdir(), 'fpl-prod-'));
  testDir = mkdtempSync(join(tmpdir(), 'fpl-test-'));
  prodDb = createDb(join(prodDir, 'fpl.db'));
  testDb = createDb(join(testDir, 'fpl.test.db'));
});

afterEach(() => {
  prodDb.close();
  testDb.close();
  rmSync(prodDir, { recursive: true, force: true });
  rmSync(testDir, { recursive: true, force: true });
});

describe('DB isolation: prod and test databases are separate files', () => {
  it('data written to one database is never visible in the other', async () => {
    const prodRepos = createRepositories(prodDb);
    const testRepos = createRepositories(testDb);

    // Write Liverpool (id=11) to prod as in 2024/25 seeded data
    await prodRepos.teams.upsert({ id: 11, code: 14, name: 'Liverpool', short_name: 'LIV' });
    // Write Leeds (id=11) to test as in 2025/26 live API
    await testRepos.teams.upsert({ id: 11, code: 75, name: 'Leeds', short_name: 'LEE' });

    const prodTeam = await prodRepos.teams.findById(11);
    const testTeam = await testRepos.teams.findById(11);

    // Each database sees only its own write — the root cause of the Salah-at-Leeds bug
    expect(prodTeam?.short_name).toBe('LIV');
    expect(testTeam?.short_name).toBe('LEE');
  });

  it('a player row in the prod DB is invisible to the test DB', () => {
    const prodRepos = createRepositories(prodDb);

    // Seed a fake "Salah" (id=9999) into prod only
    void prodRepos.teams.upsert({ id: 11, code: 14, name: 'Liverpool', short_name: 'LIV' });
    prodDb
      .prepare(
        'INSERT INTO players (id, web_name, team_id, position, now_cost, total_points, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .run(9999, 'M. Salah', 11, 'MID', 130, 200, Date.now());

    // Test DB has no players at all
    const testRows = testDb.prepare('SELECT COUNT(*) as n FROM players').get() as { n: number };
    expect(testRows.n).toBe(0);

    // Prod DB has exactly one player
    const prodRows = prodDb.prepare('SELECT COUNT(*) as n FROM players').get() as { n: number };
    expect(prodRows.n).toBe(1);
  });
});
