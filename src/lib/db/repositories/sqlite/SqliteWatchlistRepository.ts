import type Database from 'better-sqlite3';
import type { WatchlistRepository } from '../WatchlistRepository';

interface WatchlistRow {
  player_id: number;
}

interface ContainsRow {
  cnt: number;
}

export class SqliteWatchlistRepository implements WatchlistRepository {
  private readonly stmtFindByUser: Database.Statement<[number], WatchlistRow>;
  private readonly stmtAdd: Database.Statement<[number, number, number]>;
  private readonly stmtRemove: Database.Statement<[number, number]>;
  private readonly stmtContains: Database.Statement<[number, number], ContainsRow>;

  constructor(db: Database.Database) {
    this.stmtFindByUser = db.prepare<[number], WatchlistRow>(
      'SELECT player_id FROM watchlist WHERE user_id = ? ORDER BY added_at DESC',
    );
    this.stmtAdd = db.prepare<[number, number, number]>(
      'INSERT OR IGNORE INTO watchlist (user_id, player_id, added_at) VALUES (?, ?, ?)',
    );
    this.stmtRemove = db.prepare<[number, number]>(
      'DELETE FROM watchlist WHERE user_id = ? AND player_id = ?',
    );
    this.stmtContains = db.prepare<[number, number], ContainsRow>(
      'SELECT COUNT(*) as cnt FROM watchlist WHERE user_id = ? AND player_id = ?',
    );
  }

  findByUser(userId: number): Promise<readonly number[]> {
    return Promise.resolve(this.stmtFindByUser.all(userId).map((r) => r.player_id));
  }

  add(userId: number, playerId: number): Promise<void> {
    this.stmtAdd.run(userId, playerId, Math.floor(Date.now() / 1000));
    return Promise.resolve();
  }

  remove(userId: number, playerId: number): Promise<void> {
    this.stmtRemove.run(userId, playerId);
    return Promise.resolve();
  }

  contains(userId: number, playerId: number): Promise<boolean> {
    const row = this.stmtContains.get(userId, playerId);
    return Promise.resolve((row?.cnt ?? 0) > 0);
  }

  // Auth-user methods are no-ops in SQLite mode: local dev has no Supabase auth
  // and the auth_user_id column is not present in the SQLite schema.
  findByAuthUser(_authUserId: string): Promise<readonly number[]> {
    return Promise.resolve([]);
  }

  addForAuthUser(_authUserId: string, _playerId: number): Promise<void> {
    return Promise.resolve();
  }

  removeForAuthUser(_authUserId: string, _playerId: number): Promise<void> {
    return Promise.resolve();
  }
}
