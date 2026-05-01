import type postgres from 'postgres';
import { playerId } from '../../types';
import type { DbConfidenceSnapshot, PlayerId } from '../../types';
import type { ConfidenceSnapshotRepository, SnapshotBrief } from '../ConfidenceSnapshotRepository';

interface SnapshotRow {
  player_id: number;
  gameweek: number;
  confidence_after: number;
  delta: number;
  raw_delta: number;
  event_magnitude: number;
  reason: string;
  fatigue_applied: boolean;
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
  raw_delta: number;
  event_magnitude: number;
  reason: string;
}

interface AppearanceRow {
  player_id: number;
  count: string;
}

interface BoostRow {
  player_id: number;
  boost_gw: number;
  boost_delta: number;
}

const SELECT_COLS =
  'player_id, gameweek, confidence_after, delta, raw_delta, event_magnitude, reason, fatigue_applied, motm_counter, defcon_counter, savecon_counter';

function rowToSnapshot(row: SnapshotRow): DbConfidenceSnapshot {
  return {
    player_id: row.player_id,
    gameweek: row.gameweek,
    confidence_after: row.confidence_after,
    delta: row.delta,
    raw_delta: row.raw_delta,
    event_magnitude: row.event_magnitude,
    reason: row.reason,
    fatigue_applied: row.fatigue_applied,
    motm_counter: row.motm_counter,
    defcon_counter: row.defcon_counter,
    savecon_counter: row.savecon_counter,
  };
}

export class PostgresConfidenceSnapshotRepository implements ConfidenceSnapshotRepository {
  constructor(private readonly sql: postgres.Sql) {}

  async upsert(snapshot: DbConfidenceSnapshot): Promise<void> {
    await this.sql`
      INSERT INTO confidence_snapshots
        (player_id, gameweek, confidence_after, delta, raw_delta, event_magnitude,
         reason, fatigue_applied, motm_counter, defcon_counter, savecon_counter)
      VALUES
        (${snapshot.player_id}, ${snapshot.gameweek}, ${snapshot.confidence_after},
         ${snapshot.delta}, ${snapshot.raw_delta}, ${snapshot.event_magnitude},
         ${snapshot.reason}, ${snapshot.fatigue_applied},
         ${snapshot.motm_counter}, ${snapshot.defcon_counter}, ${snapshot.savecon_counter})
      ON CONFLICT (player_id, gameweek) DO UPDATE SET
        confidence_after = EXCLUDED.confidence_after,
        delta = EXCLUDED.delta,
        raw_delta = EXCLUDED.raw_delta,
        event_magnitude = EXCLUDED.event_magnitude,
        reason = EXCLUDED.reason,
        fatigue_applied = EXCLUDED.fatigue_applied,
        motm_counter = EXCLUDED.motm_counter,
        defcon_counter = EXCLUDED.defcon_counter,
        savecon_counter = EXCLUDED.savecon_counter
    `;
  }

  async upsertMany(snapshots: readonly DbConfidenceSnapshot[]): Promise<void> {
    if (snapshots.length === 0) return;
    const values = snapshots.map((s) => ({
      player_id: s.player_id,
      gameweek: s.gameweek,
      confidence_after: s.confidence_after,
      delta: s.delta,
      raw_delta: s.raw_delta,
      event_magnitude: s.event_magnitude,
      reason: s.reason,
      fatigue_applied: s.fatigue_applied,
      motm_counter: s.motm_counter,
      defcon_counter: s.defcon_counter,
      savecon_counter: s.savecon_counter,
    }));
    await this.sql`
      INSERT INTO confidence_snapshots ${this.sql(values)}
      ON CONFLICT (player_id, gameweek) DO UPDATE SET
        confidence_after = EXCLUDED.confidence_after,
        delta = EXCLUDED.delta,
        raw_delta = EXCLUDED.raw_delta,
        event_magnitude = EXCLUDED.event_magnitude,
        reason = EXCLUDED.reason,
        fatigue_applied = EXCLUDED.fatigue_applied,
        motm_counter = EXCLUDED.motm_counter,
        defcon_counter = EXCLUDED.defcon_counter,
        savecon_counter = EXCLUDED.savecon_counter
    `;
  }

  async listByPlayer(pid: PlayerId): Promise<readonly DbConfidenceSnapshot[]> {
    const rows = await this.sql<SnapshotRow[]>`
      SELECT ${this.sql(SELECT_COLS.split(', '))} FROM confidence_snapshots
      WHERE player_id = ${pid} ORDER BY gameweek ASC
    `;
    return rows.map(rowToSnapshot);
  }

  async currentByPlayer(pid: PlayerId): Promise<DbConfidenceSnapshot | undefined> {
    const rows = await this.sql<SnapshotRow[]>`
      SELECT ${this.sql(SELECT_COLS.split(', '))} FROM confidence_snapshots
      WHERE player_id = ${pid} ORDER BY gameweek DESC LIMIT 1
    `;
    const row = rows[0];
    return row ? rowToSnapshot(row) : undefined;
  }

