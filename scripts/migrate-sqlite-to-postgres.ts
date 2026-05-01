/**
 * One-time data migration: SQLite → Supabase Postgres
 *
 * Reads all rows from data/fpl.db via raw SQLite queries and writes them to
 * Supabase using the Postgres repositories (which handle ON CONFLICT logic).
 *
 * Prerequisites:
 *   - data/fpl.db exists with current data  (npm run dev once to seed it)
 *   - .env.local has DATABASE_URL pointing to Supabase transaction pooler
 *   - Supabase schema already applied (supabase/migrations/0001_initial_schema.sql)
 *
 * Run:
 *   npx tsx scripts/migrate-sqlite-to-postgres.ts
 *
 * Resume after partial failure (idempotent — safe to re-run any table):
 *   npx tsx scripts/migrate-sqlite-to-postgres.ts --from-table=players
 *
 * Dry run (reads SQLite, skips Postgres writes):
 *   npx tsx scripts/migrate-sqlite-to-postgres.ts --dry-run
 */

// Load .env.local before any postgres connection is established.
if (!process.env['DATABASE_URL']) {
  try {
    process.loadEnvFile('.env.local');
  } catch {
    // Not found — let the URL check below handle it.
  }
}

import { resolve } from 'node:path';
import Database from 'better-sqlite3';
import postgres from 'postgres';
import { PostgresPlayerRepository } from '@/lib/db/repositories/postgres/PostgresPlayerRepository';
import { PostgresTeamRepository } from '@/lib/db/repositories/postgres/PostgresTeamRepository';
import { PostgresConfidenceSnapshotRepository } from '@/lib/db/repositories/postgres/PostgresConfidenceSnapshotRepository';
import { PostgresSyncMetaRepository } from '@/lib/db/repositories/postgres/PostgresSyncMetaRepository';
import { PostgresManagerSquadRepository } from '@/lib/db/repositories/postgres/PostgresManagerSquadRepository';
import { PostgresUserRepository } from '@/lib/db/repositories/postgres/PostgresUserRepository';
import type { DbPlayer, DbTeam, DbConfidenceSnapshot, DbManagerSquadPick } from '@/lib/db/types';

// ── Config ─────────────────────────────────────────────────────────────────────

const BATCH_SIZE = 500;

const TABLE_ORDER = [
  'users',
  'teams',
  'players',
  'confidence_snapshots',
  'manager_squads',
  'watchlist',
  'sync_meta',
] as const;

type TableName = (typeof TABLE_ORDER)[number];

// ── Raw SQLite row types ────────────────────────────────────────────────────────
// (SQLite stores booleans as 0|1 integers)

interface RawSnapshotRow {
  player_id: number;
  gameweek: number;
  confidence_after: number;
  delta: number;
  raw_delta: number;
  event_magnitude: number;
  reason: string;
  fatigue_applied: number;
  motm_counter: number;
  defcon_counter: number;
  savecon_counter: number;
}

interface RawPickRow {
  user_id: number;
  team_id: number;
  gameweek: number;
  player_id: number;
  squad_position: number;
  is_captain: number;
  is_vice_captain: number;
  fetched_at: number;
}

interface RawWatchlistRow {
  user_id: number;
  player_id: number;
  added_at: number;
}

interface RawSyncMetaRow {
  key: string;
  value: string;
  updated_at: number;
}

interface RawUserRow {
  id: number;
  email: string;
  created_at: number;
}

// ── Helpers ─────────────────────────────────────────────────────────────────────

