/**
 * Applies schema and all incremental migrations to the dev database.
 * Run this after pulling commits that add new SQL_MIGRATIONS entries if
 * the dev server has been running continuously (the global DB singleton
 * persists across hot-reloads, so migrations only run on a full process
 * restart). A full `npm run dev` restart is equivalent and preferred;
 * use this script only when you need migrations without restarting.
 *
 * Usage:  npx tsx scripts/run-migrations.ts
 *         DB_PATH=data/fpl.test.db npx tsx scripts/run-migrations.ts
 */
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createDb } from '@/lib/db';

function main(): void {
  const DATA_DIR = join(process.cwd(), 'data');
  const DB_PATH = process.env['DB_PATH']
    ? resolve(process.cwd(), process.env['DB_PATH'])
    : join(DATA_DIR, 'fpl.db');

  mkdirSync(DATA_DIR, { recursive: true });

  console.log('Running migrations on', DB_PATH);
  const db = createDb(DB_PATH);

  const tables = (
    db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as {
      name: string;
    }[]
  ).map((r) => r.name);

  console.log('Tables:', tables.join(', '));

  const userRow = db.prepare('SELECT id, email FROM users WHERE id = 1').get() as
    | { id: number; email: string }
    | undefined;
  console.log(
    'SYSTEM_USER:',
    userRow ? `id=${userRow.id.toString()} email=${userRow.email}` : 'not found',
  );

  const cols = (db.prepare('PRAGMA table_info(manager_squads)').all() as { name: string }[]).map(
    (r) => r.name,
  );
  console.log('manager_squads columns:', cols.join(', '));

  db.close();
  console.log('Migrations complete.');
}

main();