  async currentForAllPlayers(): Promise<
    readonly { playerId: PlayerId; snapshot: DbConfidenceSnapshot }[]
  > {
    // DISTINCT ON is Postgres-specific: picks the first row per player_id after
    // ordering by gameweek DESC, giving us the most recent snapshot per player.
    const rows = await this.sql<SnapshotRow[]>`
      SELECT DISTINCT ON (player_id) ${this.sql(SELECT_COLS.split(', '))}
      FROM confidence_snapshots
      ORDER BY player_id, gameweek DESC
    `;
    return rows.map((row) => ({
      playerId: playerId(row.player_id),
      snapshot: rowToSnapshot(row),
    }));
  }

  async listLast5ForAllPlayers(): Promise<
    readonly { playerId: PlayerId; deltas: readonly number[] }[]
  > {
    const rows = await this.sql<DeltaRow[]>`
      SELECT player_id, delta FROM (
        SELECT player_id, gameweek, delta,
          ROW_NUMBER() OVER (PARTITION BY player_id ORDER BY gameweek DESC) AS rn
        FROM confidence_snapshots
      ) ranked
      WHERE rn <= 5
      ORDER BY player_id, gameweek ASC
    `;
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

  async snapshotsAtGameweek(gameweek: number): Promise<readonly DbConfidenceSnapshot[]> {
    const rows = await this.sql<SnapshotRow[]>`
      SELECT ${this.sql(SELECT_COLS.split(', '))} FROM confidence_snapshots
      WHERE gameweek = ${gameweek}
    `;
    return rows.map(rowToSnapshot);
  }

  async latestSnapshotsAtOrBeforeGameweek(
    gameweek: number,
  ): Promise<readonly DbConfidenceSnapshot[]> {
    // DISTINCT ON: for each player, return the row with the highest gameweek ≤ given GW.
    const rows = await this.sql<SnapshotRow[]>`
      SELECT DISTINCT ON (player_id) ${this.sql(SELECT_COLS.split(', '))}
      FROM confidence_snapshots
      WHERE gameweek <= ${gameweek}
      ORDER BY player_id, gameweek DESC
    `;
    return rows.map(rowToSnapshot);
  }

  async recentAppearancesForAllPlayers(minGw: number): Promise<ReadonlyMap<number, number>> {
    const rows = await this.sql<AppearanceRow[]>`
      SELECT player_id, COUNT(*) AS count
      FROM confidence_snapshots
      WHERE gameweek >= ${minGw}
      GROUP BY player_id
    `;
    const map = new Map<number, number>();
    for (const row of rows) {
      map.set(row.player_id, Number(row.count));
    }
    return map;
  }

  async recentBoostForAllPlayers(
    minGw: number,
    maxGw: number,
  ): Promise<ReadonlyMap<number, { boostGw: number; boostDelta: number }>> {
    // DISTINCT ON: for each player, return the row with the highest qualifying gameweek.
    // boost_delta carries event_magnitude (pre-clamp) so flame level is ceiling-absorption-proof.
    const rows = await this.sql<BoostRow[]>`
      SELECT DISTINCT ON (player_id)
        player_id,
        gameweek AS boost_gw,
        event_magnitude AS boost_delta
      FROM confidence_snapshots
      WHERE event_magnitude >= 3 AND gameweek >= ${minGw} AND gameweek <= ${maxGw}
      ORDER BY player_id, gameweek DESC
    `;
    const map = new Map<number, { boostGw: number; boostDelta: number }>();
    for (const row of rows) {
      map.set(row.player_id, { boostGw: row.boost_gw, boostDelta: row.boost_delta });
    }
    return map;
  }

  async listRecentSnapshotsForAllPlayers(
    minGw: number,
  ): Promise<ReadonlyMap<number, readonly SnapshotBrief[]>> {
    const rows = await this.sql<RecentSnapshotRow[]>`
      SELECT player_id, gameweek, delta, raw_delta, event_magnitude, reason
      FROM confidence_snapshots
      WHERE gameweek >= ${minGw}
      ORDER BY player_id, gameweek ASC
    `;
    const map = new Map<number, SnapshotBrief[]>();
    for (const row of rows) {
      let arr = map.get(row.player_id);
      if (!arr) {
        arr = [];
        map.set(row.player_id, arr);
      }
      arr.push({
        gameweek: row.gameweek,
        delta: row.delta,
        rawDelta: row.raw_delta,
        eventMagnitude: row.event_magnitude,
        reason: row.reason,
      });
    }
    return map;
  }

  async deleteByPlayer(pid: PlayerId): Promise<void> {
    await this.sql`DELETE FROM confidence_snapshots WHERE player_id = ${pid}`;
  }
}
