# Multi-User Infrastructure — Phase 2 Decisions

This document records the three open decisions that must be resolved before Phase 2 (real authentication) can be implemented. Each decision is framed with the options available, the tradeoffs, and a recommended path.

---

## Decision 1 — Auth Provider

**Question:** Which authentication provider should we use when we open the product to real users?

### Options

| Option            | Summary                                                                | Tradeoffs                                                                                  |
| ----------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| **NextAuth v5**   | Open-source, runs in the same Next.js process, supports many providers | Adds `next-auth` dependency (CLAUDE.md currently forbids it); session storage is in the DB |
| **Clerk**         | Managed auth SaaS; zero backend auth code                              | Paid above free tier; adds a client-side SDK; user data lives in Clerk, not our DB         |
| **Supabase Auth** | Built into Supabase if we migrate to Postgres                          | Couples auth to the DB host choice; adds a new infra dependency                            |
| **Custom JWT**    | Full control; no external dependency                                   | Significant implementation surface; cryptography mistakes are high risk                    |

### Recommendation

**NextAuth v5 with credentials provider** for Phase 2 MVP. Rationale:

1. It is the canonical auth solution for Next.js App Router and the only one with first-class RSC support.
2. The `next-auth` dependency exception is justified by scope: auth is a cross-cutting concern that cannot be built without a library at principal-engineer quality.
3. Users will authenticate with a username+password backed by our `users` table. No OAuth complexity for a private/invite-only MVP.
4. The `users` table schema we have already is exactly what NextAuth's database adapter expects (extend with `password_hash TEXT` and a `sessions` table when Phase 2 begins).

**Approval required before implementing.** Adding `next-auth` violates the current CLAUDE.md dependency lock.

---

## Decision 2 — Database Host for Phase 2

**Question:** SQLite is a single-file database colocated with the app server. At multi-user scale, should we migrate to a hosted Postgres instance?

### Options

| Option                                    | Summary                                                                 | Tradeoffs                                                                               |
| ----------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **Stay on SQLite + Turso**                | Turso gives SQLite read replicas and a remote write primary over libSQL | Keeps our schema unchanged; no ORM needed; Turso has a generous free tier               |
| **Migrate to Postgres (Neon / Supabase)** | Hosted Postgres; industry standard for web apps with concurrent writes  | Requires schema migration; adds `pg` or `drizzle-orm`; connection pooling in serverless |
| **LiteFS (Fly.io)**                       | Distributed SQLite with Raft consensus; zero schema change              | Tightly coupled to Fly.io deployment; less mature than Postgres tooling                 |

### Recommendation

**Turso** (SQLite-compatible libSQL remote database). Rationale:

1. Our schema is entirely SQLite-idiomatic. Migrating to Postgres requires rewriting `better-sqlite3` to `pg` and every prepared statement.
2. Turso supports concurrent reads via edge replicas and serialised writes via a remote primary — sufficient for hundreds of concurrent users.
3. The `better-sqlite3` driver is replaced by `@libsql/client` with minimal code changes. Repository interfaces stay identical; only the `createDb()` factory changes.
4. If write throughput eventually exceeds Turso's limits, migrating from Turso→Postgres is easier than SQLite→Postgres because the schema is already production-grade.

**Approval required before implementing.** Adds a network dependency and billing account.

---

## Decision 3 — User Data Model

**Question:** The current `users` table has only `id`, `email`, and `created_at`. What additional columns will Phase 2 need, and what privacy/retention obligations do we have?

### Proposed Phase 2 Schema Extension

```sql
ALTER TABLE users ADD COLUMN password_hash TEXT;       -- nullable; NULL = no-password (OAuth flow)
ALTER TABLE users ADD COLUMN display_name TEXT;        -- user-chosen display name, nullable
ALTER TABLE users ADD COLUMN fpl_team_id INTEGER;      -- the user's primary FPL team (denormalized)
ALTER TABLE users ADD COLUMN verified_at INTEGER;      -- epoch ms; NULL = email not verified
ALTER TABLE users ADD COLUMN last_sign_in_at INTEGER;  -- epoch ms; used for inactive-account pruning
```

### Data minimisation decisions

- **No first/last name columns.** Email + display_name is sufficient. First/last name introduces GDPR subject-access complexity.
- **FPL team ID denormalized to users.** The current `manager_squads` table is keyed on `(user_id, team_id, gameweek, squad_position)`. Denormalizing the team ID to `users` speeds up the My Team page initial load (one lookup instead of joining through `manager_squads`).
- **No analytics events table in Phase 2.** Defer until there is a legal basis and a privacy policy. Do not add event tracking speculatively.
- **Retention policy.** Accounts with `last_sign_in_at` older than 365 days and no active data are eligible for automated deletion. Implement at Phase 3.

### Current `manager_squads` PK must change

The current `PRIMARY KEY (team_id, gameweek, squad_position)` does not include `user_id`, which means two users sharing the same FPL team ID would collide. Phase 2 migration must recreate the table:

```sql
-- SQLite cannot ALTER TABLE … ADD PRIMARY KEY, so a full table swap is needed.
CREATE TABLE manager_squads_v2 (
  user_id         INTEGER NOT NULL REFERENCES users(id),
  team_id         INTEGER NOT NULL,
  gameweek        INTEGER NOT NULL,
  player_id       INTEGER NOT NULL,
  squad_position  INTEGER NOT NULL,
  is_captain      INTEGER NOT NULL DEFAULT 0,
  is_vice_captain INTEGER NOT NULL DEFAULT 0,
  fetched_at      INTEGER NOT NULL,
  PRIMARY KEY (user_id, team_id, gameweek, squad_position)
);
INSERT INTO manager_squads_v2 SELECT * FROM manager_squads;
DROP TABLE manager_squads;
ALTER TABLE manager_squads_v2 RENAME TO manager_squads;
```

This migration requires a maintenance window (exclusive lock on the table). With Turso, it must run as a single batch transaction.

---

## Summary

| Decision        | Recommended               | Approval needed             |
| --------------- | ------------------------- | --------------------------- |
| Auth provider   | NextAuth v5 + credentials | Yes — dependency exception  |
| DB host         | Turso (libSQL)            | Yes — billing + infra       |
| User data model | Minimal schema above      | No — can be discussed in PR |
