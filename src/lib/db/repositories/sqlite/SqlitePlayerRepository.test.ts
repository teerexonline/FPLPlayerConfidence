import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDb } from '@/lib/db/client';
import type { DbPlayer } from '@/lib/db/types';
import { SqlitePlayerRepository } from './SqlitePlayerRepository';

function aPlayer(overrides: Partial<DbPlayer> = {}): DbPlayer {
  return {
    id: 1,
    web_name: 'Raya',
    team_id: 1,
    position: 'GK',
    now_cost: 60,
    total_points: 141,
    updated_at: 1_700_000_000,
    status: 'a',
    chance_of_playing_next_round: null,
    news: '',
    influence: 0,
    creativity: 0,
    threat: 0,
    minutes: 0,
    next_fixture_fdr: 3,
    ...overrides,
  };
}

let dbPath: string;
let db: Database.Database;
let repo: SqlitePlayerRepository;

beforeEach(() => {
  const dir = mkdtempSync(join(tmpdir(), 'fpl-test-'));
  dbPath = join(dir, 'test.db');
  db = createDb(dbPath);
  repo = new SqlitePlayerRepository(db);
});

afterEach(() => {
  db.close();
  rmSync(dbPath, { force: true });
});

describe('SqlitePlayerRepository', () => {
  it('upsert stores a player and findById retrieves the correct row', () => {
    const player = aPlayer({ id: 1, web_name: 'Salah', position: 'MID', now_cost: 130 });

    repo.upsert(player);
    const found = repo.findById(1);

    expect(found).toMatchObject({ id: 1, web_name: 'Salah', position: 'MID', now_cost: 130 });
  });

  it('findById returns undefined when the player does not exist', () => {
    expect(repo.findById(9999)).toBeUndefined();
  });

  it('upsert on the same id replaces the existing row', () => {
    repo.upsert(aPlayer({ id: 5, now_cost: 60 }));
    repo.upsert(aPlayer({ id: 5, now_cost: 65 }));

    expect(repo.findById(5)?.now_cost).toBe(65);
    expect(repo.listAll()).toHaveLength(1);
  });

  it('upsertMany inserts all players in a single transaction', () => {
    const players = ['GK', 'DEF', 'MID', 'FWD'].map((pos, i) =>
      aPlayer({ id: i + 1, position: pos as DbPlayer['position'] }),
    );

    repo.upsertMany(players);

    expect(repo.listAll()).toHaveLength(4);
  });

  it('listAll returns players ordered by id ascending', () => {
    repo.upsertMany([aPlayer({ id: 3 }), aPlayer({ id: 1 }), aPlayer({ id: 2 })]);

    const ids = repo.listAll().map((p) => p.id);
    expect(ids).toEqual([1, 2, 3]);
  });

  it('listAll returns an empty array when no players have been inserted', () => {
    expect(repo.listAll()).toHaveLength(0);
  });

  it('stores and retrieves ICT stats and next_fixture_fdr', () => {
    const player = aPlayer({
      id: 99,
      influence: 450.5,
      creativity: 123.3,
      threat: 567.8,
      minutes: 2300,
      next_fixture_fdr: 2,
    });
    repo.upsert(player);
    const found = repo.findById(99);
    expect(found).toMatchObject({
      influence: 450.5,
      creativity: 123.3,
      threat: 567.8,
      minutes: 2300,
      next_fixture_fdr: 2,
    });
  });

  it('ICT fields default to 0 / next_fixture_fdr defaults to 3 for existing rows', () => {
    // Existing DB rows without ICT cols get the migration default values
    const player = aPlayer({
      id: 1,
      influence: 0,
      creativity: 0,
      threat: 0,
      minutes: 0,
      next_fixture_fdr: 3,
    });
    repo.upsert(player);
    const found = repo.findById(1);
    expect(found?.influence).toBe(0);
    expect(found?.next_fixture_fdr).toBe(3);
  });
});
