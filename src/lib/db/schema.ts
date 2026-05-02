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
  // Watchlist: per-user player bookmarks. Phase 1 uses SYSTEM_USER_ID = 1.
  `CREATE TABLE IF NOT EXISTS watchlist (
    user_id    INTEGER NOT NULL,
    player_id  INTEGER NOT NULL,
    added_at   INTEGER NOT NULL,
    PRIMARY KEY (user_id, player_id)
  )`,
  // v1.7: pre-fatigue clamped delta — used for Hot Streak threshold and level so
  // fatigue events don't mask a qualifying boost or downgrade the flame color.
  `ALTER TABLE confidence_snapshots ADD COLUMN raw_delta INTEGER NOT NULL DEFAULT 0`,
  // v1.7.2: raw multiplier output before any clamp — used for streak trigger and level
  // so ceiling absorption cannot hide a hot boost (e.g. rawDelta=4 when raw=5 at ceiling).
  `ALTER TABLE confidence_snapshots ADD COLUMN event_magnitude INTEGER NOT NULL DEFAULT 0`,
  // Phase 4: watchlist auth identity. Nullable TEXT (no FK — SQLite has no auth.users).
  // Only populated in Postgres (production) via Supabase auth; SQLite auth stubs return [].
  `ALTER TABLE watchlist ADD COLUMN auth_user_id TEXT`,
  // v1.8: forward-projection inputs for the My Team transfer planner (xP, ALGORITHM.md §12).
  // `fixtures` mirrors FPL's fixtures endpoint, projected to a per-team perspective so
  //   each row carries the FDR seen by the players on that team for that fixture.
  // `player_fdr_averages` stores the per-player mean FPL points-per-appearance bucketed
  //   by fixture difficulty (LOW={1,2}, MID={3}, HIGH={4,5}) — populated by sync.
  `CREATE TABLE IF NOT EXISTS fixtures (
    fixture_id        INTEGER NOT NULL,
    gameweek          INTEGER NOT NULL,
    team_id           INTEGER NOT NULL,
    opponent_team_id  INTEGER NOT NULL,
    is_home           INTEGER NOT NULL,
    fdr               INTEGER NOT NULL,
    finished          INTEGER NOT NULL DEFAULT 0,
    kickoff_time      TEXT,
    PRIMARY KEY (fixture_id, team_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_fixtures_team_gw ON fixtures(team_id, gameweek)`,
  `CREATE INDEX IF NOT EXISTS idx_fixtures_gw     ON fixtures(gameweek)`,
  `CREATE TABLE IF NOT EXISTS player_fdr_averages (
    player_id     INTEGER NOT NULL,
    bucket        TEXT    NOT NULL CHECK(bucket IN ('LOW','MID','HIGH')),
    avg_points    REAL    NOT NULL,
    sample_count  INTEGER NOT NULL,
    updated_at    INTEGER NOT NULL,
    PRIMARY KEY (player_id, bucket)
  )`,
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
