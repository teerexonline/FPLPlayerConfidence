import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDb } from '@/lib/db/client';
import type { DbFixture } from '@/lib/db/types';
import { SqliteFixtureRepository } from './SqliteFixtureRepository';

function aFixture(overrides: Partial<DbFixture> = {}): DbFixture {
  return {
    fixture_id: 1,
    gameweek: 36,
    team_id: 1,
    opponent_team_id: 7,
    is_home: true,
    fdr: 3,
    finished: false,
    kickoff_time: '2026-05-10T14:00:00Z',
    ...overrides,
  };
}

let dbPath: string;
let db: Database.Database;
let repo: SqliteFixtureRepository;

beforeEach(() => {
  const dir = mkdtempSync(join(tmpdir(), 'fpl-fixtures-test-'));
  dbPath = join(dir, 'test.db');
  db = createDb(dbPath);
  repo = new SqliteFixtureRepository(db);
});

afterEach(() => {
  db.close();
  rmSync(dbPath, { force: true });
});

describe('SqliteFixtureRepository', () => {
  it('upsertMany stores rows and listForTeamInRange returns them in chronological order', async () => {
    await repo.upsertMany([
      aFixture({
        fixture_id: 1,
        gameweek: 36,
        team_id: 1,
        kickoff_time: '2026-05-10T14:00:00Z',
      }),
      aFixture({
        fixture_id: 2,
        gameweek: 35,
        team_id: 1,
        kickoff_time: '2026-05-03T14:00:00Z',
      }),
      aFixture({
        fixture_id: 3,
        gameweek: 37,
        team_id: 1,
        kickoff_time: '2026-05-17T14:00:00Z',
      }),
    ]);

    const result = await repo.listForTeamInRange(1, 35, 37);

    expect(result.map((f) => f.gameweek)).toEqual([35, 36, 37]);
  });

  it('listForTeamInRange filters by team_id', async () => {
    await repo.upsertMany([
      aFixture({ fixture_id: 1, team_id: 1 }),
      aFixture({ fixture_id: 1, team_id: 7 }), // mirror row for the same fixture
      aFixture({ fixture_id: 2, team_id: 1, gameweek: 37 }),
    ]);

    const result = await repo.listForTeamInRange(1, 1, 38);

    expect(result).toHaveLength(2);
    expect(result.every((f) => f.team_id === 1)).toBe(true);
  });

  it('listForTeamInRange respects the inclusive gameweek range', async () => {
    await repo.upsertMany([
      aFixture({ fixture_id: 1, gameweek: 35 }),
      aFixture({ fixture_id: 2, gameweek: 36 }),
      aFixture({ fixture_id: 3, gameweek: 37 }),
      aFixture({ fixture_id: 4, gameweek: 38 }),
    ]);

    expect((await repo.listForTeamInRange(1, 36, 37)).map((f) => f.gameweek)).toEqual([36, 37]);
  });

  it('round-trips boolean flags (is_home, finished) and null kickoff_time', async () => {
    await repo.upsertMany([
      aFixture({
        fixture_id: 1,
        is_home: false,
        finished: true,
        kickoff_time: null,
      }),
    ]);

    const [f] = await repo.listForTeamInRange(1, 1, 38);

    expect(f).toMatchObject({
      is_home: false,
      finished: true,
      kickoff_time: null,
    });
  });

  it('listForGameweek returns all teams playing that GW', async () => {
    await repo.upsertMany([
      aFixture({ fixture_id: 1, team_id: 1, gameweek: 36 }),
      aFixture({ fixture_id: 1, team_id: 7, gameweek: 36 }),
      aFixture({ fixture_id: 2, team_id: 3, gameweek: 36 }),
      aFixture({ fixture_id: 3, team_id: 1, gameweek: 37 }),
    ]);

    const result = await repo.listForGameweek(36);

    expect(result).toHaveLength(3);
    expect(result.every((f) => f.gameweek === 36)).toBe(true);
  });

  it('upsertMany is idempotent (same PK overwrites in place)', async () => {
    await repo.upsertMany([aFixture({ fixture_id: 1, team_id: 1, fdr: 3 })]);
    await repo.upsertMany([aFixture({ fixture_id: 1, team_id: 1, fdr: 5 })]);

    const [f] = await repo.listForTeamInRange(1, 1, 38);
    expect(f?.fdr).toBe(5);
  });

  it('deleteAll empties the table', async () => {
    await repo.upsertMany([
      aFixture({ fixture_id: 1, team_id: 1 }),
      aFixture({ fixture_id: 2, team_id: 1 }),
    ]);

    await repo.deleteAll();

    expect(await repo.listForTeamInRange(1, 1, 38)).toHaveLength(0);
  });

  it('listInGameweekRange returns all rows in the window across teams, ordered by GW then kickoff', async () => {
    await repo.upsertMany([
      aFixture({
        fixture_id: 1,
        gameweek: 36,
        team_id: 1,
        kickoff_time: '2026-05-10T17:30:00Z',
      }),
      aFixture({
        fixture_id: 2,
        gameweek: 36,
        team_id: 2,
        kickoff_time: '2026-05-10T14:00:00Z',
      }),
      aFixture({ fixture_id: 3, gameweek: 37, team_id: 1, kickoff_time: null }),
      aFixture({ fixture_id: 4, gameweek: 38, team_id: 1, kickoff_time: '2026-05-24T14:00:00Z' }),
    ]);

    const result = await repo.listInGameweekRange(36, 37);

    expect(result.map((f) => f.fixture_id)).toEqual([2, 1, 3]);
  });

  it('latestGameweek returns the highest stored gameweek', async () => {
    await repo.upsertMany([
      aFixture({ fixture_id: 1, gameweek: 1 }),
      aFixture({ fixture_id: 2, gameweek: 38 }),
      aFixture({ fixture_id: 3, gameweek: 17 }),
    ]);
    expect(await repo.latestGameweek()).toBe(38);
  });

  it('latestGameweek returns null when the table is empty', async () => {
    expect(await repo.latestGameweek()).toBeNull();
  });

  it('handles a double gameweek (two rows for the same team in one GW)', async () => {
    await repo.upsertMany([
      aFixture({
        fixture_id: 100,
        gameweek: 36,
        team_id: 1,
        kickoff_time: '2026-05-10T14:00:00Z',
      }),
      aFixture({
        fixture_id: 101,
        gameweek: 36,
        team_id: 1,
        opponent_team_id: 12,
        kickoff_time: '2026-05-13T19:30:00Z',
      }),
    ]);

    const result = await repo.listForTeamInRange(1, 36, 36);

    expect(result).toHaveLength(2);
    expect(result.map((f) => f.fixture_id)).toEqual([100, 101]);
  });
});
