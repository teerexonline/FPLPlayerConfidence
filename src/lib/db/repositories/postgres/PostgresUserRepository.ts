import type postgres from 'postgres';
import type { DbUser } from '../../types';
import type { UserRepository } from '../UserRepository';

interface UserRow {
  id: number;
  email: string;
  created_at: string;
}

function rowToUser(row: UserRow): DbUser {
  return { id: row.id, email: row.email, created_at: Number(row.created_at) };
}

export class PostgresUserRepository implements UserRepository {
  constructor(private readonly sql: postgres.Sql) {}

  async findById(id: number): Promise<DbUser | null> {
    const rows = await this.sql<UserRow[]>`
      SELECT id, email, created_at FROM users WHERE id = ${id}
    `;
    const row = rows[0];
    return row !== undefined ? rowToUser(row) : null;
  }

  async listAll(): Promise<readonly DbUser[]> {
    const rows = await this.sql<UserRow[]>`
      SELECT id, email, created_at FROM users ORDER BY id ASC
    `;
    return rows.map(rowToUser);
  }
}
