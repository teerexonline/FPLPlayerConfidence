import type { DbConfidenceSnapshot, PlayerId } from '../types';

/**
 * Minimal snapshot data required to build per-match MatchBrief sequences for
 * DGW-aware hot streak computation. Returned by listRecentSnapshotsForAllPlayers.
 */
export interface SnapshotBrief {
  readonly gameweek: number;
  readonly delta: number;
  readonly rawDelta: number; // pre-fatigue clamped delta — passed to buildMatchBriefs
  readonly reason: string;
}

export interface ConfidenceSnapshotRepository {
  /** Inserts or replaces a single confidence snapshot. */
  upsert(snapshot: DbConfidenceSnapshot): void;

  /** Inserts or replaces multiple snapshots in a single transaction. */
  upsertMany(snapshots: readonly DbConfidenceSnapshot[]): void;

  /** Returns all snapshots for a player in gameweek order (ascending). */
  listByPlayer(playerId: PlayerId): readonly DbConfidenceSnapshot[];

  /**
   * Returns the snapshot with the highest gameweek number for a player —
   * the player's current confidence state.
   * Returns `undefined` if no snapshots exist for the player.
   */
  currentByPlayer(playerId: PlayerId): DbConfidenceSnapshot | undefined;

  /**
   * Returns the current snapshot (highest gameweek) for every player that
   * has at least one snapshot. Used by the players list page to load all
   * confidence values in a single query instead of N separate calls.
   */
  currentForAllPlayers(): readonly { playerId: PlayerId; snapshot: DbConfidenceSnapshot }[];

  /**
   * Returns the last ≤5 per-gameweek deltas for every player in a single
   * query (window function), oldest-first within each player. Avoids the
   * N+1 problem of calling listByPlayer() per player on the list page.
   */
  listLast5ForAllPlayers(): readonly { playerId: PlayerId; deltas: readonly number[] }[];

  /**
   * Returns all snapshots for a specific gameweek across all players.
   * Used by the historical GW scrubber to fetch confidence values at a point
   * in time without N separate `currentByPlayer` calls.
   */
  snapshotsAtGameweek(gameweek: number): readonly DbConfidenceSnapshot[];

  /**
   * Returns the most recent snapshot per player at or before `gameweek`.
   * This is the correct query for historical GW navigation: a player who
   * didn't play in GW N still carries the confidence from their last
   * appearance, so we return their most recent snapshot ≤ N rather than
   * requiring an exact-GW match (which would return 0 for skipped weeks
   * and corrupt the confidence display).
   */
  latestSnapshotsAtOrBeforeGameweek(gameweek: number): readonly DbConfidenceSnapshot[];

  /**
   * Returns a map of playerId → count of snapshots in gameweeks ≥ minGw.
   * Used to compute `recentAppearances` for the staleness indicator.
   * Players with no snapshots in that window are absent from the map (count = 0).
   */
  recentAppearancesForAllPlayers(minGw: number): ReadonlyMap<number, number>;

  /**
   * Returns a map of playerId → { boostGw, boostDelta } for the most recent boost
   * (delta ≥ 3) in [minGw, maxGw]. Players with no qualifying boost are absent.
   *
   * maxGw prevents returning future boosts when viewing a historical GW.
   */
  recentBoostForAllPlayers(
    minGw: number,
    maxGw: number,
  ): ReadonlyMap<number, { boostGw: number; boostDelta: number }>;

  /**
   * Returns a map of playerId → SnapshotBrief array (gameweek, delta, reason) for
   * all players with at least one snapshot in gameweeks ≥ minGw.
   *
   * Rows are ordered by gameweek ascending within each player, matching the order
   * required by buildMatchBriefs for correct matchOrder assignment.
   *
   * Used by the Dashboard and Players list live hot streak computation to replace
   * the GW-based recentBoostGameweekForAllPlayers path. Returning the reason field
   * lets buildMatchBriefs expand DGW snapshots into per-sub-match MatchBrief entries,
   * fixing the DGW streak bug without any SQL-side parsing.
   */
  listRecentSnapshotsForAllPlayers(minGw: number): ReadonlyMap<number, readonly SnapshotBrief[]>;

  /**
   * Deletes all snapshots for a player. Used by the Big Teams recompute
   * flow before re-running the confidence calculator with updated settings.
   */
  deleteByPlayer(playerId: PlayerId): void;
}
