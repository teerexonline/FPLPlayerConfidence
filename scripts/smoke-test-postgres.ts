/**
 * Postgres smoke test — verifies all 7 repository implementations against the
 * live Supabase database before any bulk data migration runs.
 *
 * Covers every dialect concern not exercised by the SQLite test suite:
 *   ① BigInt → Number conversion (BIGINT columns returned as strings by driver)
 *   ② Boolean round-trip (Postgres BOOLEAN ↔ JS boolean)
 *   ③ ON CONFLICT DO UPDATE — insert twice, verify field updated
 *   ④ ON CONFLICT DO NOTHING — idempotent insert (watchlist.add)
 *   ⑤ NULL handling — nullable column round-trip
 *   ⑥ SQL injection safety — values containing single quotes
 *
 * Teardown: every row inserted uses synthetic IDs (9_000_000+) so they cannot
 * collide with real FPL data. All rows are deleted at the end. If teardown
 * fails, cleanup SQL is printed to stdout.
 *
 * Run:
 *   npx tsx scripts/smoke-test-postgres.ts
 *
 * Requires DATABASE_URL in .env.local (or already set in the shell environment).
 */

// Load .env.local before the postgres connection is established.
// process.loadEnvFile is available in Node 20.12+ (we run Node 22).
if (!process.env['DATABASE_URL']) {
  try {
    process.loadEnvFile('.env.local');
  } catch {
    // Not found or not supported — let the URL check below catch it.
  }
}

import postgres from 'postgres';
import { PostgresPlayerRepository } from '@/lib/db/repositories/postgres/PostgresPlayerRepository';
import { PostgresTeamRepository } from '@/lib/db/repositories/postgres/PostgresTeamRepository';
import { PostgresConfidenceSnapshotRepository } from '@/lib/db/repositories/postgres/PostgresConfidenceSnapshotRepository';
import { PostgresSyncMetaRepository } from '@/lib/db/repositories/postgres/PostgresSyncMetaRepository';
import { PostgresManagerSquadRepository } from '@/lib/db/repositories/postgres/PostgresManagerSquadRepository';
import { PostgresUserRepository } from '@/lib/db/repositories/postgres/PostgresUserRepository';
import { PostgresWatchlistRepository } from '@/lib/db/repositories/postgres/PostgresWatchlistRepository';
import { playerId } from '@/lib/db/types';

// ── Constants ──────────────────────────────────────────────────────────────────

// Synthetic IDs far above any real FPL player/team IDs.
const TEST_TEAM_ID = 9_000_001;
const TEST_PLAYER_ID = 9_000_001;
const TEST_USER_ID = 1; // SYSTEM_USER_ID, already seeded by schema
const TEST_MANAGER_TEAM_ID = 9_000_999; // manager team (entry) id, not a players.team_id
const SMOKE_GW = 99;
const CLOCK = 1_700_000_000; // a known number we can assert survives BigInt conversion

// ── Test harness ───────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures: string[] = [];

function pass(label: string): void {
  console.log(`  ✓ ${label}`);
  passed++;
}

function fail(label: string, reason: string): void {
  console.log(`  ✗ ${label}`);
  console.log(`    ${reason}`);
  failed++;
  failures.push(`${label}: ${reason}`);
}

function assert(label: string, condition: boolean, detail = ''): void {
  if (condition) {
    pass(label);
  } else {
    fail(label, detail || 'assertion failed');
  }
}