function chunk<T>(arr: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

function sqliteCount(db: Database.Database, table: string): number {
  const row = db.prepare(`SELECT COUNT(*) AS cnt FROM ${table}`).get() as { cnt: number };
  return row.cnt;
}

async function pgCount(sql: postgres.Sql, table: string): Promise<number> {
  const rows = await sql<{ cnt: string }[]>`SELECT COUNT(*) AS cnt FROM ${sql(table)}`;
  return Number(rows[0]?.cnt ?? 0);
}

function header(index: number, total: number, table: string, count: number): void {
  console.log(
    `\n[${(index + 1).toString()}/${total.toString()}] ${table}: ${count.toString()} row(s) to migrate`,
  );
}

function batchLog(batchNum: number, totalBatches: number, rows: number): void {
  console.log(
    `    batch ${batchNum.toString()}/${totalBatches.toString()}: ${rows.toString()} rows`,
  );
}

function verifyLog(sqliteN: number, pgN: number, table: string): void {
  const match = sqliteN === pgN;
  const icon = match ? '✓' : '✗';
  console.log(`    verify: SQLite=${sqliteN.toString()} Postgres=${pgN.toString()} ${icon}`);
  if (!match) {
    throw new Error(
      `Row count mismatch on ${table}: SQLite has ${sqliteN.toString()}, Postgres has ${pgN.toString()}`,
    );
  }
}

// ── Migration steps ─────────────────────────────────────────────────────────────

async function migrateUsers(
  db: Database.Database,
  pgRepo: PostgresUserRepository,
  sql: postgres.Sql,
  dryRun: boolean,
): Promise<{ sqlite: number; pg: number }> {
  const rows = db.prepare('SELECT id, email, created_at FROM users').all() as RawUserRow[];
  header(0, TABLE_ORDER.length, 'users', rows.length);

  if (!dryRun) {
    // UserRepository has no insert method — the system user is seeded by the schema.
    // For any additional users, insert directly via raw SQL with ON CONFLICT DO NOTHING.
    for (const row of rows) {
      await sql`
        INSERT INTO users (id, email, created_at)
        VALUES (${row.id}, ${row.email}, ${row.id === 1 ? row.created_at : row.created_at})
        ON CONFLICT (id) DO NOTHING
      `;
    }
  }

  const sqliteN = sqliteCount(db, 'users');
  const pgN = dryRun ? sqliteN : await pgCount(sql, 'users');
  verifyLog(sqliteN, pgN, 'users');
  return { sqlite: sqliteN, pg: pgN };
}

async function migrateTeams(
  db: Database.Database,
  pgRepo: PostgresTeamRepository,
  sql: postgres.Sql,
  dryRun: boolean,
): Promise<{ sqlite: number; pg: number }> {
  const rows = db
    .prepare('SELECT id, code, name, short_name FROM teams ORDER BY id')
    .all() as DbTeam[];
  header(1, TABLE_ORDER.length, 'teams', rows.length);

  if (!dryRun && rows.length > 0) {
    await pgRepo.upsertMany(rows);
    console.log(`    inserted ${rows.length.toString()} rows`);
  }

  const sqliteN = sqliteCount(db, 'teams');
  const pgN = dryRun ? sqliteN : await pgCount(sql, 'teams');
  verifyLog(sqliteN, pgN, 'teams');
  return { sqlite: sqliteN, pg: pgN };
}

async function migratePlayers(
  db: Database.Database,
  pgRepo: PostgresPlayerRepository,
  sql: postgres.Sql,
  dryRun: boolean,
): Promise<{ sqlite: number; pg: number }> {
  const rows = db
    .prepare(
      `SELECT id, web_name, team_id, position, now_cost, total_points, updated_at,
              status, chance_of_playing_next_round, news,
              influence, creativity, threat, minutes, next_fixture_fdr
       FROM players ORDER BY id`,
    )
    .all() as DbPlayer[];
  header(2, TABLE_ORDER.length, 'players', rows.length);

  if (!dryRun && rows.length > 0) {
    const batches = chunk(rows, BATCH_SIZE);
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      if (!batch) continue;
      await pgRepo.upsertMany(batch);
      batchLog(i + 1, batches.length, batch.length);
    }
  }

  const sqliteN = sqliteCount(db, 'players');
  const pgN = dryRun ? sqliteN : await pgCount(sql, 'players');
  verifyLog(sqliteN, pgN, 'players');
  return { sqlite: sqliteN, pg: pgN };
}

