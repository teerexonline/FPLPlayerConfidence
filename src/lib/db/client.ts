import Database from 'better-sqlite3';
import { SQL_SCHEMA, SQL_MIGRATIONS } from './schema';

/**
 * Opens (or creates) the SQLite database at `path`, enables WAL mode and
 * foreign-key enforcement, applies the base schema, then runs each incremental
 * migration. Returns the open database instance; the caller owns its lifetime
 * and must call `.close()` when done.
 */
export function createDb(path: string): Database.Database {
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SQL_SCHEMA);
  for (const migration of SQL_MIGRATIONS) {
    // ALTER TABLE ADD COLUMN fails if the column already exists in older SQLite
    // builds. We swallow that specific error so the migration remains idempotent.
    try {
      db.exec(migration);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('duplicate column name')) throw err;
    }
  }
  return db;
}
