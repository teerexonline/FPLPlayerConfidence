import type Database from 'better-sqlite3';
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

export class SqliteTeamRepository implements TeamRepository {
  private readonly stmtFindById: Database.Statement<[number], TeamRow>;
  private readonly stmtListAll: Database.Statement<[], TeamRow>;
  private readonly stmtUpsert: Database.Statement<[number, number, string, string]>;

  constructor(private readonly db: Database.Database) {
    this.stmtFindById = db.prepare<[number], TeamRow>(
      'SELECT id, code, name, short_name FROM teams WHERE id = ?',
    );
    this.stmtListAll = db.prepare<[], TeamRow>(
      'SELECT id, code, name, short_name FROM teams ORDER BY id',
    );
    this.stmtUpsert = db.prepare(
      'INSERT OR REPLACE INTO teams (id, code, name, short_name) VALUES (?, ?, ?, ?)',
    );
  }

  upsert(team: DbTeam): Promise<void> {
    this.stmtUpsert.run(team.id, team.code, team.name, team.short_name);
    return Promise.resolve();
  }

  upsertMany(teams: readonly DbTeam[]): Promise<void> {
    const tx = this.db.transaction(() => {
      for (const t of teams) {
        this.stmtUpsert.run(t.id, t.code, t.name, t.short_name);
      }
    });
    tx();
    return Promise.resolve();
  }

  findById(id: number): Promise<DbTeam | undefined> {
    const row = this.stmtFindById.get(id);
    return Promise.resolve(row ? rowToTeam(row) : undefined);
  }

  listAll(): Promise<readonly DbTeam[]> {
    return Promise.resolve(this.stmtListAll.all().map(rowToTeam));
  }
}
