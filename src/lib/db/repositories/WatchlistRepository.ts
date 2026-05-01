export interface WatchlistRepository {
  /** Returns all watchlisted player IDs for the given user. */
  findByUser(userId: number): Promise<readonly number[]>;

  /** Adds a player to the user's watchlist. No-op if already present. */
  add(userId: number, playerId: number): Promise<void>;

  /** Removes a player from the user's watchlist. No-op if not present. */
  remove(userId: number, playerId: number): Promise<void>;

  /** Returns true if the player is on the user's watchlist. */
  contains(userId: number, playerId: number): Promise<boolean>;
}