async function migrateSnapshots(
  db: Database.Database,
  pgRepo: PostgresConfidenceSnapshotRepository,
  sql: postgres.Sql,
  dryRun: boolean,
): Promise<{ sqlite: number; pg: number }> {
  const raw = db
    .prepare(
      `SELECT player_id, gameweek, confidence_after, delta, raw_delta, event_magnitude,
              reason, fatigue_applied, motm_counter, defcon_counter, savecon_counter
       FROM confidence_snapshots ORDER BY player_id, gameweek`,
    )
    .all() as RawSnapshotRow[];

  // Convert SQLite 0|1 booleans → JS booleans
  const rows: DbConfidenceSnapshot[] = raw.map((r) => ({
    player_id: r.player_id,
    gameweek: r.gameweek,
    confidence_after: r.confidence_after,
    delta: r.delta,
    raw_delta: r.raw_delta,
    event_magnitude: r.event_magnitude,
    reason: r.reason,
    fatigue_applied: r.fatigue_applied !== 0,
    motm_counter: r.motm_counter,
    defcon_counter: r.defcon_counter,
    savecon_counter: r.savecon_counter,
  }));

  header(3, TABLE_ORDER.length, 'confidence_snapshots', rows.length);

  if (!dryRun && rows.length > 0) {
    const batches = chunk(rows, BATCH_SIZE);
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      if (!batch) continue;
      await pgRepo.upsertMany(batch);
      batchLog(i + 1, batches.length, batch.length);
    }
  }

  const sqliteN = sqliteCount(db, 'confidence_snapshots');
  const pgN = dryRun ? sqliteN : await pgCount(sql, 'confidence_snapshots');
  verifyLog(sqliteN, pgN, 'confidence_snapshots');
  return { sqlite: sqliteN, pg: pgN };
}

async function migrateManagerSquads(
  db: Database.Database,
  pgRepo: PostgresManagerSquadRepository,
  sql: postgres.Sql,
  dryRun: boolean,
): Promise<{ sqlite: number; pg: number }> {
  const raw = db
    .prepare(
      `SELECT user_id, team_id, gameweek, player_id, squad_position,
              is_captain, is_vice_captain, fetched_at
       FROM manager_squads ORDER BY team_id, gameweek, squad_position`,
    )
    .all() as RawPickRow[];

  // Convert SQLite 0|1 booleans → JS booleans
  const rows: DbManagerSquadPick[] = raw.map((r) => ({
    user_id: r.user_id,
    team_id: r.team_id,
    gameweek: r.gameweek,
    player_id: r.player_id,
    squad_position: r.squad_position,
    is_captain: r.is_captain !== 0,
    is_vice_captain: r.is_vice_captain !== 0,
    fetched_at: r.fetched_at,
  }));

  header(4, TABLE_ORDER.length, 'manager_squads', rows.length);

  if (!dryRun && rows.length > 0) {
    const batches = chunk(rows, BATCH_SIZE);
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      if (!batch) continue;
      await pgRepo.upsertMany(batch);
      batchLog(i + 1, batches.length, batch.length);
    }
  }

  const sqliteN = sqliteCount(db, 'manager_squads');
  const pgN = dryRun ? sqliteN : await pgCount(sql, 'manager_squads');
  verifyLog(sqliteN, pgN, 'manager_squads');
  return { sqlite: sqliteN, pg: pgN };
}

