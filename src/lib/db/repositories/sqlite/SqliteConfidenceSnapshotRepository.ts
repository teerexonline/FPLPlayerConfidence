import type Database from 'better-sqlite3';
import { playerId } from '../../types';
import type { DbConfidenceSnapshot, PlayerId } from '../../types';
import type { ConfidenceSnapshotRepository, SnapshotBrief } from '../ConfidenceSnapshotRepository';

interface SnapshotRow {
  player_id: number;
  gameweek: number;
  confidence_after: number;
  delta: number;
  reason: string;
  fatigue_applied: number; // stored as 0 | 1
  motm_counter: number;
  defcon_counter: number;
  savecon_counter: number;
}

interface DeltaRow {
  player_id: number;
  delta: number;
}

interface RecentSnapshotRow {
  player_id: number;
  gameweek: number;
  delta: number;
  reason: string;
}

function rowToSnapshot(row: SnapshotRow): DbConfidenceSnapshot {
  return {
    player_id: row.player_id,
    gameweek: row.gameweek,
    confidence_after: row.confidence_after,
    delta: row.delta,
    reason: row.reason,
    fatigue_applied: row.fatigue_applied !== 0,
    motm_counter: row.motm_counter,
    defcon_counter: row.defcon_counter,
    savecon_counter: row.savecon_counter,
  };
}

const SELECT_COLS =
  'player_id, gameweek, confidence_after, delta, reason, fatigue_applied, motm_counter, defcon_counter, savecon_counter';

export class SqliteConfidenceSnapshotRepository implements ConfidenceSnapshotRepository {
  private readonly stmtUpsert: Database.Statement<
    [number, number, number, number, string, number, number, number, number]
  >;
  private readonly stmtListByPlayer: Database.Statement<[number], SnapshotRow>;
  private readonly stmtCurrentByPlayer: Database.Statement<[number], SnapshotRow>;
  private readonly stmtCurrentForAll: Database.Statement<[], SnapshotRow>;
  private readonly stmtLast5ForAll: Database.Statement<[], DeltaRow>;
  private readonly stmtDeleteByPlayer: Database.Statement<[number]>;
  private readonly stmtSnapshotsAtGameweek: Database.Statement<[number], SnapshotRow>;
  private readonly stmtLatestAtOrBefore: Database.Statement<[number], SnapshotRow>;
  private readonly stmtRecentAppearances: Database.Statement<
    [number],
    { player_id: number; count: number }
  >;
  private readonly stmtRecentBoost: Database.Statement<
    [number, number],
    { player_id: number; boost_gw: number; boost_delta: number }
  >;
  private readonly stmtRecentSnapshots: Database.Statement<[number], RecentSnapshotRow>;

