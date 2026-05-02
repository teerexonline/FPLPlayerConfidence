import type Database from 'better-sqlite3';
import type { DbManagerSquadPick } from '../../types';
import type { ManagerSquadRepository } from '../ManagerSquadRepository';

interface ManagerSquadRow {
  team_id: number;
  gameweek: number;
  player_id: number;
  squad_position: number;
  is_captain: number; // stored as 0 | 1
  is_vice_captain: number; // stored as 0 | 1
  fetched_at: number;
}

interface MaxGameweekRow {
  max_gw: number | null;
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
    is_captain: row.is_captain !== 0,
    is_vice_captain: row.is_vice_captain !== 0,
    fetched_at: row.fetched_at,
  };
}

const SELECT_COLS =
  'team_id, gameweek, player_id, squad_position, is_captain, is_vice_captain, fetched_at';

export class SqliteManagerSquadRepository implements ManagerSquadRepository {
  private readonly stmtUpsert: Database.Statement<
    [number, number, number, number, number, number, number]
  >;
  private readonly stmtListByTeamAndGw: Database.Statement<[number, number], ManagerSquadRow>;
  private readonly stmtLatestGameweek: Database.Statement<[number], MaxGameweekRow>;
  private readonly stmtListGameweeks: Database.Statement<[number], GameweekRow>;

  constructor(private readonly db: Database.Database) {
    // user_id hardcoded to 1 (vestigial column, NOT NULL DEFAULT 1 in schema).
    this.stmtUpsert = db.prepare(
      `INSERT OR REPLACE INTO manager_squads
       (user_id, team_id, gameweek, player_id, squad_position, is_captain, is_vice_captain, fetched_at)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?)`,
    );
    this.stmtListByTeamAndGw = db.prepare<[number, number], ManagerSquadRow>(
      `SELECT ${SELECT_COLS} FROM manager_squads
       WHERE team_id = ? AND gameweek = ?
       ORDER BY squad_position ASC`,
    );
    this.stmtLatestGameweek = db.prepare<[number], MaxGameweekRow>(
      'SELECT MAX(gameweek) AS max_gw FROM manager_squads WHERE team_id = ?',
    );
    this.stmtListGameweeks = db.prepare<[number], GameweekRow>(
      'SELECT DISTINCT gameweek FROM manager_squads WHERE team_id = ? ORDER BY gameweek ASC',
    );
  }

  upsertMany(picks: readonly DbManagerSquadPick[]): Promise<void> {
    const tx = this.db.transaction(() => {
      for (const p of picks) {
        this.stmtUpsert.run(
          p.team_id,
          p.gameweek,
          p.player_id,
          p.squad_position,
          p.is_captain ? 1 : 0,
          p.is_vice_captain ? 1 : 0,
          p.fetched_at,
        );
      }
    });
    tx();
    return Promise.resolve();
  }

  listByTeamAndGameweek(teamId: number, gameweek: number): Promise<readonly DbManagerSquadPick[]> {
    return Promise.resolve(this.stmtListByTeamAndGw.all(teamId, gameweek).map(rowToPick));
  }

  latestGameweekForTeam(teamId: number): Promise<number | null> {
    const row = this.stmtLatestGameweek.get(teamId);
    return Promise.resolve(row?.max_gw ?? null);
  }

  listGameweeksForTeam(teamId: number): Promise<readonly number[]> {
    return Promise.resolve(this.stmtListGameweeks.all(teamId).map((r) => r.gameweek));
  }
}
