import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDb } from '@/lib/db/client';
import { SYSTEM_USER_ID } from '@/lib/db/constants';
import { SqliteUserRepository } from './SqliteUserRepository';

let dbPath: string;
let db: Database.Database;
let repo: SqliteUserRepository;

beforeEach(() => {
  const dir = mkdtempSync(join(tmpdir(), 'fpl-user-test-'));
  dbPath = join(dir, 'test.db');
  db = createDb(dbPath);
  repo = new SqliteUserRepository(db);
});

afterEach(() => {
  db.close();
  rmSync(dbPath, { force: true });
});

describe('SqliteUserRepository', () => {
  describe('findById', () => {
    it('returns null for an id that does not exist', () => {
      expect(repo.findById(9999)).toBeNull();
    });

    it('returns SYSTEM_USER after createDb seeds the migration', () => {
      const user = repo.findById(SYSTEM_USER_ID);

      expect(user).not.toBeNull();
      expect(user?.id).toBe(SYSTEM_USER_ID);
      expect(user?.email).toBe('system@fpltool.internal');
      expect(typeof user?.created_at).toBe('number');
      expect(user?.created_at).toBeGreaterThan(0);
    });
  });

  describe('listAll', () => {
    it('returns exactly one user (SYSTEM_USER) on a fresh database', () => {
      const users = repo.listAll();

      expect(users).toHaveLength(1);
      expect(users[0]?.id).toBe(SYSTEM_USER_ID);
    });
  });
});
