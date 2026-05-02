import type Database from 'better-sqlite3';
import type { DbFixture } from '../../types';
import type { FixtureRepository } from '../FixtureRepository';

interface FixtureRow {
  fixture_id: number;
  gameweek: number;
  team_id: number;
  opponent_team_id: number;
  is_home: number; // 0 | 1
  fdr: number;
  finished: number; // 0 | 1
  kickoff_time: string | null;
}

const SELECT_COLS =
  'fixture_id, gameweek, team_id, opponent_team_id, is_home, fdr, finished, kickoff_time';

function rowToFixture(row: FixtureRow): DbFixture {
  return {
    fixture_id: row.fixture_id,
    gameweek: row.gameweek,
    team_id: row.team_id,
    opponent_team_id: row.opponent_team_id,
    is_home: row.is_home !== 0,
    fdr: row.fdr,
    finished: row.finished !== 0,
    kickoff_time: row.kickoff_time,
  };
}

export class SqliteFixtureRepository implements FixtureRepository {
  private readonly stmtUpsert: Database.Statement<
    [number, number, number, number, number, number, number, string | null]
  >;
  private readonly stmtListForTeamInRange: Database.Statement<[number, number, number], FixtureRow>;
  private readonly stmtListForGameweek: Database.Statement<[number], FixtureRow>;
  private readonly stmtListInGameweekRange: Database.Statement<[number, number], FixtureRow>;
  private readonly stmtLatestGameweek: Database.Statement<[], { max_gw: number | null }>;
  private readonly stmtDeleteAll: Database.Statement<[]>;

  constructor(private readonly db: Database.Database) {
    this.stmtUpsert = db.prepare(
      `INSERT OR REPLACE INTO fixtures
       (fixture_id, gameweek, team_id, opponent_team_id, is_home, fdr, finished, kickoff_time)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    this.stmtListForTeamInRange = db.prepare<[number, number, number], FixtureRow>(
      `SELECT ${SELECT_COLS} FROM fixtures
       WHERE team_id = ? AND gameweek BETWEEN ? AND ?
       ORDER BY gameweek ASC,
                CASE WHEN kickoff_time IS NULL THEN 1 ELSE 0 END ASC,
                kickoff_time ASC`,
    );
    this.stmtListForGameweek = db.prepare<[number], FixtureRow>(
      `SELECT ${SELECT_COLS} FROM fixtures
       WHERE gameweek = ?
       ORDER BY team_id ASC`,
    );
    this.stmtListInGameweekRange = db.prepare<[number, number], FixtureRow>(
      `SELECT ${SELECT_COLS} FROM fixtures
       WHERE gameweek BETWEEN ? AND ?
       ORDER BY gameweek ASC,
                CASE WHEN kickoff_time IS NULL THEN 1 ELSE 0 END ASC,
                kickoff_time ASC`,
    );
    this.stmtLatestGameweek = db.prepare<[], { max_gw: number | null }>(
      'SELECT MAX(gameweek) AS max_gw FROM fixtures',
    );
    this.stmtDeleteAll = db.prepare('DELETE FROM fixtures');
  }

  upsertMany(fixtures: readonly DbFixture[]): Promise<void> {
    const tx = this.db.transaction(() => {
      for (const f of fixtures) {
        this.stmtUpsert.run(
          f.fixture_id,
          f.gameweek,
          f.team_id,
          f.opponent_team_id,
          f.is_home ? 1 : 0,
          f.fdr,
          f.finished ? 1 : 0,
          f.kickoff_time,
        );
      }
    });
    tx();
    return Promise.resolve();
  }

  listForTeamInRange(
    teamId: number,
    fromGameweek: number,
    toGameweek: number,
  ): Promise<readonly DbFixture[]> {
    return Promise.resolve(
      this.stmtListForTeamInRange.all(teamId, fromGameweek, toGameweek).map(rowToFixture),
    );
  }

  listForGameweek(gameweek: number): Promise<readonly DbFixture[]> {
    return Promise.resolve(this.stmtListForGameweek.all(gameweek).map(rowToFixture));
  }

  listInGameweekRange(fromGameweek: number, toGameweek: number): Promise<readonly DbFixture[]> {
    return Promise.resolve(
      this.stmtListInGameweekRange.all(fromGameweek, toGameweek).map(rowToFixture),
    );
  }

  latestGameweek(): Promise<number | null> {
    const row = this.stmtLatestGameweek.get();
    return Promise.resolve(row?.max_gw ?? null);
  }

  deleteAll(): Promise<void> {
    this.stmtDeleteAll.run();
    return Promise.resolve();
  }
}