async function migrateWatchlist(
  db: Database.Database,
  pgSql: postgres.Sql,
  dryRun: boolean,
): Promise<{ sqlite: number; pg: number }> {
  const rows = db
    .prepare('SELECT user_id, player_id, added_at FROM watchlist ORDER BY user_id, added_at')
    .all() as RawWatchlistRow[];
  header(5, TABLE_ORDER.length, 'watchlist', rows.length);

  if (!dryRun && rows.length > 0) {
    // Use raw SQL to preserve the original added_at timestamp.
    // PostgresWatchlistRepository.add() always uses Date.now() which would lose history.
    const batches = chunk(rows, BATCH_SIZE);
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      if (!batch) continue;
      // Build values array for bulk insert
      const values = batch.map((r) => ({
        user_id: r.user_id,
        player_id: r.player_id,
        added_at: r.added_at,
      }));
      await pgSql`
        INSERT INTO watchlist ${pgSql(values)}
        ON CONFLICT (user_id, player_id) DO NOTHING
      `;
      batchLog(i + 1, batches.length, batch.length);
    }
  }

  const sqliteN = sqliteCount(db, 'watchlist');
  const pgN = dryRun ? sqliteN : await pgCount(pgSql, 'watchlist');
  verifyLog(sqliteN, pgN, 'watchlist');
  return { sqlite: sqliteN, pg: pgN };
}

async function migrateSyncMeta(
  db: Database.Database,
  pgRepo: PostgresSyncMetaRepository,
  sql: postgres.Sql,
  dryRun: boolean,
): Promise<{ sqlite: number; pg: number }> {
  const rows = db.prepare('SELECT key, value, updated_at FROM sync_meta').all() as RawSyncMetaRow[];
  header(6, TABLE_ORDER.length, 'sync_meta', rows.length);

  if (!dryRun) {
    for (const row of rows) {
      await pgRepo.set(row.key, row.value, row.updated_at);
    }
    if (rows.length > 0) console.log(`    inserted ${rows.length.toString()} row(s)`);
  }

  const sqliteN = sqliteCount(db, 'sync_meta');
  const pgN = dryRun ? sqliteN : await pgCount(sql, 'sync_meta');
  verifyLog(sqliteN, pgN, 'sync_meta');
  return { sqlite: sqliteN, pg: pgN };
}

// ── Spot checks ─────────────────────────────────────────────────────────────────

async function spotChecks(sql: postgres.Sql): Promise<void> {
  console.log('\nSpot checks:');

  // Haaland exists
  const haaland = await sql<{ web_name: string; id: number }[]>`
    SELECT id, web_name FROM players WHERE web_name = 'Haaland' LIMIT 1
  `;
  const haalandRow = haaland[0];
  if (haalandRow) {
    console.log(`  players.web_name='Haaland' → id=${haalandRow.id.toString()} ✓`);
  } else {
    console.log(`  players.web_name='Haaland' → NOT FOUND ✗`);
  }

  // Latest gameweek in snapshots
  const latestGw = await sql<{ max_gw: string | null }[]>`
    SELECT MAX(gameweek) AS max_gw FROM confidence_snapshots
  `;
  const gw = latestGw[0]?.max_gw ?? 'none';
  console.log(`  confidence_snapshots latest GW → ${gw} ✓`);

  // Watchlist count for system user
  const wlCount = await sql<{ cnt: string }[]>`
    SELECT COUNT(*) AS cnt FROM watchlist WHERE user_id = 1
  `;
  console.log(`  watchlist user_id=1 → ${wlCount[0]?.cnt ?? '0'} entries ✓`);

  // Active players count (minutes > 0)
  const activePlayers = await sql<{ cnt: string }[]>`
    SELECT COUNT(*) AS cnt FROM players WHERE minutes > 0
  `;
  console.log(`  players with minutes > 0 → ${activePlayers[0]?.cnt ?? '0'} ✓`);

  // System user seeded
  const sysUser = await sql<{ email: string }[]>`
    SELECT email FROM users WHERE id = 1
  `;
  console.log(`  users id=1 → ${sysUser[0]?.email ?? 'NOT FOUND'} ✓`);
}

