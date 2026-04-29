import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createDb, createRepositories } from '@/lib/db';
import { fetchBootstrapStatic, fetchElementSummary, fetchFixtures } from '@/lib/fpl/api';
import { syncConfidence } from '@/lib/sync';

async function main(): Promise<void> {
  const dbPath = join(process.cwd(), 'data', 'fpl.db');
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = createDb(dbPath);
  const repos = createRepositories(db);

  console.log('Connected to', dbPath);
  console.log('Running syncConfidence (v1.7)...');

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
  console.log(`  Players processed : ${String(playersProcessed)}`);
  console.log(`  Players skipped   : ${String(playersSkipped)}`);
  console.log(`  Snapshots written : ${String(snapshotsWritten)}`);
  if (errors.length > 0) {
    console.warn(`  Errors (${String(errors.length)}):`, errors.slice(0, 5));
  }
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
