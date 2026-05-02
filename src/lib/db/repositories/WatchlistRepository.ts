export interface WatchlistRepository {
  /** Returns all watchlisted player IDs for the given legacy integer user. */
  findByUser(userId: number): Promise<readonly number[]>;

  /** Adds a player to the user's watchlist. No-op if already present. */
  add(userId: number, playerId: number): Promise<void>;

  /** Removes a player from the user's watchlist. No-op if not present. */
  remove(userId: number, playerId: number): Promise<void>;

  /** Returns true if the player is on the user's watchlist. */
  contains(userId: number, playerId: number): Promise<boolean>;

  // ── Auth-user methods (Phase 4) ──────────────────────────────────────────
  // These operate on the auth_user_id UUID column added in migration 0002.
  // SQLite mode stubs return empty / no-op since local dev has no Supabase auth.

  /** Returns all watchlisted player IDs for a Supabase auth user. */
  findByAuthUser(authUserId: string): Promise<readonly number[]>;

  /** Adds a player to a Supabase auth user's watchlist. No-op if already present. */
  addForAuthUser(authUserId: string, playerId: number): Promise<void>;

  /** Removes a player from a Supabase auth user's watchlist. No-op if not present. */
  removeForAuthUser(authUserId: string, playerId: number): Promise<void>;
}
