/**
 * Playwright global setup — seeds the SQLite DB with deterministic test data.
 * Runs once before any test and before the web server starts.
 *
 * Produces: 20 teams × 10 players = 200 players, with real FPL positions
 * distributed (2 GK, 5 DEF, 5 MID, 3 FWD per team). M. Salah is included
 * explicitly so the E2E search test can find him by name.
 */

import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import Database from 'better-sqlite3';

const DATA_DIR = join(process.cwd(), 'data');
const DB_PATH = process.env['DB_PATH']
  ? resolve(process.cwd(), process.env['DB_PATH'])
  : join(DATA_DIR, 'fpl.db');

const SQL_SCHEMA = `
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
CREATE TABLE IF NOT EXISTS sync_meta (
  key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS manager_squads (
  team_id INTEGER NOT NULL, gameweek INTEGER NOT NULL, player_id INTEGER NOT NULL,
  squad_position INTEGER NOT NULL, is_captain INTEGER NOT NULL DEFAULT 0,
  is_vice_captain INTEGER NOT NULL DEFAULT 0, fetched_at INTEGER NOT NULL,
  PRIMARY KEY (team_id, gameweek, squad_position)
);
CREATE INDEX IF NOT EXISTS idx_confidence_player ON confidence_snapshots(player_id);
CREATE INDEX IF NOT EXISTS idx_confidence_gw     ON confidence_snapshots(gameweek);
`;

const TEAMS = [
  { id: 1, code: 3, name: 'Arsenal', short_name: 'ARS' },
  { id: 2, code: 7, name: 'Aston Villa', short_name: 'AVL' },
  { id: 3, code: 36, name: 'Bournemouth', short_name: 'BOU' },
  { id: 4, code: 90, name: 'Brentford', short_name: 'BRE' },
  { id: 5, code: 8, name: 'Chelsea', short_name: 'CHE' },
  { id: 6, code: 31, name: 'Crystal Palace', short_name: 'CRY' },
  { id: 7, code: 11, name: 'Everton', short_name: 'EVE' },
  { id: 8, code: 54, name: 'Fulham', short_name: 'FUL' },
  { id: 9, code: 40, name: 'Ipswich', short_name: 'IPS' },
  { id: 10, code: 13, name: 'Leicester', short_name: 'LEI' },
  { id: 11, code: 14, name: 'Liverpool', short_name: 'LIV' },
  { id: 12, code: 43, name: 'Man City', short_name: 'MCI' },
  { id: 13, code: 1, name: 'Man Utd', short_name: 'MUN' },
  { id: 14, code: 4, name: 'Newcastle', short_name: 'NEW' },
  { id: 15, code: 45, name: "Nott'm Forest", short_name: 'NFO' },
  { id: 16, code: 110, name: 'Southampton', short_name: 'SOU' },
  { id: 17, code: 6, name: 'Tottenham', short_name: 'TOT' },
  { id: 18, code: 57, name: 'West Ham', short_name: 'WHU' },
  { id: 19, code: 39, name: 'Wolves', short_name: 'WOL' },
  { id: 20, code: 35, name: 'Brighton', short_name: 'BHA' },
] as const;

// Positions assigned round-robin to get a realistic distribution.
const POSITION_CYCLE: ('GK' | 'DEF' | 'MID' | 'FWD')[] = [
  'GK',
  'DEF',
  'DEF',
  'DEF',
  'DEF',
  'DEF',
  'MID',
  'MID',
  'MID',
  'FWD',
];

const PLAYER_NAMES = [
  'A. Anderson',
  'B. Baker',
  'C. Clark',
  'D. Davis',
  'E. Evans',
  'F. Foster',
  'G. Green',
  'H. Hall',
  'I. Ingram',
  'J. Johnson',
];

export default function globalSetup(): void {
  mkdirSync(dirname(DB_PATH), { recursive: true });

  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SQL_SCHEMA);

  // Clear existing data so tests are deterministic on re-runs.
  db.exec(
    'DELETE FROM confidence_snapshots; DELETE FROM players; DELETE FROM teams; DELETE FROM sync_meta;',
  );

  const upsertTeam = db.prepare(
    'INSERT OR REPLACE INTO teams (id, code, name, short_name) VALUES (?, ?, ?, ?)',
  );
  const upsertPlayer = db.prepare(
    'INSERT OR REPLACE INTO players (id, web_name, team_id, position, now_cost, total_points, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  );
  const upsertSnap = db.prepare(
    'INSERT OR REPLACE INTO confidence_snapshots (player_id, gameweek, confidence_after, delta, reason, fatigue_applied, motm_counter) VALUES (?, ?, ?, ?, ?, 0, 0)',
  );

  const now = Date.now();

  const seed = db.transaction(() => {
    for (const team of TEAMS) {
      upsertTeam.run(team.id, team.code, team.name, team.short_name);
    }

    let playerId = 1;
    for (const team of TEAMS) {
      for (let slot = 0; slot < 10; slot++) {
        const position = POSITION_CYCLE[slot];
        const playerName = PLAYER_NAMES[slot];
        if (position === undefined || playerName === undefined) continue;
        const nowCost = 50 + (playerId % 10) * 10;
        upsertPlayer.run(playerId, playerName, team.id, position, nowCost, 50, now);

        // 5 gameweeks of confidence history
        let conf = 0;
        for (let gw = 1; gw <= 5; gw++) {
          const delta = ((playerId + gw) % 5) - 2; // -2 to +2
          conf = Math.max(-5, Math.min(5, conf + delta));
          upsertSnap.run(playerId, gw, conf, delta, 'seed');
        }

        playerId++;
      }
    }

    // Gabriel at ID 5 — used by player-detail E2E tests.
    // Overrides the generic E. Evans seeded at ID 5 by the bulk loop.
    upsertPlayer.run(5, 'Gabriel', 1, 'DEF', 71, 120, now);
    const gabrielDeltas = [2, 1, -1, 1, -1, 2, 1, 0, 0, 0, 0, -1, -1, 2];
    let gabrielConf = 0;
    for (let i = 0; i < gabrielDeltas.length; i++) {
      const gw = i + 1;
      const delta = gabrielDeltas[i] ?? 0;
      gabrielConf = Math.max(-5, Math.min(5, gabrielConf + delta));
      const reason =
        delta > 0
          ? 'Clean sheet vs non-big team'
          : delta < 0
            ? 'Blank vs non-big team'
            : 'Clean sheet vs non-big team';
      upsertSnap.run(5, gw, gabrielConf, delta, reason);
    }

    // Explicit Salah entry so E2E search test can find him by name.
    const salahId = 9999;
    upsertPlayer.run(salahId, 'M. Salah', 11, 'MID', 130, 200, now);
    const salahDeltas = [2, 1, 2, 3, 2] as const;
    let salahConf = 0;
    for (let gw = 1; gw <= 5; gw++) {
      const delta = salahDeltas[gw - 1] ?? 2;
      salahConf = Math.min(5, salahConf + delta);
      upsertSnap.run(salahId, gw, salahConf, delta, 'seed');
    }

    // Set current_gameweek so the dashboard stale filter has a reference point.
    // Gabriel has snapshots up to GW14; all other seeded players top out at GW5.
    // With currentGW=14, only Gabriel (GW14) passes the >3 GW staleness filter on
    // the dashboard — making dashboard E2E expectations fully deterministic.
    const upsertMeta = db.prepare(
      'INSERT OR REPLACE INTO sync_meta (key, value, updated_at) VALUES (?, ?, ?)',
    );
    upsertMeta.run('current_gameweek', '14', now);
  });

  seed();
  db.close();
}
