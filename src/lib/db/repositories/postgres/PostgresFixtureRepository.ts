import type postgres from 'postgres';
import type { DbFixture } from '../../types';
import type { FixtureRepository } from '../FixtureRepository';

interface FixtureRow {
  fixture_id: number;
  gameweek: number;
  team_id: number;
  opponent_team_id: number;
  is_home: boolean;
  fdr: number;
  finished: boolean;
  kickoff_time: string | null;
}

const SELECT_COLS = [
  'fixture_id',
  'gameweek',
  'team_id',
  'opponent_team_id',
  'is_home',
  'fdr',
  'finished',
  'kickoff_time',
] as const;

function rowToFixture(row: FixtureRow): DbFixture {
  return {
    fixture_id: row.fixture_id,
    gameweek: row.gameweek,
    team_id: row.team_id,
    opponent_team_id: row.opponent_team_id,
    is_home: row.is_home,
    fdr: row.fdr,
    finished: row.finished,
    kickoff_time: row.kickoff_time,
  };
}

export class PostgresFixtureRepository implements FixtureRepository {
  constructor(private readonly sql: postgres.Sql) {}

  async upsertMany(fixtures: readonly DbFixture[]): Promise<void> {
    if (fixtures.length === 0) return;
    const values = fixtures.map((f) => ({
      fixture_id: f.fixture_id,
      gameweek: f.gameweek,
      team_id: f.team_id,
      opponent_team_id: f.opponent_team_id,
      is_home: f.is_home,
      fdr: f.fdr,
      finished: f.finished,
      kickoff_time: f.kickoff_time,
    }));
    await this.sql`
      INSERT INTO fixtures ${this.sql(values)}
      ON CONFLICT (fixture_id, team_id) DO UPDATE SET
        gameweek         = EXCLUDED.gameweek,
        opponent_team_id = EXCLUDED.opponent_team_id,
        is_home          = EXCLUDED.is_home,
        fdr              = EXCLUDED.fdr,
        finished         = EXCLUDED.finished,
        kickoff_time     = EXCLUDED.kickoff_time
    `;
  }

  async listForTeamInRange(
    teamId: number,
    fromGameweek: number,
    toGameweek: number,
  ): Promise<readonly DbFixture[]> {
    const rows = await this.sql<FixtureRow[]>`
      SELECT ${this.sql(SELECT_COLS)} FROM fixtures
      WHERE team_id = ${teamId} AND gameweek BETWEEN ${fromGameweek} AND ${toGameweek}
      ORDER BY gameweek ASC,
               (kickoff_time IS NULL) ASC,
               kickoff_time ASC
    `;
    return rows.map(rowToFixture);
  }

  async listForGameweek(gameweek: number): Promise<readonly DbFixture[]> {
    const rows = await this.sql<FixtureRow[]>`
      SELECT ${this.sql(SELECT_COLS)} FROM fixtures
      WHERE gameweek = ${gameweek}
      ORDER BY team_id ASC
    `;
    return rows.map(rowToFixture);
  }

  async listInGameweekRange(
    fromGameweek: number,
    toGameweek: number,
  ): Promise<readonly DbFixture[]> {
    const rows = await this.sql<FixtureRow[]>`
      SELECT ${this.sql(SELECT_COLS)} FROM fixtures
      WHERE gameweek BETWEEN ${fromGameweek} AND ${toGameweek}
      ORDER BY gameweek ASC,
               (kickoff_time IS NULL) ASC,
               kickoff_time ASC
    `;
    return rows.map(rowToFixture);
  }

  async latestGameweek(): Promise<number | null> {
    const rows = await this.sql<{ max_gw: number | null }[]>`
      SELECT MAX(gameweek) AS max_gw FROM fixtures
    `;
    return rows[0]?.max_gw ?? null;
  }

  async deleteAll(): Promise<void> {
    await this.sql`DELETE FROM fixtures`;
  }
}