// ── Main ────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const fromTableArg = args.find((a) => a.startsWith('--from-table='))?.split('=')[1] as
    | TableName
    | undefined;

  const fromIndex = fromTableArg ? TABLE_ORDER.indexOf(fromTableArg) : 0;
  if (fromTableArg && fromIndex === -1) {
    console.error(`Unknown table: ${fromTableArg}. Valid: ${TABLE_ORDER.join(', ')}`);
    process.exit(1);
  }

  const url = process.env['DATABASE_URL'];
  if (!url) {
    console.error('DATABASE_URL is not set. Add it to .env.local.');
    process.exit(1);
  }

  const dbPath = resolve(process.cwd(), 'data', 'fpl.db');
  const db = new Database(dbPath, { readonly: true });

  const sql = postgres(url, { prepare: false });
  const pgPlayers = new PostgresPlayerRepository(sql);
  const pgTeams = new PostgresTeamRepository(sql);
  const pgSnapshots = new PostgresConfidenceSnapshotRepository(sql);
  const pgSyncMeta = new PostgresSyncMetaRepository(sql);
  const pgManagerSquads = new PostgresManagerSquadRepository(sql);
  const pgUsers = new PostgresUserRepository(sql);

  console.log('Migration starting...');
  if (dryRun) console.log('[DRY-RUN] No writes will be made to Postgres.');
  if (fromTableArg) console.log(`Resuming from table: ${fromTableArg} (skipping earlier tables).`);

  const results: { table: string; sqlite: number; pg: number }[] = [];
  const start = Date.now();

  try {
    if (fromIndex <= 0) {
      const r = await migrateUsers(db, pgUsers, sql, dryRun);
      results.push({ table: 'users', ...r });
    }
    if (fromIndex <= 1) {
      const r = await migrateTeams(db, pgTeams, sql, dryRun);
      results.push({ table: 'teams', ...r });
    }
    if (fromIndex <= 2) {
      const r = await migratePlayers(db, pgPlayers, sql, dryRun);
      results.push({ table: 'players', ...r });
    }
    if (fromIndex <= 3) {
      const r = await migrateSnapshots(db, pgSnapshots, sql, dryRun);
      results.push({ table: 'confidence_snapshots', ...r });
    }
    if (fromIndex <= 4) {
      const r = await migrateManagerSquads(db, pgManagerSquads, sql, dryRun);
      results.push({ table: 'manager_squads', ...r });
    }
    if (fromIndex <= 5) {
      const r = await migrateWatchlist(db, sql, dryRun);
      results.push({ table: 'watchlist', ...r });
    }
    if (fromIndex <= 6) {
      const r = await migrateSyncMeta(db, pgSyncMeta, sql, dryRun);
      results.push({ table: 'sync_meta', ...r });
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`\n✗ Migration halted: ${msg}`);
    console.error('\nTo resume safely (all inserts are idempotent):');
    const lastOk = results.at(-1);
    if (lastOk) {
      console.error(`  npx tsx scripts/migrate-sqlite-to-postgres.ts --from-table=${lastOk.table}`);
    } else {
      console.error(`  npx tsx scripts/migrate-sqlite-to-postgres.ts`);
    }
    db.close();
    await sql.end();
    process.exit(1);
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  // ── Summary ──
  console.log('\nMigration complete. Verification:');
  let totalSqlite = 0;
  let totalPg = 0;
  for (const r of results) {
    const icon = r.sqlite === r.pg ? '✓' : '✗';
    console.log(
      `  ${r.table.padEnd(24)} SQLite=${r.sqlite.toString().padStart(6)}  Postgres=${r.pg.toString().padStart(6)}  ${icon}`,
    );
    totalSqlite += r.sqlite;
    totalPg += r.pg;
  }
  const totalMatch = totalSqlite === totalPg;
  console.log(`\n  ${'SQLite total rows:'.padEnd(22)} ${totalSqlite.toString()}`);
  console.log(`  ${'Postgres total rows:'.padEnd(22)} ${totalPg.toString()}`);
  console.log(`  Match: ${totalMatch ? '✓' : '✗'}`);
  console.log(`\n  Elapsed: ${elapsed}s`);

  if (!dryRun) {
    await spotChecks(sql);
  }

  db.close();
  await sql.end();

  if (!totalMatch) {
    process.exit(1);
  }
}

main().catch((e: unknown) => {
  console.error('\nUnhandled error:', e);
  process.exit(1);
});
