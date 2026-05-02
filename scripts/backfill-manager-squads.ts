/**
 * One-time backfill script for manager_squads historical data.
 *
 * When to run: once per manager team, when the local DB is missing squad data
 * for gameweeks that predate the app's first sync run. The FPL API exposes
 * historical picks for all past GWs, so any gap between GW1 and the first
 * local sync can be recovered.
 *
 * Idempotent: re-running is safe. GWs already present in manager_squads are
 * detected via listGameweeksForTeam and skipped without touching the API.
 *
 * Usage:
 *   npx tsx scripts/backfill-manager-squads.ts [team_id] [--dry-run]
 *
 * Examples:
 *   npx tsx scripts/backfill-manager-squads.ts 231177
 *   npx tsx scripts/backfill-manager-squads.ts 231177 --dry-run
 */
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createDb, createRepositories } from '@/lib/db';
import { fetchEntryPicks } from '@/lib/fpl/api';
import { backfillManagerSquads } from '@/lib/sync/backfillManagerSquads';
import type { GwResult } from '@/lib/sync/backfillManagerSquads';
interface GwCountRow {
  gameweek: number;
  cnt: number;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const teamIdArg = args.find((a) => /^\d+$/.test(a));
  const dryRun = args.includes('--dry-run');

  const teamId = teamIdArg ? parseInt(teamIdArg, 10) : 231177;

  if (isNaN(teamId) || teamId <= 0) {
    console.error('Usage: npx tsx scripts/backfill-manager-squads.ts [team_id] [--dry-run]');
    process.exit(1);
  }

  const DATA_DIR = join(process.cwd(), 'data');
  const DB_PATH = process.env['DB_PATH']
    ? resolve(process.cwd(), process.env['DB_PATH'])
    : join(DATA_DIR, 'fpl.db');

  mkdirSync(DATA_DIR, { recursive: true });
  const db = createDb(DB_PATH);
  const repos = createRepositories(db);

  const gwRaw = await repos.syncMeta.get('current_gameweek');
  const currentGw = gwRaw ? parseInt(gwRaw, 10) : NaN;

  if (isNaN(currentGw) || currentGw < 2) {
    console.error(
      'Cannot determine current_gameweek from sync_meta — run a confidence sync first.',
    );
    process.exit(1);
  }

  const fromGw = 1;
  const toGw = currentGw - 1;

  const existing = await repos.managerSquads.listGameweeksForTeam(teamId);
  const missingCount = toGw - fromGw + 1 - existing.length;

  console.log(`Backfilling manager_squads for team ${teamId.toString()}`);
  console.log(`Current GW: ${currentGw.toString()}`);
  console.log(`Range:      GW${fromGw.toString()}–GW${toGw.toString()}`);
  console.log(`Already in DB: ${existing.length.toString()} GWs`);
  console.log(`To fetch:      ${missingCount.toString()} GWs`);
  if (dryRun) console.log('\n[DRY-RUN] Nothing will be written to the database.');
  console.log('');

  function onProgress(result: GwResult): void {
    const gw = `GW${result.gameweek.toString().padStart(2, ' ')}`;
    switch (result.status) {
      case 'upserted':
        console.log(`  ${gw}  ok  upserted ${(result.picks ?? 0).toString()} picks`);
        break;
      case 'already_present':
        console.log(`  ${gw}  --  already in DB, skipped`);
        break;
      case 'skipped_404':
        console.log(`  ${gw}  ??  404 from API — GW not available, skipped`);
        break;
      case 'dry_run':
        console.log(`  ${gw}  ~~  dry-run: would upsert ${(result.picks ?? 0).toString()} picks`);
        break;
      case 'error':
        console.log(`  ${gw}  !!  error: ${result.error ?? 'unknown'}`);
        break;
    }
  }

  const start = Date.now();

  const summary = await backfillManagerSquads({
    teamId,
    fromGw,
    toGw,
    fetchPicks: (gw) => fetchEntryPicks(teamId, gw),
    repo: repos.managerSquads,
    dryRun,
    delayMs: 150,
    onProgress,
  });

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  console.log('');
  console.log(`Backfill complete in ${elapsed}s`);
  console.log(`  Upserted:        ${summary.gwsUpserted.toString()} GWs`);
  console.log(`  Already present: ${summary.gwsAlreadyPresent.toString()} GWs`);
  console.log(`  Skipped (404):   ${summary.gwsSkipped.toString()} GWs`);
  console.log(`  Errored:         ${summary.gwsErrored.toString()} GWs`);

  if (!dryRun && summary.gwsErrored === 0) {
    const rows = (
      db as unknown as {
        prepare: (sql: string) => { all: (...args: unknown[]) => GwCountRow[] };
      }
    )
      .prepare(
        'SELECT gameweek, COUNT(*) as cnt FROM manager_squads WHERE team_id = ? GROUP BY gameweek ORDER BY gameweek',
      )
      .all(teamId);

    console.log(`\nDatabase verification for team ${teamId.toString()}:`);
    const minGw = rows[0]?.gameweek ?? 0;
    const maxGw = rows.at(-1)?.gameweek ?? 0;
    const totalRows = rows.reduce((sum, r) => sum + r.cnt, 0);
    console.log(
      `  GW range: GW${minGw.toString()}–GW${maxGw.toString()} (${rows.length.toString()} GWs, ${totalRows.toString()} rows)`,
    );
  }
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
