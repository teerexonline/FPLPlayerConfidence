import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDb } from '@/lib/db/client';
import type { DbTeam } from '@/lib/db/types';
import { SqliteTeamRepository } from './SqliteTeamRepository';

function aTeam(overrides: Partial<DbTeam> = {}): DbTeam {
  return { id: 1, code: 3, name: 'Arsenal', short_name: 'ARS', ...overrides };
}

let dbPath: string;
let db: Database.Database;
let repo: SqliteTeamRepository;

beforeEach(() => {
  const dir = mkdtempSync(join(tmpdir(), 'fpl-test-'));
  dbPath = join(dir, 'test.db');
  db = createDb(dbPath);
  repo = new SqliteTeamRepository(db);
});

afterEach(() => {
  db.close();
  rmSync(dbPath, { force: true });
});

describe('SqliteTeamRepository', () => {
  it('upsert stores a team and findById retrieves the correct row', () => {
    repo.upsert(aTeam({ id: 1, code: 3, name: 'Arsenal', short_name: 'ARS' }));

    expect(repo.findById(1)).toMatchObject({ id: 1, code: 3, name: 'Arsenal' });
  });

  it('findById returns undefined when the team does not exist', () => {
    expect(repo.findById(99)).toBeUndefined();
  });

  it('upsert on the same id replaces the existing row', () => {
    repo.upsert(aTeam({ id: 1, name: 'Arsenal' }));
    repo.upsert(aTeam({ id: 1, name: 'Arsenal FC' }));

    expect(repo.findById(1)?.name).toBe('Arsenal FC');
    expect(repo.listAll()).toHaveLength(1);
  });

  it('upsertMany inserts all teams and listAll returns them ordered by id', () => {
    repo.upsertMany([
      aTeam({ id: 3, name: 'Chelsea' }),
      aTeam({ id: 1, name: 'Arsenal' }),
      aTeam({ id: 2, name: 'Aston Villa' }),
    ]);

    const names = repo.listAll().map((t) => t.name);
    expect(names).toEqual(['Arsenal', 'Aston Villa', 'Chelsea']);
  });

  it('listAll returns an empty array when no teams have been inserted', () => {
    expect(repo.listAll()).toHaveLength(0);
  });
});
