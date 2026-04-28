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

function openDb() {
  const dbPath = resolveDbPath();
  mkdirSync(dirname(dbPath), { recursive: true });
  return createDb(dbPath);
}

// Production: singleton — one connection per process lifetime, shared across
// all requests. createDb is called once, migrations run once.
//
// Development: fresh instance on every call. Next.js hot-reload keeps the
// Node process alive and preserves `global`, so a cached singleton would
// skip createDb (and therefore all SQL_MIGRATIONS) after the initial boot.
// This has bitten us three times: status fields (v1.1), repository methods
// (v1.6), watchlist table (v1.7). In dev the per-request overhead is trivial;
// all migrations are idempotent so re-running them on every request is safe.
//
// DO NOT restore the singleton pattern in dev — the pain is not worth it.
const g = global as typeof globalThis & {
  __fplRepos?: Repositories;
};

export function getRepositories(): Repositories {
  if (process.env.NODE_ENV === 'production') {
    g.__fplRepos ??= createRepositories(openDb());
    return g.__fplRepos;
  }
  // Dev: always fresh — picks up new migrations and repository methods without
  // requiring a full server restart after schema or code changes.
  return createRepositories(openDb());
}
