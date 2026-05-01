-- FPL Player Confidence — full Postgres schema
-- Equivalent to the SQLite base schema + all 12 migration steps applied in order.
-- Apply once against a fresh Supabase project via the SQL editor or psql.

-- ── users ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id         SERIAL PRIMARY KEY,
  email      TEXT    NOT NULL UNIQUE,
  created_at BIGINT  NOT NULL
);

-- Seed the single system user that owns all manager_squads entries.
INSERT INTO users (id, email, created_at)
VALUES (1, 'system@fpltool.internal', EXTRACT(EPOCH FROM NOW())::BIGINT)
ON CONFLICT (id) DO NOTHING;

-- Keep the auto-increment sequence above the seeded id so future INSERTs
-- without an explicit id don't collide.
SELECT setval(pg_get_serial_sequence('users', 'id'), GREATEST(1, (SELECT MAX(id) FROM users)));

-- ── players ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS players (
  id                         INTEGER PRIMARY KEY,
  web_name                   TEXT    NOT NULL,
  team_id                    INTEGER NOT NULL,
  position                   TEXT    NOT NULL CHECK (position IN ('GK', 'DEF', 'MID', 'FWD')),
  now_cost                   INTEGER NOT NULL,
  total_points               INTEGER NOT NULL,
  updated_at                 BIGINT  NOT NULL,
  -- migration cols (always present in Postgres schema)
  status                     TEXT    NOT NULL DEFAULT 'a',
  chance_of_playing_next_round INTEGER,
  news                       TEXT    NOT NULL DEFAULT '',
  influence                  REAL    NOT NULL DEFAULT 0,
  creativity                 REAL    NOT NULL DEFAULT 0,
  threat                     REAL    NOT NULL DEFAULT 0,
  minutes                    INTEGER NOT NULL DEFAULT 0,
  next_fixture_fdr           INTEGER NOT NULL DEFAULT 3
);

-- ── teams ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS teams (
  id         INTEGER PRIMARY KEY,
  code       INTEGER NOT NULL,
  name       TEXT    NOT NULL,
  short_name TEXT    NOT NULL
);

-- ── confidence_snapshots ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS confidence_snapshots (
  player_id        INTEGER NOT NULL,
  gameweek         INTEGER NOT NULL,
  confidence_after INTEGER NOT NULL,
  delta            INTEGER NOT NULL,
  reason           TEXT    NOT NULL,
  fatigue_applied  BOOLEAN NOT NULL DEFAULT FALSE,
  motm_counter     INTEGER NOT NULL DEFAULT 0,
  -- migration cols
  defcon_counter   INTEGER NOT NULL DEFAULT 0,
  savecon_counter  INTEGER NOT NULL DEFAULT 0,
  raw_delta        INTEGER NOT NULL DEFAULT 0,
  event_magnitude  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (player_id, gameweek)
);

CREATE INDEX IF NOT EXISTS idx_confidence_player ON confidence_snapshots (player_id);
CREATE INDEX IF NOT EXISTS idx_confidence_gw     ON confidence_snapshots (gameweek);

-- ── sync_meta ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sync_meta (
  key        TEXT   PRIMARY KEY,
  value      TEXT   NOT NULL,
  updated_at BIGINT NOT NULL
);

-- ── manager_squads ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS manager_squads (
  team_id         INTEGER NOT NULL,
  gameweek        INTEGER NOT NULL,
  player_id       INTEGER NOT NULL,
  squad_position  INTEGER NOT NULL,
  is_captain      BOOLEAN NOT NULL DEFAULT FALSE,
  is_vice_captain BOOLEAN NOT NULL DEFAULT FALSE,
  fetched_at      BIGINT  NOT NULL,
  user_id         INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (team_id, gameweek, squad_position)
);

-- ── watchlist ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS watchlist (
  user_id   INTEGER NOT NULL,
  player_id INTEGER NOT NULL,
  added_at  BIGINT  NOT NULL,
  PRIMARY KEY (user_id, player_id)
);
