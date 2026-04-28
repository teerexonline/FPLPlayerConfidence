import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDb } from '@/lib/db/client';
import { SYSTEM_USER_ID } from '@/lib/db/constants';
import { SqliteWatchlistRepository } from './SqliteWatchlistRepository';

let dbPath: string;
let db: Database.Database;
let repo: SqliteWatchlistRepository;

beforeEach(() => {
  const dir = mkdtempSync(join(tmpdir(), 'fpl-watchlist-test-'));
  dbPath = join(dir, 'test.db');
  db = createDb(dbPath);
  repo = new SqliteWatchlistRepository(db);
});

afterEach(() => {
  db.close();
  rmSync(dbPath, { force: true });
});

describe('SqliteWatchlistRepository', () => {
  describe('findByUser', () => {
    it('returns an empty array when no players are watchlisted', () => {
      expect(repo.findByUser(SYSTEM_USER_ID)).toEqual([]);
    });

    it('returns watchlisted player IDs in descending added_at order', () => {
      repo.add(SYSTEM_USER_ID, 10);
      repo.add(SYSTEM_USER_ID, 20);
      repo.add(SYSTEM_USER_ID, 30);
      const ids = repo.findByUser(SYSTEM_USER_ID);
      expect(ids).toContain(10);
      expect(ids).toContain(20);
      expect(ids).toContain(30);
      expect(ids).toHaveLength(3);
    });

    it('does not return players from a different user', () => {
      repo.add(SYSTEM_USER_ID, 99);
      expect(repo.findByUser(2)).toEqual([]);
    });
  });

  describe('add', () => {
    it('adds a player to the watchlist', () => {
      repo.add(SYSTEM_USER_ID, 42);
      expect(repo.findByUser(SYSTEM_USER_ID)).toContain(42);
    });

    it('is idempotent — duplicate add does not throw or duplicate the entry', () => {
      repo.add(SYSTEM_USER_ID, 42);
      repo.add(SYSTEM_USER_ID, 42);
      expect(repo.findByUser(SYSTEM_USER_ID)).toHaveLength(1);
    });
  });

  describe('remove', () => {
    it('removes a player from the watchlist', () => {
      repo.add(SYSTEM_USER_ID, 42);
      repo.remove(SYSTEM_USER_ID, 42);
      expect(repo.findByUser(SYSTEM_USER_ID)).not.toContain(42);
    });

    it('is a no-op when the player was not watchlisted', () => {
      expect(() => {
        repo.remove(SYSTEM_USER_ID, 999);
      }).not.toThrow();
    });
  });

  describe('contains', () => {
    it('returns false when player is not watchlisted', () => {
      expect(repo.contains(SYSTEM_USER_ID, 42)).toBe(false);
    });

    it('returns true after adding a player', () => {
      repo.add(SYSTEM_USER_ID, 42);
      expect(repo.contains(SYSTEM_USER_ID, 42)).toBe(true);
    });

    it('returns false after removing a player', () => {
      repo.add(SYSTEM_USER_ID, 42);
      repo.remove(SYSTEM_USER_ID, 42);
      expect(repo.contains(SYSTEM_USER_ID, 42)).toBe(false);
    });

    it('is user-scoped — does not bleed across users', () => {
      repo.add(SYSTEM_USER_ID, 42);
      expect(repo.contains(2, 42)).toBe(false);
    });
  });
});
