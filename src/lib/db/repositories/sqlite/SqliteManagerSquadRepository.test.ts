import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDb } from '@/lib/db/client';
import { SYSTEM_USER_ID } from '@/lib/db/constants';
import type { DbManagerSquadPick } from '@/lib/db/types';
import { SqliteManagerSquadRepository } from './SqliteManagerSquadRepository';

function aPick(overrides: Partial<DbManagerSquadPick> = {}): DbManagerSquadPick {
  return {
    user_id: SYSTEM_USER_ID,
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

    const result = repo.listByTeamAndGameweek(SYSTEM_USER_ID, 1, 1);

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

    const result = repo.listByTeamAndGameweek(SYSTEM_USER_ID, 1, 1);

    expect(result[0]).toMatchObject({ player_id: 10, is_captain: true, is_vice_captain: false });
    expect(result[1]).toMatchObject({ player_id: 20, is_captain: false, is_vice_captain: true });
  });

  it('listByTeamAndGameweek returns an empty array for an unknown team', () => {
    expect(repo.listByTeamAndGameweek(SYSTEM_USER_ID, 9999, 1)).toHaveLength(0);
  });

  it('listByTeamAndGameweek isolates squads by team_id', () => {
    repo.upsertMany([aPick({ team_id: 1, squad_position: 1 })]);
    repo.upsertMany([aPick({ team_id: 2, squad_position: 1, player_id: 999 })]);

    expect(repo.listByTeamAndGameweek(SYSTEM_USER_ID, 1, 1)).toHaveLength(1);
    expect(repo.listByTeamAndGameweek(SYSTEM_USER_ID, 2, 1)[0]?.player_id).toBe(999);
  });

  it('listByTeamAndGameweek does not return picks owned by a different user_id', () => {
    // Picks stored with user_id=2 should not appear when querying user_id=1
    repo.upsertMany([aPick({ user_id: 2, squad_position: 1, player_id: 42 })]);

    expect(repo.listByTeamAndGameweek(SYSTEM_USER_ID, 1, 1)).toHaveLength(0);
  });

  it('latestGameweekForTeam returns the highest stored gameweek for a team', () => {
    repo.upsertMany([aPick({ team_id: 1, gameweek: 1 })]);
    repo.upsertMany([aPick({ team_id: 1, gameweek: 5, squad_position: 1, player_id: 999 })]);
    repo.upsertMany([aPick({ team_id: 1, gameweek: 3, squad_position: 2, player_id: 888 })]);

    expect(repo.latestGameweekForTeam(SYSTEM_USER_ID, 1)).toBe(5);
  });

  it('latestGameweekForTeam returns null when no squad has been synced for the team', () => {
    expect(repo.latestGameweekForTeam(SYSTEM_USER_ID, 9999)).toBeNull();
  });

  describe('listGameweeksForTeam', () => {
    it('returns all gameweeks with cached picks for a team, sorted ascending', () => {
      repo.upsertMany([aPick({ team_id: 1, gameweek: 5 })]);
      repo.upsertMany([aPick({ team_id: 1, gameweek: 2, squad_position: 2, player_id: 200 })]);
      repo.upsertMany([aPick({ team_id: 1, gameweek: 11, squad_position: 3, player_id: 300 })]);

      expect(repo.listGameweeksForTeam(SYSTEM_USER_ID, 1)).toEqual([2, 5, 11]);
    });

    it('deduplicates gameweeks even when multiple squad_positions exist for same GW', () => {
      repo.upsertMany(SQUAD.map((p) => ({ ...p, gameweek: 3 })));
      // SQUAD has 15 picks all for GW3 — should return [3], not [3×15]
      expect(repo.listGameweeksForTeam(SYSTEM_USER_ID, 1)).toEqual([3]);
    });

    it('returns empty array when no data for team', () => {
      expect(repo.listGameweeksForTeam(SYSTEM_USER_ID, 9999)).toEqual([]);
    });

    it('isolates by team_id — only returns GWs for the requested team', () => {
      repo.upsertMany([aPick({ team_id: 1, gameweek: 1 })]);
      repo.upsertMany([aPick({ team_id: 2, gameweek: 3, squad_position: 1, player_id: 999 })]);

      expect(repo.listGameweeksForTeam(SYSTEM_USER_ID, 1)).toEqual([1]);
      expect(repo.listGameweeksForTeam(SYSTEM_USER_ID, 2)).toEqual([3]);
    });

    it('isolates by user_id — picks owned by a different user are excluded', () => {
      repo.upsertMany([aPick({ user_id: SYSTEM_USER_ID, team_id: 1, gameweek: 1 })]);
      repo.upsertMany([
        aPick({ user_id: 2, team_id: 1, gameweek: 5, squad_position: 2, player_id: 999 }),
      ]);

      expect(repo.listGameweeksForTeam(SYSTEM_USER_ID, 1)).toEqual([1]);
    });
  });
});
