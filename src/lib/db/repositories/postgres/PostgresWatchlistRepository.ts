import type postgres from 'postgres';
import type { WatchlistRepository } from '../WatchlistRepository';

interface WatchlistRow {
  player_id: number;
}

interface CountRow {
  cnt: string;
}

export class PostgresWatchlistRepository implements WatchlistRepository {
  constructor(private readonly sql: postgres.Sql) {}

  async findByUser(userId: number): Promise<readonly number[]> {
    const rows = await this.sql<WatchlistRow[]>`
      SELECT player_id FROM watchlist
      WHERE user_id = ${userId}
      ORDER BY added_at DESC
    `;
    return rows.map((r) => r.player_id);
  }

  async add(userId: number, playerId: number): Promise<void> {
    await this.sql`
      INSERT INTO watchlist (user_id, player_id, added_at)
      VALUES (${userId}, ${playerId}, ${Math.floor(Date.now() / 1000)})
      ON CONFLICT (user_id, player_id) DO NOTHING
    `;
  }

  async remove(userId: number, playerId: number): Promise<void> {
    await this.sql`
      DELETE FROM watchlist WHERE user_id = ${userId} AND player_id = ${playerId}
    `;
  }

  async contains(userId: number, playerId: number): Promise<boolean> {
    const rows = await this.sql<CountRow[]>`
      SELECT COUNT(*) AS cnt FROM watchlist
      WHERE user_id = ${userId} AND player_id = ${playerId}
    `;
    return Number(rows[0]?.cnt ?? 0) > 0;
  }
}
