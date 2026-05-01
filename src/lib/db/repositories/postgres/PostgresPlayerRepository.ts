import type postgres from 'postgres';
import type { DbPlayer, Position } from '../../types';
import type { PlayerRepository } from '../PlayerRepository';

interface PlayerRow {
  id: number;
  web_name: string;
  team_id: number;
  position: string;
  now_cost: number;
  total_points: number;
  updated_at: string;
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
    updated_at: Number(row.updated_at),
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

export class PostgresPlayerRepository implements PlayerRepository {
  constructor(private readonly sql: postgres.Sql) {}

  async upsert(player: DbPlayer): Promise<void> {
    await this.sql`
      INSERT INTO players
        (id, web_name, team_id, position, now_cost, total_points, updated_at, status,
         chance_of_playing_next_round, news, influence, creativity, threat, minutes, next_fixture_fdr)
      VALUES
        (${player.id}, ${player.web_name}, ${player.team_id}, ${player.position},
         ${player.now_cost}, ${player.total_points}, ${player.updated_at}, ${player.status},
         ${player.chance_of_playing_next_round ?? null}, ${player.news},
         ${player.influence}, ${player.creativity}, ${player.threat},
         ${player.minutes}, ${player.next_fixture_fdr})
      ON CONFLICT (id) DO UPDATE SET
        web_name = EXCLUDED.web_name,
        team_id = EXCLUDED.team_id,
        position = EXCLUDED.position,
        now_cost = EXCLUDED.now_cost,
        total_points = EXCLUDED.total_points,
        updated_at = EXCLUDED.updated_at,
        status = EXCLUDED.status,
        chance_of_playing_next_round = EXCLUDED.chance_of_playing_next_round,
        news = EXCLUDED.news,
        influence = EXCLUDED.influence,
        creativity = EXCLUDED.creativity,
        threat = EXCLUDED.threat,
        minutes = EXCLUDED.minutes,
        next_fixture_fdr = EXCLUDED.next_fixture_fdr
    `;
  }

  async upsertMany(players: readonly DbPlayer[]): Promise<void> {
    if (players.length === 0) return;
    const values = players.map((p) => ({
      id: p.id,
      web_name: p.web_name,
      team_id: p.team_id,
      position: p.position,
      now_cost: p.now_cost,
      total_points: p.total_points,
      updated_at: p.updated_at,
      status: p.status,
      chance_of_playing_next_round: p.chance_of_playing_next_round ?? null,
      news: p.news,
      influence: p.influence,
      creativity: p.creativity,
      threat: p.threat,
      minutes: p.minutes,
      next_fixture_fdr: p.next_fixture_fdr,
    }));
    await this.sql`
      INSERT INTO players ${this.sql(values)}
      ON CONFLICT (id) DO UPDATE SET
        web_name = EXCLUDED.web_name,
        team_id = EXCLUDED.team_id,
        position = EXCLUDED.position,
        now_cost = EXCLUDED.now_cost,
        total_points = EXCLUDED.total_points,
        updated_at = EXCLUDED.updated_at,
        status = EXCLUDED.status,
        chance_of_playing_next_round = EXCLUDED.chance_of_playing_next_round,
        news = EXCLUDED.news,
        influence = EXCLUDED.influence,
        creativity = EXCLUDED.creativity,
        threat = EXCLUDED.threat,
        minutes = EXCLUDED.minutes,
        next_fixture_fdr = EXCLUDED.next_fixture_fdr
    `;
  }

  async findById(id: number): Promise<DbPlayer | undefined> {
    const rows = await this.sql<PlayerRow[]>`
      SELECT id, web_name, team_id, position, now_cost, total_points, updated_at, status,
             chance_of_playing_next_round, news, influence, creativity, threat, minutes, next_fixture_fdr
      FROM players WHERE id = ${id}
    `;
    const row = rows[0];
    return row ? rowToPlayer(row) : undefined;
  }

  async listAll(): Promise<readonly DbPlayer[]> {
    const rows = await this.sql<PlayerRow[]>`
      SELECT id, web_name, team_id, position, now_cost, total_points, updated_at, status,
             chance_of_playing_next_round, news, influence, creativity, threat, minutes, next_fixture_fdr
      FROM players ORDER BY id
    `;
    return rows.map(rowToPlayer);
  }
}
