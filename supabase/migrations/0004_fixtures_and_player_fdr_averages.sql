-- Migration 0004: forward-projection inputs for the My Team transfer planner.
--
-- See docs/ALGORITHM.md §12 (expected-points / xP).
--
-- Two tables:
--   `fixtures`             — per-team fixture mirror; one row per (fixture_id, team_id)
--                            so the FDR field stores that team's perspective.
--   `player_fdr_averages`  — per-player average FPL points-per-appearance bucketed by
--                            fixture difficulty (LOW={1,2}, MID={3}, HIGH={4,5}).
-- Both are sync-owned: read by user-facing code only.

CREATE TABLE IF NOT EXISTS fixtures (
  fixture_id        INTEGER NOT NULL,
  gameweek          INTEGER NOT NULL,
  team_id           INTEGER NOT NULL,
  opponent_team_id  INTEGER NOT NULL,
  is_home           BOOLEAN NOT NULL,
  fdr               INTEGER NOT NULL CHECK (fdr BETWEEN 1 AND 5),
  finished          BOOLEAN NOT NULL DEFAULT FALSE,
  kickoff_time      TEXT,
  PRIMARY KEY (fixture_id, team_id)
);

CREATE INDEX IF NOT EXISTS idx_fixtures_team_gw ON fixtures (team_id, gameweek);
CREATE INDEX IF NOT EXISTS idx_fixtures_gw     ON fixtures (gameweek);

CREATE TABLE IF NOT EXISTS player_fdr_averages (
  player_id     INTEGER NOT NULL,
  bucket        TEXT    NOT NULL CHECK (bucket IN ('LOW', 'MID', 'HIGH')),
  avg_points    DOUBLE PRECISION NOT NULL,
  sample_count  INTEGER NOT NULL,
  updated_at    BIGINT  NOT NULL,
  PRIMARY KEY (player_id, bucket)
);

-- These tables are sync-populated and globally readable by all clients;
-- there is no per-user data, so RLS is not required. They are not exposed
-- via PostgREST (server reads only via service role).
