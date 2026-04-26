# `src/lib/db`

Database layer: schema, repository interfaces, and SQLite implementations.

---

## Database files

| File                    | Used by                                  | Created by                                      |
| ----------------------- | ---------------------------------------- | ----------------------------------------------- |
| `data/fpl.db`           | Production server, `scripts/run-sync.ts` | Real sync (`npx tsx scripts/run-sync.ts`)       |
| `data/fpl.test.db`      | Playwright E2E tests                     | `e2e/setup/seed-db.ts` (Playwright globalSetup) |
| `$TMPDIR/fpl-*/test.db` | Vitest integration tests                 | `mkdtempSync` in each test's `beforeEach`       |

Both `data/` files are gitignored. Never commit them.

---

## Why separate files?

The production database (`fpl.db`) uses real FPL player IDs (e.g., Salah = 381)
and real 2025/26 team IDs (e.g., Liverpool = 12). The E2E seed uses invented IDs
(Salah = 9999, Liverpool = 11) chosen for determinism, not API alignment.

If both datasets share one file, a real sync overwrites the teams table
with live IDs — causing `team_id=11` to mean Leeds rather than Liverpool,
making the seeded Salah appear at Leeds. The fix is complete file isolation.

---

## Selecting the database path

All entry points read `process.env.DB_PATH`:

```
DB_PATH unset            → data/fpl.db       (production default)
DB_PATH=data/fpl.test.db → data/fpl.test.db  (E2E, set by playwright.config.ts)
```

Entry points that respect this variable:

- `src/lib/db/server.ts` — `getRepositories()` singleton used by Next.js
- `scripts/run-sync.ts` — one-shot CLI sync

`playwright.config.ts` sets `process.env['DB_PATH'] = 'data/fpl.test.db'` at
module level (so `globalSetup` inherits it) and passes it via `webServer.env`
(so the Next.js server subprocess inherits it).

Vitest integration tests create their own temp files via `mkdtempSync` and
never read `DB_PATH` — they call `createDb(path)` directly.

---

## Module structure

```
src/lib/db/
├── client.ts                createDb(path) — opens, enables WAL + FK, applies schema
├── schema.ts                SQL_SCHEMA — DDL for all tables
├── server.ts                getRepositories() — Next.js singleton, reads DB_PATH
├── index.ts                 barrel: re-exports createDb, createRepositories, all types
├── types.ts                 DbTeam, DbPlayer, DbConfidenceSnapshot, PlayerId, TeamId
├── db-isolation.test.ts     regression: prod and test DBs never share rows
└── repositories/
    ├── TeamRepository.ts               interface
    ├── PlayerRepository.ts             interface
    ├── ConfidenceSnapshotRepository.ts interface
    ├── SyncMetaRepository.ts           interface
    ├── ManagerSquadRepository.ts       interface
    └── sqlite/                         concrete SQLite implementations + tests
```

---

## Running the real sync

```bash
npx tsx scripts/run-sync.ts
```

Writes to `data/fpl.db` by default. After a full sync you should see ~700 players,
20 teams, and thousands of confidence snapshots. The `sync_meta` table records a
`last_sync` Unix timestamp on successful completion.
