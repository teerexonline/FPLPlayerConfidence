/**
 * One-shot sync against the real FPL API.
 * Usage: npx tsx scripts/run-sync.ts
 */
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createDb, createRepositories } from '@/lib/db';
import { fetchBootstrapStatic, fetchElementSummary, fetchFixtures } from '@/lib/fpl/api';
import { syncConfidence } from '@/lib/sync';

async function main(): Promise<void> {
  const DATA_DIR = join(process.cwd(), 'data');
  const DB_PATH = process.env['DB_PATH']
    ? resolve(process.cwd(), process.env['DB_PATH'])
    : join(DATA_DIR, 'fpl.db');

  mkdirSync(DATA_DIR, { recursive: true });
  const db = createDb(DB_PATH);
  const repos = createRepositories(db);

  console.log('Starting FPL sync…');
  console.log('DB:', DB_PATH);

  const start = Date.now();

  const result = await syncConfidence({
    api: { fetchBootstrapStatic, fetchElementSummary, fetchFixtures },
    repos,
    clock: () => Date.now(),
    throttleMs: 200,
  });

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  if (!result.ok) {
    console.error('Sync failed:', result.error);
    process.exit(1);
  }

  const { playersProcessed, playersSkipped, snapshotsWritten, errors } = result.value;

  console.log(`\nSync complete in ${elapsed}s`);
  console.log(`  Players processed: ${playersProcessed.toString()}`);
  console.log(`  Players skipped:   ${playersSkipped.toString()}`);
  console.log(`  Snapshots written: ${snapshotsWritten.toString()}`);
  if (errors.length > 0) {
    console.log(`  Errors (isolated): ${errors.length.toString()}`);
    errors.slice(0, 5).forEach((e) => {
      console.log(`    player ${e.playerId.toString()}: ${e.reason}`);
    });
  }

  const playerCount = (db.prepare('SELECT COUNT(*) as n FROM players').get() as { n: number }).n;
  const snapshotCount = (
    db.prepare('SELECT COUNT(*) as n FROM confidence_snapshots').get() as { n: number }
  ).n;
  const topPlayers = db
    .prepare(
      `
    SELECT p.web_name, t.short_name, p.position, cs.confidence_after
    FROM confidence_snapshots cs
    JOIN players p ON p.id = cs.player_id
    JOIN teams t ON t.id = p.team_id
    WHERE cs.gameweek = (SELECT MAX(gameweek) FROM confidence_snapshots)
    ORDER BY cs.confidence_after DESC
    LIMIT 10
  `,
    )
    .all() as {
    web_name: string;
    short_name: string;
    position: string;
    confidence_after: number;
  }[];

  console.log(
    `\nDB state: ${playerCount.toString()} players, ${snapshotCount.toString()} snapshots`,
  );
  console.log('\nTop 10 by confidence (latest GW):');
  topPlayers.forEach((p) => {
    const sign = p.confidence_after >= 0 ? '+' : '';
    console.log(
      `  ${p.web_name.padEnd(22)} ${p.short_name.padEnd(4)} ${p.position}  ${sign}${p.confidence_after.toString()}`,
    );
  });
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
