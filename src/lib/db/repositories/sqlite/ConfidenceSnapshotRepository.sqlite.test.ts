import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDb } from '@/lib/db/client';
import { playerId } from '@/lib/db/types';
import type { DbConfidenceSnapshot } from '@/lib/db/types';
import { SqliteConfidenceSnapshotRepository } from './SqliteConfidenceSnapshotRepository';

function aSnapshot(overrides: Partial<DbConfidenceSnapshot> = {}): DbConfidenceSnapshot {
  return {
    player_id: 1,
    gameweek: 1,
    confidence_after: 0,
    delta: 0,
    reason: 'test',
    fatigue_applied: false,
    motm_counter: 0,
    defcon_counter: 0,
    savecon_counter: 0,
    ...overrides,
  };
}

let dbPath: string;
let db: Database.Database;
let repo: SqliteConfidenceSnapshotRepository;

beforeEach(() => {
  const dir = mkdtempSync(join(tmpdir(), 'fpl-test-'));
  dbPath = join(dir, 'test.db');
  db = createDb(dbPath);
  repo = new SqliteConfidenceSnapshotRepository(db);
});

afterEach(() => {
  db.close();
  rmSync(dbPath, { force: true });
});

describe('SqliteConfidenceSnapshotRepository', () => {
  // ── Full-season history (three user-specified tests) ──────────────────────

  it('listByPlayer returns all 20 season snapshots in ascending gameweek order', () => {
    const pid = playerId(42);
    const snapshots = Array.from({ length: 20 }, (_, i) =>
      aSnapshot({ player_id: 42, gameweek: i + 1, confidence_after: i - 10 }),
    );

    repo.upsertMany(snapshots);
    const result = repo.listByPlayer(pid);

    expect(result).toHaveLength(20); // (a) exactly 20 rows
    expect(result.map((s) => s.gameweek)).toEqual(
      // (b) ordered by gameweek ASC
      Array.from({ length: 20 }, (_, i) => i + 1),
    );
    result.forEach((s, i) => {
      // (c) values match what was inserted
      expect(s.confidence_after).toBe(i - 10);
    });
  });

  it('upsert on the same (player_id, gameweek) replaces the existing row — exactly 1 row with the updated confidence', () => {
    const pid = playerId(123);

    repo.upsert(aSnapshot({ player_id: 123, gameweek: 5, confidence_after: 2 }));
    repo.upsert(aSnapshot({ player_id: 123, gameweek: 5, confidence_after: 4 }));

    const result = repo.listByPlayer(pid);

    expect(result).toHaveLength(1);
    expect(result[0]?.confidence_after).toBe(4);
  });

  it('currentByPlayer returns the highest-gameweek snapshot regardless of insertion order', () => {
    const pid = playerId(99);

    // Intentionally non-chronological insertion order
    repo.upsert(aSnapshot({ player_id: 99, gameweek: 10, confidence_after: 3 }));
    repo.upsert(aSnapshot({ player_id: 99, gameweek: 5, confidence_after: 1 }));
    repo.upsert(aSnapshot({ player_id: 99, gameweek: 8, confidence_after: 2 }));

    const current = repo.currentByPlayer(pid);

    expect(current?.gameweek).toBe(10);
    expect(current?.confidence_after).toBe(3);
  });

  // ── upsert / upsertMany ───────────────────────────────────────────────────

  it('upsert stores a snapshot and listByPlayer retrieves it with correct field mapping', () => {
    const pid = playerId(1);
    const snap = aSnapshot({
      player_id: 1,
      gameweek: 3,
      confidence_after: 2,
      delta: 1,
      reason: 'MOTM vs big team',
      fatigue_applied: true,
      motm_counter: 3,
    });

    repo.upsert(snap);
    const result = repo.listByPlayer(pid);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      gameweek: 3,
      confidence_after: 2,
      delta: 1,
      reason: 'MOTM vs big team',
      fatigue_applied: true,
      motm_counter: 3,
    });
  });

  it('upsertMany stores multiple snapshots for different players', () => {
    repo.upsertMany([
      aSnapshot({ player_id: 10, gameweek: 1, confidence_after: 1 }),
      aSnapshot({ player_id: 10, gameweek: 2, confidence_after: 2 }),
      aSnapshot({ player_id: 20, gameweek: 1, confidence_after: -1 }),
    ]);

    expect(repo.listByPlayer(playerId(10))).toHaveLength(2);
    expect(repo.listByPlayer(playerId(20))).toHaveLength(1);
  });

  // ── currentByPlayer ───────────────────────────────────────────────────────

  it('currentByPlayer returns undefined when no snapshots exist for the player', () => {
    expect(repo.currentByPlayer(playerId(999))).toBeUndefined();
  });

  // ── currentForAllPlayers ──────────────────────────────────────────────────

  it('currentForAllPlayers returns one entry per player with the highest-gameweek snapshot', () => {
    repo.upsertMany([
      aSnapshot({ player_id: 1, gameweek: 1, confidence_after: 1 }),
      aSnapshot({ player_id: 1, gameweek: 3, confidence_after: 3 }),
      aSnapshot({ player_id: 2, gameweek: 2, confidence_after: -1 }),
    ]);

    const result = repo.currentForAllPlayers();

    expect(result).toHaveLength(2);
    const p1 = result.find((r) => r.playerId === 1);
    const p2 = result.find((r) => r.playerId === 2);
    expect(p1?.snapshot.confidence_after).toBe(3); // GW3 wins, not GW1
    expect(p2?.snapshot.confidence_after).toBe(-1);
  });

  it('currentForAllPlayers returns an empty array when no snapshots exist', () => {
    expect(repo.currentForAllPlayers()).toHaveLength(0);
  });

  // ── deleteByPlayer ────────────────────────────────────────────────────────

  it('deleteByPlayer removes all snapshots for the given player and leaves others intact', () => {
    repo.upsertMany([
      aSnapshot({ player_id: 1, gameweek: 1 }),
      aSnapshot({ player_id: 1, gameweek: 2 }),
      aSnapshot({ player_id: 2, gameweek: 1 }),
    ]);

    repo.deleteByPlayer(playerId(1));

    expect(repo.listByPlayer(playerId(1))).toHaveLength(0);
    expect(repo.listByPlayer(playerId(2))).toHaveLength(1);
  });

  it('deleteByPlayer is a no-op when the player has no snapshots', () => {
    const act = (): void => {
      repo.deleteByPlayer(playerId(999));
    };
    expect(act).not.toThrow();
  });

  describe('latestSnapshotsAtOrBeforeGameweek', () => {
    it('returns the most recent snapshot per player at or before the target GW', () => {
      // Player 1: has GW3, GW5, GW7 — viewing GW6 should return GW5
      // Player 2: has GW2, GW6 — viewing GW6 should return GW6
      // Player 3: has GW8 only — viewing GW6 should return nothing (no snapshots ≤ 6)
      repo.upsertMany([
        aSnapshot({ player_id: 1, gameweek: 3, confidence_after: 1 }),
        aSnapshot({ player_id: 1, gameweek: 5, confidence_after: 2 }),
        aSnapshot({ player_id: 1, gameweek: 7, confidence_after: 3 }),
        aSnapshot({ player_id: 2, gameweek: 2, confidence_after: -1 }),
        aSnapshot({ player_id: 2, gameweek: 6, confidence_after: 4 }),
        aSnapshot({ player_id: 3, gameweek: 8, confidence_after: 5 }),
      ]);

      const result = repo.latestSnapshotsAtOrBeforeGameweek(6);

      expect(result).toHaveLength(2); // player 3 excluded (no snapshot ≤ 6)
      const map = new Map(result.map((s) => [s.player_id, s]));
      expect(map.get(1)?.gameweek).toBe(5); // GW5, not GW7
      expect(map.get(1)?.confidence_after).toBe(2);
      expect(map.get(2)?.gameweek).toBe(6); // exact GW6 match
      expect(map.get(2)?.confidence_after).toBe(4);
    });

    it('returns the exact-GW snapshot when a player played exactly at the target GW', () => {
      repo.upsertMany([
        aSnapshot({ player_id: 10, gameweek: 34, confidence_after: 3 }),
        aSnapshot({ player_id: 10, gameweek: 33, confidence_after: 2 }),
      ]);

      const result = repo.latestSnapshotsAtOrBeforeGameweek(34);
      expect(result).toHaveLength(1);
      expect(result[0]?.gameweek).toBe(34);
      expect(result[0]?.confidence_after).toBe(3);
    });

    it('falls back to an earlier GW snapshot when the player has no GW at targetGw', () => {
      // Simulates the bug: player played GW33 but not GW34
      repo.upsertMany([aSnapshot({ player_id: 7, gameweek: 33, confidence_after: 4 })]);

      const result = repo.latestSnapshotsAtOrBeforeGameweek(34);
      expect(result).toHaveLength(1);
      expect(result[0]?.gameweek).toBe(33);
      expect(result[0]?.confidence_after).toBe(4); // NOT 0 — no corruption
    });

    it('returns empty array when no snapshots exist at or before the target GW', () => {
      repo.upsertMany([aSnapshot({ player_id: 1, gameweek: 20, confidence_after: 1 })]);

      const result = repo.latestSnapshotsAtOrBeforeGameweek(5);
      expect(result).toHaveLength(0);
    });

    it('returns empty array when the table is empty', () => {
      expect(repo.latestSnapshotsAtOrBeforeGameweek(34)).toHaveLength(0);
    });

    it('handles multiple players correctly — one entry per player', () => {
      repo.upsertMany([
        aSnapshot({ player_id: 1, gameweek: 1, confidence_after: 1 }),
        aSnapshot({ player_id: 1, gameweek: 3, confidence_after: 3 }),
        aSnapshot({ player_id: 2, gameweek: 2, confidence_after: -2 }),
        aSnapshot({ player_id: 3, gameweek: 3, confidence_after: 5 }),
      ]);

      const result = repo.latestSnapshotsAtOrBeforeGameweek(3);

      expect(result).toHaveLength(3);
      const map = new Map(result.map((s) => [s.player_id, s.confidence_after]));
      expect(map.get(1)).toBe(3); // GW3 wins over GW1
      expect(map.get(2)).toBe(-2);
      expect(map.get(3)).toBe(5);
    });
  });

  describe('snapshotsAtGameweek', () => {
    it('returns all player snapshots at the specified gameweek', () => {
      repo.upsertMany([
        aSnapshot({ player_id: 10, gameweek: 5, confidence_after: 3 }),
        aSnapshot({ player_id: 20, gameweek: 5, confidence_after: -1 }),
        aSnapshot({ player_id: 30, gameweek: 5, confidence_after: 2 }),
        aSnapshot({ player_id: 10, gameweek: 6, confidence_after: 4 }), // different GW
      ]);

      const result = repo.snapshotsAtGameweek(5);
      expect(result).toHaveLength(3);
      expect(result.map((s) => s.player_id).sort()).toEqual([10, 20, 30]);
    });

    it('returns empty array when no snapshots exist at the given gameweek', () => {
      expect(repo.snapshotsAtGameweek(99)).toHaveLength(0);
    });

    it('returns correct confidence_after values for each player', () => {
      repo.upsertMany([
        aSnapshot({ player_id: 1, gameweek: 10, confidence_after: 2 }),
        aSnapshot({ player_id: 2, gameweek: 10, confidence_after: -3 }),
      ]);

      const result = repo.snapshotsAtGameweek(10);
      const map = new Map(result.map((s) => [s.player_id, s.confidence_after]));
      expect(map.get(1)).toBe(2);
      expect(map.get(2)).toBe(-3);
    });
  });
});
