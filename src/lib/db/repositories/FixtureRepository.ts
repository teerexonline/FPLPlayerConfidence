import type { DbFixture } from '../types';

export interface FixtureRepository {
  /**
   * Inserts or replaces all fixtures for a list of (fixture_id, team_id) pairs
   * in a single transaction. Idempotent — safe to call on every sync.
   */
  upsertMany(fixtures: readonly DbFixture[]): Promise<void>;

  /**
   * Returns all fixtures for a given team across the gameweek window
   * `[fromGameweek, toGameweek]` inclusive, ordered by `gameweek ASC`,
   * then `kickoff_time ASC` (NULLs last).
   */
  listForTeamInRange(
    teamId: number,
    fromGameweek: number,
    toGameweek: number,
  ): Promise<readonly DbFixture[]>;

  /**
   * Returns all fixtures for a given gameweek across all teams. Used by the
   * forward-projection paths to render xP for every starter without N+1 reads.
   */
  listForGameweek(gameweek: number): Promise<readonly DbFixture[]>;

  /**
   * Returns all fixtures for a gameweek window across all teams, ordered by
   * `gameweek ASC, kickoff_time ASC NULLS LAST`. Used to compute the next-N
   * upcoming fixtures for every team in a squad in a single query.
   */
  listInGameweekRange(fromGameweek: number, toGameweek: number): Promise<readonly DbFixture[]>;

  /**
   * Returns the latest gameweek number that has at least one stored fixture.
   * Used by the My Team scrubber to cap the forward range of the timeline.
   * Returns `null` if the table is empty.
   */
  latestGameweek(): Promise<number | null>;

  /**
   * Deletes every row in the table. Used by the sync pipeline before upserting
   * a freshly fetched season-wide fixture list, so removed/postponed fixtures
   * do not stick around.
   */
  deleteAll(): Promise<void>;
}
