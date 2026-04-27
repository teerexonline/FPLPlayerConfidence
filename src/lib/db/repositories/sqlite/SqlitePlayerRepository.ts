import type Database from 'better-sqlite3';
import type { DbPlayer, Position } from '../../types';
import type { PlayerRepository } from '../PlayerRepository';

interface PlayerRow {
  id: number;
  web_name: string;
  team_id: number;
  position: string;
  now_cost: number;
  total_points: number;
  updated_at: number;
  status: string;
  chance_of_playing_next_round: number | null;
  news: string;
  influence: number;
  creativity: number;
  threat: number;
  minutes: number;
  next_fixture_fdr: number;
}

function isPosition(s: string): s is Position {
  return s === 'GK' || s === 'DEF' || s === 'MID' || s === 'FWD';
}

function rowToPlayer(row: PlayerRow): DbPlayer {
  const pos = row.position;
  if (!isPosition(pos)) throw new Error(`Unexpected position in database: ${pos}`);
  return {
    id: row.id,
    web_name: row.web_name,
    team_id: row.team_id,
    position: pos,
    now_cost: row.now_cost,
    total_points: row.total_points,
    updated_at: row.updated_at,
    status: row.status,
    chance_of_playing_next_round: row.chance_of_playing_next_round,
    news: row.news,
    influence: row.influence,
    creativity: row.creativity,
    threat: row.threat,
    minutes: row.minutes,
    next_fixture_fdr: row.next_fixture_fdr,
  };
}

const SELECT_COLS =
  'id, web_name, team_id, position, now_cost, total_points, updated_at, status, ' +
  'chance_of_playing_next_round, news, influence, creativity, threat, minutes, next_fixture_fdr';

export class SqlitePlayerRepository implements PlayerRepository {
  private readonly stmtFindById: Database.Statement<[number], PlayerRow>;
  private readonly stmtListAll: Database.Statement<[], PlayerRow>;
  private readonly stmtUpsert: Database.Statement<
    [
      number,
      string,
      number,
      string,
      number,
      number,
      number,
      string,
      number | null,
      string,
      number,
      number,
      number,
      number,
      number,
    ]
  >;

  constructor(private readonly db: Database.Database) {
    this.stmtFindById = db.prepare<[number], PlayerRow>(
      `SELECT ${SELECT_COLS} FROM players WHERE id = ?`,
    );
    this.stmtListAll = db.prepare<[], PlayerRow>(`SELECT ${SELECT_COLS} FROM players ORDER BY id`);
    this.stmtUpsert = db.prepare(
      `INSERT OR REPLACE INTO players
       (id, web_name, team_id, position, now_cost, total_points, updated_at, status,
        chance_of_playing_next_round, news, influence, creativity, threat, minutes, next_fixture_fdr)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
  }

  upsert(player: DbPlayer): void {
    this.stmtUpsert.run(
      player.id,
      player.web_name,
      player.team_id,
      player.position,
      player.now_cost,
      player.total_points,
      player.updated_at,
      player.status,
      player.chance_of_playing_next_round,
      player.news,
      player.influence,
      player.creativity,
      player.threat,
      player.minutes,
      player.next_fixture_fdr,
    );
  }

  upsertMany(players: readonly DbPlayer[]): void {
    const tx = this.db.transaction(() => {
      for (const p of players) {
        this.stmtUpsert.run(
          p.id,
          p.web_name,
          p.team_id,
          p.position,
          p.now_cost,
          p.total_points,
          p.updated_at,
          p.status,
          p.chance_of_playing_next_round,
          p.news,
          p.influence,
          p.creativity,
          p.threat,
          p.minutes,
          p.next_fixture_fdr,
        );
      }
    });
    tx();
  }

  findById(id: number): DbPlayer | undefined {
    const row = this.stmtFindById.get(id);
    return row ? rowToPlayer(row) : undefined;
  }

  listAll(): readonly DbPlayer[] {
    return this.stmtListAll.all().map(rowToPlayer);
  }
}
