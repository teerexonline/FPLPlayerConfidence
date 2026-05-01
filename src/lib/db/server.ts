import 'server-only';
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createDb, createRepositories, createPostgresRepositories } from '@/lib/db';
import type { Repositories } from '@/lib/db';
import { getPostgresClient } from './postgres-client';

// DB_PATH env var controls which SQLite file is opened. Defaults to data/fpl.db.
// Playwright sets DB_PATH=data/fpl.test.db so E2E runs never touch the
// production database. See src/lib/db/README.md for the full architecture.
function resolveDbPath(): string {
  const env = process.env['DB_PATH'];
  if (env) return resolve(process.cwd(), env);
  return join(process.cwd(), 'data', 'fpl.db');
}

function openSqliteDb() {
  const dbPath = resolveDbPath();
  mkdirSync(dirname(dbPath), { recursive: true });
  return createDb(dbPath);
}

// Production: singleton — one connection per process lifetime, shared across
// all requests. createDb is called once, migrations run once.
//
// Development (SQLite): fresh instance on every call. Next.js hot-reload keeps
// the Node process alive and preserves `global`, so a cached singleton would
// skip createDb (and therefore all SQL_MIGRATIONS) after the initial boot.
// This has bitten us three times: status fields (v1.1), repository methods
// (v1.6), watchlist table (v1.7). In dev the per-request overhead is trivial;
// all migrations are idempotent so re-running them on every request is safe.
//
// Development (Postgres): connection is held by the postgres-client singleton;
// no re-connection on every call needed since Postgres connections are pooled.
//
// DO NOT restore the SQLite singleton pattern in dev — the pain is not worth it.
const g = global as typeof globalThis & {
  __fplRepos?: Repositories;
};

export function getRepositories(): Repositories {
  if (process.env['DATABASE_URL']) {
    // Postgres path: use the module-level singleton client (hot-reload safe).
    if (process.env.NODE_ENV === 'production') {
      g.__fplRepos ??= createPostgresRepositories(getPostgresClient());
      return g.__fplRepos;
    }
    return createPostgresRepositories(getPostgresClient());
  }

  // SQLite path
  if (process.env.NODE_ENV === 'production') {
    g.__fplRepos ??= createRepositories(openSqliteDb());
    return g.__fplRepos;
  }
  // Dev: always fresh — picks up new migrations and repository methods without
  // requiring a full server restart after schema or code changes.
  return createRepositories(openSqliteDb());
}
