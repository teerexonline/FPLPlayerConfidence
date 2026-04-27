/**
 * Incremental migrations applied after the base schema.
 * Each statement is idempotent: ALTER TABLE … ADD COLUMN is a no-op if
 * the column already exists in SQLite ≥ 3.37 (better-sqlite3 bundles ≥ 3.43).
 * If the bundled version is older we rely on the try/catch in createDb().
 *
 * ORDER MATTERS — do not reorder existing entries.
 */
export const SQL_MIGRATIONS: readonly string[] = [
  `ALTER TABLE players ADD COLUMN status TEXT NOT NULL DEFAULT 'a'`,
  `ALTER TABLE players ADD COLUMN chance_of_playing_next_round INTEGER`,
  `ALTER TABLE players ADD COLUMN news TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE confidence_snapshots ADD COLUMN defcon_counter INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE confidence_snapshots ADD COLUMN savecon_counter INTEGER NOT NULL DEFAULT 0`,
  // Phase 1 multi-user infrastructure: seed the system user and add ownership
  // column to manager_squads so every squad pick is owned by a specific user.
  // INSERT OR IGNORE is idempotent — re-running on an existing DB is safe.
  `INSERT OR IGNORE INTO users (id, email, created_at) VALUES (1, 'system@fpltool.internal', unixepoch())`,
  `ALTER TABLE manager_squads ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1`,
  // v2.0: probability calculator inputs — season-total ICT stats per player
  `ALTER TABLE players ADD COLUMN influence REAL NOT NULL DEFAULT 0`,
  `ALTER TABLE players ADD COLUMN creativity REAL NOT NULL DEFAULT 0`,
  `ALTER TABLE players ADD COLUMN threat REAL NOT NULL DEFAULT 0`,
  `ALTER TABLE players ADD COLUMN minutes INTEGER NOT NULL DEFAULT 0`,
  // Difficulty of the player's next scheduled fixture (1–5). 3 = neutral fallback.
  `ALTER TABLE players ADD COLUMN next_fixture_fdr INTEGER NOT NULL DEFAULT 3`,
];

export const SQL_SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id         INTEGER PRIMARY KEY,
  email      TEXT    NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS players (
  id           INTEGER PRIMARY KEY,
  web_name     TEXT    NOT NULL,
  team_id      INTEGER NOT NULL,
  position     TEXT    NOT NULL CHECK(position IN ('GK','DEF','MID','FWD')),
  now_cost     INTEGER NOT NULL,
  total_points INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS teams (
  id         INTEGER PRIMARY KEY,
  code       INTEGER NOT NULL,
  name       TEXT    NOT NULL,
  short_name TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS confidence_snapshots (
  player_id        INTEGER NOT NULL,
  gameweek         INTEGER NOT NULL,
  confidence_after INTEGER NOT NULL,
  delta            INTEGER NOT NULL,
  reason           TEXT    NOT NULL,
  fatigue_applied  INTEGER NOT NULL DEFAULT 0,
  motm_counter     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (player_id, gameweek)
);

CREATE INDEX IF NOT EXISTS idx_confidence_player ON confidence_snapshots(player_id);
CREATE INDEX IF NOT EXISTS idx_confidence_gw     ON confidence_snapshots(gameweek);

CREATE TABLE IF NOT EXISTS sync_meta (
  key        TEXT    PRIMARY KEY,
  value      TEXT    NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS manager_squads (
  team_id         INTEGER NOT NULL,
  gameweek        INTEGER NOT NULL,
  player_id       INTEGER NOT NULL,
  squad_position  INTEGER NOT NULL,
  is_captain      INTEGER NOT NULL DEFAULT 0,
  is_vice_captain INTEGER NOT NULL DEFAULT 0,
  fetched_at      INTEGER NOT NULL,
  PRIMARY KEY (team_id, gameweek, squad_position)
);
`;