  constructor(private readonly db: Database.Database) {
    this.stmtUpsert = db.prepare(
      `INSERT OR REPLACE INTO confidence_snapshots
       (player_id, gameweek, confidence_after, delta, reason, fatigue_applied, motm_counter, defcon_counter, savecon_counter)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    this.stmtListByPlayer = db.prepare<[number], SnapshotRow>(
      `SELECT ${SELECT_COLS} FROM confidence_snapshots
       WHERE player_id = ? ORDER BY gameweek ASC`,
    );
    this.stmtCurrentByPlayer = db.prepare<[number], SnapshotRow>(
      `SELECT ${SELECT_COLS} FROM confidence_snapshots
       WHERE player_id = ? ORDER BY gameweek DESC LIMIT 1`,
    );
    this.stmtCurrentForAll = db.prepare<[], SnapshotRow>(
      `SELECT ${SELECT_COLS} FROM confidence_snapshots cs
       WHERE gameweek = (
         SELECT MAX(gameweek) FROM confidence_snapshots WHERE player_id = cs.player_id
       )
       ORDER BY player_id`,
    );
    // Window function: top-5 most-recent rows per player, returned oldest-first.
    // SQLite ≥3.25 (bundled in better-sqlite3) supports ROW_NUMBER() OVER (...).
    this.stmtLast5ForAll = db.prepare<[], DeltaRow>(
      `SELECT player_id, delta FROM (
         SELECT player_id, gameweek, delta,
           ROW_NUMBER() OVER (PARTITION BY player_id ORDER BY gameweek DESC) AS rn
         FROM confidence_snapshots
       ) WHERE rn <= 5
       ORDER BY player_id, gameweek ASC`,
    );
    this.stmtDeleteByPlayer = db.prepare<[number]>(
      'DELETE FROM confidence_snapshots WHERE player_id = ?',
    );
    this.stmtSnapshotsAtGameweek = db.prepare<[number], SnapshotRow>(
      `SELECT ${SELECT_COLS} FROM confidence_snapshots WHERE gameweek = ?`,
    );
    // Window function: for each player, pick the row with the highest gameweek ≤ ?.
    // Replaces snapshotsAtGameweek for historical GW navigation so players who
    // skipped a week don't fall back to confidence=0.
    this.stmtLatestAtOrBefore = db.prepare<[number], SnapshotRow>(
      `SELECT ${SELECT_COLS} FROM (
         SELECT ${SELECT_COLS},
                ROW_NUMBER() OVER (PARTITION BY player_id ORDER BY gameweek DESC) AS rn
         FROM confidence_snapshots
         WHERE gameweek <= ?
       ) WHERE rn = 1`,
    );
    this.stmtRecentAppearances = db.prepare<[number], { player_id: number; count: number }>(
      `SELECT player_id, COUNT(*) AS count
       FROM confidence_snapshots
       WHERE gameweek >= ?
       GROUP BY player_id`,
    );
    this.stmtRecentBoost = db.prepare<
      [number, number],
      { player_id: number; boost_gw: number; boost_delta: number }
    >(
      `SELECT player_id, MAX(gameweek) AS boost_gw, delta AS boost_delta
       FROM confidence_snapshots
       WHERE delta >= 3 AND gameweek >= ? AND gameweek <= ?
       GROUP BY player_id`,
    );
    this.stmtRecentSnapshots = db.prepare<[number], RecentSnapshotRow>(
      `SELECT player_id, gameweek, delta, reason
       FROM confidence_snapshots
       WHERE gameweek >= ?
       ORDER BY player_id, gameweek ASC`,
    );
  }

  upsert(snapshot: DbConfidenceSnapshot): void {
    this.stmtUpsert.run(
      snapshot.player_id,
      snapshot.gameweek,
      snapshot.confidence_after,
      snapshot.delta,
      snapshot.reason,
      snapshot.fatigue_applied ? 1 : 0,
      snapshot.motm_counter,
      snapshot.defcon_counter,
      snapshot.savecon_counter,
    );
  }

  upsertMany(snapshots: readonly DbConfidenceSnapshot[]): void {
    const tx = this.db.transaction(() => {
      for (const s of snapshots) {
        this.stmtUpsert.run(
          s.player_id,
          s.gameweek,
          s.confidence_after,
          s.delta,
          s.reason,
          s.fatigue_applied ? 1 : 0,
          s.motm_counter,
          s.defcon_counter,
          s.savecon_counter,
        );
      }
    });
    tx();
  }

  listByPlayer(pid: PlayerId): readonly DbConfidenceSnapshot[] {
    return this.stmtListByPlayer.all(pid).map(rowToSnapshot);
  }

  currentByPlayer(pid: PlayerId): DbConfidenceSnapshot | undefined {
    const row = this.stmtCurrentByPlayer.get(pid);
    return row ? rowToSnapshot(row) : undefined;
  }

  currentForAllPlayers(): readonly { playerId: PlayerId; snapshot: DbConfidenceSnapshot }[] {
    return this.stmtCurrentForAll.all().map((row) => ({
      playerId: playerId(row.player_id),
      snapshot: rowToSnapshot(row),
    }));
  }

  listLast5ForAllPlayers(): readonly { playerId: PlayerId; deltas: readonly number[] }[] {
    const rows = this.stmtLast5ForAll.all();
    const map = new Map<number, number[]>();
    for (const row of rows) {
      let arr = map.get(row.player_id);
      if (!arr) {
        arr = [];
        map.set(row.player_id, arr);
      }
      arr.push(row.delta);
    }
    return Array.from(map.entries()).map(([pid, deltas]) => ({
      playerId: playerId(pid),
      deltas,
    }));
  }

  recentAppearancesForAllPlayers(minGw: number): ReadonlyMap<number, number> {
    const rows = this.stmtRecentAppearances.all(minGw);
    const map = new Map<number, number>();
    for (const row of rows) {
      map.set(row.player_id, row.count);
    }
    return map;
  }

  recentBoostForAllPlayers(
    minGw: number,
    maxGw: number,
  ): ReadonlyMap<number, { boostGw: number; boostDelta: number }> {
    const rows = this.stmtRecentBoost.all(minGw, maxGw);
    const map = new Map<number, { boostGw: number; boostDelta: number }>();
    for (const row of rows) {
      map.set(row.player_id, { boostGw: row.boost_gw, boostDelta: row.boost_delta });
    }
    return map;
  }

  listRecentSnapshotsForAllPlayers(minGw: number): ReadonlyMap<number, readonly SnapshotBrief[]> {
    const rows = this.stmtRecentSnapshots.all(minGw);
    const map = new Map<number, SnapshotBrief[]>();
    for (const row of rows) {
      let arr = map.get(row.player_id);
      if (!arr) {
        arr = [];
        map.set(row.player_id, arr);
      }
      arr.push({ gameweek: row.gameweek, delta: row.delta, reason: row.reason });
    }
    return map;
  }

  snapshotsAtGameweek(gameweek: number): readonly DbConfidenceSnapshot[] {
    return this.stmtSnapshotsAtGameweek.all(gameweek).map(rowToSnapshot);
  }

  latestSnapshotsAtOrBeforeGameweek(gameweek: number): readonly DbConfidenceSnapshot[] {
    return this.stmtLatestAtOrBefore.all(gameweek).map(rowToSnapshot);
  }

  deleteByPlayer(pid: PlayerId): void {
    this.stmtDeleteByPlayer.run(pid);
  }
}
