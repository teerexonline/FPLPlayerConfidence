import type postgres from 'postgres';
import type { DbTeam } from '../../types';
import type { TeamRepository } from '../TeamRepository';

interface TeamRow {
  id: number;
  code: number;
  name: string;
  short_name: string;
}

function rowToTeam(row: TeamRow): DbTeam {
  return { id: row.id, code: row.code, name: row.name, short_name: row.short_name };
}

export class PostgresTeamRepository implements TeamRepository {
  constructor(private readonly sql: postgres.Sql) {}

  async upsert(team: DbTeam): Promise<void> {
    await this.sql`
      INSERT INTO teams (id, code, name, short_name)
      VALUES (${team.id}, ${team.code}, ${team.name}, ${team.short_name})
      ON CONFLICT (id) DO UPDATE SET
        code = EXCLUDED.code,
        name = EXCLUDED.name,
        short_name = EXCLUDED.short_name
    `;
  }

  async upsertMany(teams: readonly DbTeam[]): Promise<void> {
    if (teams.length === 0) return;
    const values = teams.map((t) => ({
      id: t.id,
      code: t.code,
      name: t.name,
      short_name: t.short_name,
    }));
    await this.sql`
      INSERT INTO teams ${this.sql(values)}
      ON CONFLICT (id) DO UPDATE SET
        code = EXCLUDED.code,
        name = EXCLUDED.name,
        short_name = EXCLUDED.short_name
    `;
  }

  async findById(id: number): Promise<DbTeam | undefined> {
    const rows = await this.sql<TeamRow[]>`
      SELECT id, code, name, short_name FROM teams WHERE id = ${id}
    `;
    const row = rows[0];
    return row ? rowToTeam(row) : undefined;
  }

  async listAll(): Promise<readonly DbTeam[]> {
    const rows = await this.sql<TeamRow[]>`
      SELECT id, code, name, short_name FROM teams ORDER BY id
    `;
    return rows.map(rowToTeam);
  }
}
