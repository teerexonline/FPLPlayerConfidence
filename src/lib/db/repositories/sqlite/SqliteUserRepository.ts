import type Database from 'better-sqlite3';
import type { DbUser } from '../../types';
import type { UserRepository } from '../UserRepository';

interface UserRow {
  id: number;
  email: string;
  created_at: number;
}

function rowToUser(row: UserRow): DbUser {
  return { id: row.id, email: row.email, created_at: row.created_at };
}

export class SqliteUserRepository implements UserRepository {
  private readonly stmtFindById: Database.Statement<[number], UserRow>;
  private readonly stmtListAll: Database.Statement<[], UserRow>;

  constructor(db: Database.Database) {
    this.stmtFindById = db.prepare<[number], UserRow>(
      'SELECT id, email, created_at FROM users WHERE id = ?',
    );
    this.stmtListAll = db.prepare<[], UserRow>(
      'SELECT id, email, created_at FROM users ORDER BY id ASC',
    );
  }

  findById(id: number): DbUser | null {
    const row = this.stmtFindById.get(id);
    return row !== undefined ? rowToUser(row) : null;
  }

  listAll(): readonly DbUser[] {
    return this.stmtListAll.all().map(rowToUser);
  }
}
