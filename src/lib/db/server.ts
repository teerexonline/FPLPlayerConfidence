import 'server-only';
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createDb, createRepositories } from '@/lib/db';
import type { Repositories } from '@/lib/db';

// DB_PATH env var controls which file is opened. Defaults to data/fpl.db.
// Playwright sets DB_PATH=data/fpl.test.db so E2E runs never touch the
// production database. See src/lib/db/README.md for the full architecture.
function resolveDbPath(): string {
  const env = process.env['DB_PATH'];
  if (env) return resolve(process.cwd(), env);
  return join(process.cwd(), 'data', 'fpl.db');
}

// Singleton: reuse one connection for the lifetime of the Node.js process.
// The `global` check survives Next.js hot-reload in dev mode, but it means
// new SQL_MIGRATIONS entries only run when the process fully restarts (not on
// hot-reload). After committing a migration, run `npx tsx scripts/run-migrations.ts`
// or restart the dev server with `npm run dev`.
const g = global as typeof globalThis & {
  __fplRepos?: Repositories;
};

export function getRepositories(): Repositories {
  if (!g.__fplRepos) {
    const dbPath = resolveDbPath();
    mkdirSync(dirname(dbPath), { recursive: true });
    const db = createDb(dbPath);
    g.__fplRepos = createRepositories(db);
  }
  return g.__fplRepos;
}
