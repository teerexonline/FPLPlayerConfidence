import type postgres from 'postgres';
import type { DbManagerSquadPick } from '../../types';
import type { ManagerSquadRepository } from '../ManagerSquadRepository';

interface ManagerSquadRow {
  team_id: number;
  gameweek: number;
  player_id: number;
  squad_position: number;
  is_captain: boolean;
  is_vice_captain: boolean;
  fetched_at: string;
}

interface MaxGameweekRow {
  max_gw: string | null;
}

interface GameweekRow {
  gameweek: number;
}

function rowToPick(row: ManagerSquadRow): DbManagerSquadPick {
  return {
    team_id: row.team_id,
    gameweek: row.gameweek,
    player_id: row.player_id,
    squad_position: row.squad_position,
    is_captain: row.is_captain,
    is_vice_captain: row.is_vice_captain,
    fetched_at: Number(row.fetched_at),
  };
}

const SELECT_COLS =
  'team_id, gameweek, player_id, squad_position, is_captain, is_vice_captain, fetched_at' as const;

export class PostgresManagerSquadRepository implements ManagerSquadRepository {
  constructor(private readonly sql: postgres.Sql) {}

  async upsertMany(picks: readonly DbManagerSquadPick[]): Promise<void> {
    if (picks.length === 0) return;
    const values = picks.map((p) => ({
      team_id: p.team_id,
      gameweek: p.gameweek,
      player_id: p.player_id,
      squad_position: p.squad_position,
      is_captain: p.is_captain,
      is_vice_captain: p.is_vice_captain,
      fetched_at: p.fetched_at,
    }));
    // user_id omitted — DB DEFAULT (1) applies. sql(values) derives the column
    // list from object keys, so user_id is not included in the INSERT.
    await this.sql`
      INSERT INTO manager_squads ${this.sql(values)}
      ON CONFLICT (team_id, gameweek, squad_position) DO UPDATE SET
        player_id       = EXCLUDED.player_id,
        is_captain      = EXCLUDED.is_captain,
        is_vice_captain = EXCLUDED.is_vice_captain,
        fetched_at      = EXCLUDED.fetched_at
    `;
  }

  async listByTeamAndGameweek(
    teamId: number,
    gameweek: number,
  ): Promise<readonly DbManagerSquadPick[]> {
    const rows = await this.sql<ManagerSquadRow[]>`
      SELECT ${this.sql(SELECT_COLS.split(', '))} FROM manager_squads
      WHERE team_id = ${teamId} AND gameweek = ${gameweek}
      ORDER BY squad_position ASC
    `;
    return rows.map(rowToPick);
  }

  async latestGameweekForTeam(teamId: number): Promise<number | null> {
    const rows = await this.sql<MaxGameweekRow[]>`
      SELECT MAX(gameweek) AS max_gw FROM manager_squads
      WHERE team_id = ${teamId}
    `;
    const val = rows[0]?.max_gw;
    return val !== null && val !== undefined ? Number(val) : null;
  }

  async listGameweeksForTeam(teamId: number): Promise<readonly number[]> {
    const rows = await this.sql<GameweekRow[]>`
      SELECT DISTINCT gameweek FROM manager_squads
      WHERE team_id = ${teamId}
      ORDER BY gameweek ASC
    `;
    return rows.map((r) => r.gameweek);
  }
}