function assertEqual<T>(label: string, actual: T, expected: T): void {
  const ok = actual === expected;
  if (ok) {
    pass(label);
  } else {
    fail(label, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

// ── Sections ───────────────────────────────────────────────────────────────────

async function smokeUsers(repo: PostgresUserRepository): Promise<void> {
  console.log('\n[users]');
  // No INSERT method exists — the system user is seeded by the schema.
  const user = await repo.findById(TEST_USER_ID);
  assert('findById(1) returns non-null', user !== null);
  assertEqual('id is 1', user?.id, 1);
  assertEqual('email matches seed', user?.email, 'system@fpltool.internal');
  // ① BigInt → Number: created_at is BIGINT, must come back as JS number not string
  assert(
    '① created_at is a JS number (not string)',
    typeof user?.created_at === 'number',
    `got ${typeof user?.created_at}`,
  );
  assert('created_at is finite', Number.isFinite(user?.created_at ?? NaN));
}

async function smokeTeams(repo: PostgresTeamRepository): Promise<void> {
  console.log('\n[teams]');
  const team = {
    id: TEST_TEAM_ID,
    code: 9001,
    name: "O'Brien FC", // ⑥ single quote in value
    short_name: 'OBR',
  };

  await repo.upsert(team);
  const found = await repo.findById(TEST_TEAM_ID);
  assert('upsert + findById returns row', found !== undefined);
  assertEqual('id round-trips', found?.id, TEST_TEAM_ID);
  // ⑥ SQL injection safety: single quote stored and retrieved correctly
  assertEqual('⑥ name with single quote round-trips', found?.name, "O'Brien FC");

  // ③ ON CONFLICT DO UPDATE — change the name, upsert again, verify update
  await repo.upsert({ ...team, name: 'Updated FC' });
  const updated = await repo.findById(TEST_TEAM_ID);
  assertEqual('③ ON CONFLICT DO UPDATE changes name', updated?.name, 'Updated FC');
}

async function smokePlayers(repo: PostgresPlayerRepository): Promise<void> {
  console.log('\n[players]');
  const player = {
    id: TEST_PLAYER_ID,
    web_name: "D'Arcy", // ⑥ single quote
    team_id: TEST_TEAM_ID, // FK to the test team we inserted above
    position: 'MID' as const,
    now_cost: 65,
    total_points: 120,
    updated_at: CLOCK, // ① BIGINT round-trip
    status: 'a',
    chance_of_playing_next_round: null, // ⑤ NULL
    news: '',
    influence: 12.5,
    creativity: 8.3,
    threat: 5.1,
    minutes: 900,
    next_fixture_fdr: 3,
  };

  await repo.upsert(player);
  const found = await repo.findById(TEST_PLAYER_ID);
  assert('upsert + findById returns row', found !== undefined);
  assertEqual('id round-trips', found?.id, TEST_PLAYER_ID);
  // ⑥ SQL injection
  assertEqual('⑥ web_name with single quote round-trips', found?.web_name, "D'Arcy");
  // ① BigInt → Number
  assertEqual('① updated_at round-trips as number', found?.updated_at, CLOCK);
  assert('① updated_at is JS number', typeof found?.updated_at === 'number');
  // ⑤ NULL
  assertEqual('⑤ chance_of_playing_next_round is null', found?.chance_of_playing_next_round, null);

  // ③ ON CONFLICT DO UPDATE
  await repo.upsert({ ...player, web_name: 'UpdatedName', total_points: 999 });
  const updated = await repo.findById(TEST_PLAYER_ID);
  assertEqual('③ ON CONFLICT DO UPDATE updates web_name', updated?.web_name, 'UpdatedName');
  assertEqual('③ ON CONFLICT DO UPDATE updates total_points', updated?.total_points, 999);
}

async function smokeSnapshots(repo: PostgresConfidenceSnapshotRepository): Promise<void> {
  console.log('\n[confidence_snapshots]');
  const snap = {
    player_id: TEST_PLAYER_ID,
    gameweek: SMOKE_GW,
    confidence_after: 3,
    delta: 2,
    raw_delta: 2,
    event_magnitude: 4,
    reason: "Salah's MOTM", // ⑥ single quote in reason
    fatigue_applied: true, // ② BOOLEAN true
    motm_counter: 1,
    defcon_counter: 0,
    savecon_counter: 0,
  };

  await repo.upsert(snap);
  const found = await repo.currentByPlayer(playerId(TEST_PLAYER_ID));
  assert('upsert + currentByPlayer returns row', found !== undefined);
  assertEqual('gameweek round-trips', found?.gameweek, SMOKE_GW);
  assertEqual('confidence_after round-trips', found?.confidence_after, 3);
  // ② Boolean
  assertEqual(
    '② fatigue_applied=true round-trips as JS boolean true',
    found?.fatigue_applied,
    true,
  );
  assert('② fatigue_applied is boolean type', typeof found?.fatigue_applied === 'boolean');
  // ⑥ Single quote in reason
  assertEqual('⑥ reason with single quote round-trips', found?.reason, "Salah's MOTM");

  // Test false boolean too
  const snapFalse = { ...snap, gameweek: SMOKE_GW + 1, fatigue_applied: false };
  await repo.upsert(snapFalse);
  const foundFalse = await repo.currentByPlayer(playerId(TEST_PLAYER_ID));
  assertEqual(
    '② fatigue_applied=false round-trips as JS boolean false',
    foundFalse?.fatigue_applied,
    false,
  );

  // ③ ON CONFLICT DO UPDATE — update SMOKE_GW row, then update SMOKE_GW+1 row
  await repo.upsert({ ...snap, confidence_after: 99, delta: 5 });
  await repo.upsert({ ...snapFalse, confidence_after: 77 });
  const updatedConflict = await repo.listByPlayer(playerId(TEST_PLAYER_ID));
  const gw100 = updatedConflict.find((s) => s.gameweek === SMOKE_GW + 1);
  assertEqual('③ ON CONFLICT DO UPDATE updates confidence_after', gw100?.confidence_after, 77);

  // DISTINCT ON: currentForAllPlayers returns latest per player
  const all = await repo.currentForAllPlayers();
  const mine = all.find((r) => r.playerId === TEST_PLAYER_ID);
  assert('currentForAllPlayers includes test player', mine !== undefined);
  // Latest GW for our player is SMOKE_GW+1=100 (confidence_after=77)
  assertEqual('DISTINCT ON returns latest GW (100)', mine?.snapshot.gameweek, SMOKE_GW + 1);
}

async function smokeSyncMeta(repo: PostgresSyncMetaRepository): Promise<void> {
  console.log('\n[sync_meta]');
  const key = 'smoke_test_key';

  await repo.set(key, 'hello', CLOCK);
  const val = await repo.get(key);
  assertEqual('set + get round-trips value', val, 'hello');
  // updated_at is a BIGINT column but get() only returns the value string; no Number conversion needed here

  // ③ ON CONFLICT DO UPDATE
  await repo.set(key, 'updated', CLOCK + 1);
  const updated = await repo.get(key);
  assertEqual('③ ON CONFLICT DO UPDATE updates value', updated, 'updated');

  // Non-existent key returns undefined
  assertEqual('missing key returns undefined', await repo.get('no_such_key_xyz'), undefined);

  // ⑥ Value with single quote
  await repo.set(key, "O'Brien's value", CLOCK + 2);
  assertEqual('⑥ value with single quote round-trips', await repo.get(key), "O'Brien's value");
}

async function smokeManagerSquads(repo: PostgresManagerSquadRepository): Promise<void> {
  console.log('\n[manager_squads]');

  const picks = [
    {
      team_id: TEST_MANAGER_TEAM_ID,
      gameweek: SMOKE_GW,
      player_id: TEST_PLAYER_ID,
      squad_position: 1,
      is_captain: true, // ② BOOLEAN
      is_vice_captain: false, // ② BOOLEAN
      fetched_at: CLOCK, // ① BIGINT
    },
    {
      team_id: TEST_MANAGER_TEAM_ID,
      gameweek: SMOKE_GW,
      player_id: TEST_PLAYER_ID,
      squad_position: 2,
      is_captain: false,
      is_vice_captain: true,
      fetched_at: CLOCK,
    },
  ];

  await repo.upsertMany(picks);
  const found = await repo.listByTeamAndGameweek(TEST_MANAGER_TEAM_ID, SMOKE_GW);
  assertEqual('listByTeamAndGameweek returns 2 picks', found.length, 2);

  const captain = found.find((p) => p.squad_position === 1);
  // ① BigInt → Number
  assertEqual('① fetched_at round-trips as number', captain?.fetched_at, CLOCK);
  assert('① fetched_at is JS number type', typeof captain?.fetched_at === 'number');
  // ② Boolean
  assertEqual('② is_captain=true round-trips as JS boolean', captain?.is_captain, true);
  assertEqual('② is_vice_captain=false round-trips as JS boolean', captain?.is_vice_captain, false);
  assert('② is_captain is boolean type', typeof captain?.is_captain === 'boolean');

  const vc = found.find((p) => p.squad_position === 2);
  assertEqual('② is_vice_captain=true round-trips as JS boolean', vc?.is_vice_captain, true);

  // ③ ON CONFLICT DO UPDATE — re-upsert with a different player_id
  const updated = picks.map((p) => ({
    ...p,
    player_id: TEST_PLAYER_ID + 1,
    fetched_at: CLOCK + 99,
  }));
  await repo.upsertMany(updated);
  const afterUpdate = await repo.listByTeamAndGameweek(TEST_MANAGER_TEAM_ID, SMOKE_GW);
  assertEqual('③ ON CONFLICT DO UPDATE: still 2 rows (not 4)', afterUpdate.length, 2);
  assertEqual(
    '③ ON CONFLICT DO UPDATE: player_id updated',
    afterUpdate[0]?.player_id,
    TEST_PLAYER_ID + 1,
  );
  assertEqual(
    '③ ON CONFLICT DO UPDATE: fetched_at updated',
    afterUpdate[0]?.fetched_at,
    CLOCK + 99,
  );

  // latestGameweekForTeam
  const latest = await repo.latestGameweekForTeam(TEST_MANAGER_TEAM_ID);
  assertEqual('latestGameweekForTeam returns SMOKE_GW', latest, SMOKE_GW);

  // listGameweeksForTeam
  const gws = await repo.listGameweeksForTeam(TEST_MANAGER_TEAM_ID);
  assertEqual('listGameweeksForTeam returns [SMOKE_GW]', gws.length, 1);
  assertEqual('listGameweeksForTeam[0] is SMOKE_GW', gws[0], SMOKE_GW);
}

async function smokeWatchlist(repo: PostgresWatchlistRepository): Promise<void> {
  console.log('\n[watchlist]');

  // Empty to start
  const empty = await repo.findByUser(TEST_USER_ID);
  const hadTestEntry = empty.includes(TEST_PLAYER_ID);
  // (may have residue if prior run crashed; we'll clean it)
  if (hadTestEntry) {
    await repo.remove(TEST_USER_ID, TEST_PLAYER_ID);
  }

  assertEqual(
    'contains returns false before add',
    await repo.contains(TEST_USER_ID, TEST_PLAYER_ID),
    false,
  );

  await repo.add(TEST_USER_ID, TEST_PLAYER_ID);
  assertEqual(
    'contains returns true after add',
    await repo.contains(TEST_USER_ID, TEST_PLAYER_ID),
    true,
  );

  const list = await repo.findByUser(TEST_USER_ID);
  assert('findByUser includes test player', list.includes(TEST_PLAYER_ID));

  // ④ ON CONFLICT DO NOTHING — add again should not throw or duplicate
  await repo.add(TEST_USER_ID, TEST_PLAYER_ID);
  const listAfterDup = await repo.findByUser(TEST_USER_ID);
  const myCount = listAfterDup.filter((id) => id === TEST_PLAYER_ID).length;
  assertEqual('④ ON CONFLICT DO NOTHING: no duplicate row', myCount, 1);

  await repo.remove(TEST_USER_ID, TEST_PLAYER_ID);
  assertEqual(
    'remove: contains returns false',
    await repo.contains(TEST_USER_ID, TEST_PLAYER_ID),
    false,
  );
}

// ── Teardown ───────────────────────────────────────────────────────────────────

async function teardown(sql: postgres.Sql): Promise<void> {
  console.log('\n[teardown]');
  const steps: { label: string; query: () => Promise<unknown> }[] = [
    {
      label: 'delete watchlist rows',
      query: () => sql`DELETE FROM watchlist WHERE player_id = ${TEST_PLAYER_ID}`,
    },
    {
      label: 'delete manager_squads rows',
      query: () => sql`DELETE FROM manager_squads WHERE team_id = ${TEST_MANAGER_TEAM_ID}`,
    },
    {
      label: 'delete confidence_snapshots rows',
      query: () => sql`DELETE FROM confidence_snapshots WHERE player_id = ${TEST_PLAYER_ID}`,
    },
    {
      label: 'delete players row',
      query: () => sql`DELETE FROM players WHERE id = ${TEST_PLAYER_ID}`,
    },
    {
      label: 'delete teams row',
      query: () => sql`DELETE FROM teams WHERE id = ${TEST_TEAM_ID}`,
    },
    {
      label: 'delete sync_meta row',
      query: () => sql`DELETE FROM sync_meta WHERE key = 'smoke_test_key'`,
    },
  ];

  const failed: string[] = [];
  for (const step of steps) {
    try {
      await step.query();
      console.log(`  ✓ ${step.label}`);
    } catch (e) {
      console.log(`  ✗ ${step.label}: ${String(e)}`);
      failed.push(step.label);
    }
  }

  if (failed.length > 0) {
    console.log(
      '\n  ⚠ Some teardown steps failed. Run this SQL manually in the Supabase SQL editor:',
    );
    console.log(`
    DELETE FROM watchlist WHERE player_id = ${TEST_PLAYER_ID.toString()};
    DELETE FROM manager_squads WHERE team_id = ${TEST_MANAGER_TEAM_ID.toString()};
    DELETE FROM confidence_snapshots WHERE player_id = ${TEST_PLAYER_ID.toString()};
    DELETE FROM players WHERE id = ${TEST_PLAYER_ID.toString()};
    DELETE FROM teams WHERE id = ${TEST_TEAM_ID.toString()};
    DELETE FROM sync_meta WHERE key = 'smoke_test_key';
    `);
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const url = process.env['DATABASE_URL'];
  if (!url) {
    console.error(
      'DATABASE_URL is not set. Add it to .env.local or export it before running this script.',
    );
    process.exit(1);
  }

  console.log('Postgres smoke test');
  console.log(`Connecting to: ${url.replace(/:([^@]+)@/, ':***@')}`);

  const sql = postgres(url, { prepare: false });

  const players = new PostgresPlayerRepository(sql);
  const teams = new PostgresTeamRepository(sql);
  const snapshots = new PostgresConfidenceSnapshotRepository(sql);
  const syncMeta = new PostgresSyncMetaRepository(sql);
  const managerSquads = new PostgresManagerSquadRepository(sql);
  const users = new PostgresUserRepository(sql);
  const watchlist = new PostgresWatchlistRepository(sql);

  try {
    await smokeUsers(users);
    await smokeTeams(teams);
    await smokePlayers(players);
    await smokeSnapshots(snapshots);
    await smokeSyncMeta(syncMeta);
    await smokeManagerSquads(managerSquads);
    await smokeWatchlist(watchlist);
  } finally {
    await teardown(sql);
    await sql.end();
  }

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`Results: ${passed.toString()} passed, ${failed.toString()} failed`);

  if (failures.length > 0) {
    console.log('\nFailed assertions:');
    for (const f of failures) {
      console.log(`  • ${f}`);
    }
    process.exit(1);
  } else {
    console.log('\nAll dialect concerns verified. Postgres repositories are ready.');
  }
}

main().catch((e: unknown) => {
  console.error('\nUnhandled error:', e);
  process.exit(1);
});
