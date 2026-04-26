import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDb } from '@/lib/db/client';
import type { DbManagerSquadPick } from '@/lib/db/types';
import { SqliteManagerSquadRepository } from './SqliteManagerSquadRepository';

function aPick(overrides: Partial<DbManagerSquadPick> = {}): DbManagerSquadPick {
  return {
    team_id: 1,
    gameweek: 1,
    player_id: 100,
    squad_position: 1,
    is_captain: false,
    is_vice_captain: false,
    fetched_at: 1_700_000_000,
    ...overrides,
  };
}

const SQUAD = Array.from({ length: 15 }, (_, i) =>
  aPick({ squad_position: i + 1, player_id: (i + 1) * 10 }),
);

let dbPath: string;
let db: Database.Database;
let repo: SqliteManagerSquadRepository;

beforeEach(() => {
  const dir = mkdtempSync(join(tmpdir(), 'fpl-test-'));
  dbPath = join(dir, 'test.db');
  db = createDb(dbPath);
  repo = new SqliteManagerSquadRepository(db);
});

afterEach(() => {
  db.close();
  rmSync(dbPath, { force: true });
});

describe('SqliteManagerSquadRepository', () => {
  it('upsertMany stores all 15 picks and listByTeamAndGameweek returns them ordered by squad_position', () => {
    repo.upsertMany(SQUAD);

    const result = repo.listByTeamAndGameweek(1, 1);

    expect(result).toHaveLength(15);
    expect(result.map((p) => p.squad_position)).toEqual(
      Array.from({ length: 15 }, (_, i) => i + 1),
    );
  });

  it('persists boolean flags correctly (is_captain, is_vice_captain round-trip)', () => {
    repo.upsertMany([
      aPick({ squad_position: 1, player_id: 10, is_captain: true, is_vice_captain: false }),
      aPick({ squad_position: 2, player_id: 20, is_captain: false, is_vice_captain: true }),
    ]);

    const result = repo.listByTeamAndGameweek(1, 1);

    expect(result[0]).toMatchObject({ player_id: 10, is_captain: true, is_vice_captain: false });
    expect(result[1]).toMatchObject({ player_id: 20, is_captain: false, is_vice_captain: true });
  });

  it('listByTeamAndGameweek returns an empty array for an unknown team', () => {
    expect(repo.listByTeamAndGameweek(9999, 1)).toHaveLength(0);
  });

  it('listByTeamAndGameweek isolates squads by team_id', () => {
    repo.upsertMany([aPick({ team_id: 1, squad_position: 1 })]);
    repo.upsertMany([aPick({ team_id: 2, squad_position: 1, player_id: 999 })]);

    expect(repo.listByTeamAndGameweek(1, 1)).toHaveLength(1);
    expect(repo.listByTeamAndGameweek(2, 1)[0]?.player_id).toBe(999);
  });

  it('latestGameweekForTeam returns the highest stored gameweek for a team', () => {
    repo.upsertMany([aPick({ team_id: 1, gameweek: 1 })]);
    repo.upsertMany([aPick({ team_id: 1, gameweek: 5, squad_position: 1, player_id: 999 })]);
    repo.upsertMany([aPick({ team_id: 1, gameweek: 3, squad_position: 2, player_id: 888 })]);

    expect(repo.latestGameweekForTeam(1)).toBe(5);
  });

  it('latestGameweekForTeam returns null when no squad has been synced for the team', () => {
    expect(repo.latestGameweekForTeam(9999)).toBeNull();
  });
});
