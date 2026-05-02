# Architect Handover — FPL Confidence

**Written:** 2026-05-02  
**Context:** Transition document for an incoming architect replacing the current one.  
**Authority:** This document describes current state as of today. Where it conflicts with other docs, trust this one for current-state facts, and trust the other docs for their respective specification domains (algorithm, testing standards, etc.).

---

## 1. What this product is

**FPL Confidence** is a Fantasy Premier League companion app. Its central idea is simple: instead of hunting across FPL points, form tables, and fixture difficulty spreadsheets, a single number — **Confidence**, ranging from `−4` to `+5` — tells you whether a player is in form and worth picking.

Above `0` = back them. Below `0` = bench or transfer.

The product is deployed at Vercel. It is a real app with a production database and a daily cron sync that pulls live FPL data. Five screens: Dashboard, Players list, Player detail, My Team, Settings.

**UI is the explicit top priority.** Engineering quality is the minimum bar, not the ceiling. Both must be met. See `PLANNING.md §2` and `docs/UI_GUIDELINES.md`.

---

## 2. The single most important thing to know right now

**The production `/api/my-team` endpoint was broken from commit `cf3338a` (2026-05-02) until commit `7366c71` (2026-05-02, today).** A SQL syntax error in `PostgresManagerSquadRepository.upsertMany` caused an unhandled exception on every squad write, manifesting as a 500 with an empty body and null Content-Type.

The fix is live but the Vercel deployment may still be building. Verify with:

```bash
curl 'https://fpl-player-confidence.vercel.app/api/my-team?teamId=5765456'
# Expected: 200 with JSON payload
```

The root cause, the diagnosis process, and three lessons learned are in §9 of this document.

---

## 3. The codebase at a glance

### 3.1 Stack — locked, do not change without approval

| Concern   | Choice                                                                   | Rationale                                                              |
| --------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| Framework | Next.js 15 App Router, TypeScript `strict` + `noUncheckedIndexedAccess`  | RSC-first, server components eliminate most client-side state          |
| Styling   | Tailwind CSS v4 + shadcn/ui (New York, neutral)                          | Token-based design system, no CSS-in-JS                                |
| Animation | Motion (formerly Framer Motion)                                          | sparingly — state changes only                                         |
| Icons     | Lucide React                                                             | consistent icon set                                                    |
| Charts    | Recharts, heavily restyled                                               | confidence history charts                                              |
| State     | RSC + URL state; Zustand only with written justification                 | server-first, no client state unless unavoidable                       |
| Database  | Supabase Postgres (migrated from SQLite)                                 | see §5                                                                 |
| Auth      | Supabase Auth (`@supabase/ssr`)                                          | see §6                                                                 |
| Testing   | Vitest + Testing Library + MSW + Playwright                              | see `docs/TESTING.md`                                                  |
| Linting   | ESLint flat config + `@typescript-eslint/strict-type-checked` + Prettier | zero warnings policy                                                   |
| Fonts     | Geist Sans (UI), Fraunces (display)                                      | intentional override of `frontend-design` skill's generic-font warning |

**Forbidden:** Redux, tRPC, GraphQL, Prisma, NextAuth, any UI library other than shadcn, any CSS-in-JS.

No new runtime dependencies without a one-line written justification and explicit approval. This constraint exists because every dependency has a cost: bundle size, update surface, and future compatibility risk.

### 3.2 Architecture — four layers, one direction

```
┌─────────────────────────────────────────────────┐
│  Presentation  (src/app/, src/components/)      │
├─────────────────────────────────────────────────┤
│  Application   (src/lib/<domain>/)              │
├─────────────────────────────────────────────────┤
│  Domain        (src/lib/confidence/, fpl/)      │
├─────────────────────────────────────────────────┤
│  Infrastructure (src/lib/db/, cache/)           │
└─────────────────────────────────────────────────┘
```

Dependencies flow downward only. Domain code is pure — no `fetch`, no `Date.now()`, no DB. Infrastructure code is thin — no business logic. Presentation never imports from Infrastructure directly.

The full rules are in `docs/ENGINEERING.md §1`. Read it before writing any code.

---

## 4. The Confidence algorithm — the product's core

The Confidence calculator lives in `src/lib/confidence/`. It is a pure function: same inputs, same outputs, every time. No I/O. All non-determinism is injected by the caller.

**Do not modify this algorithm without explicit approval.** `docs/ALGORITHM.md` is the source of truth and doubles as the canonical test specification — every worked example in that document is a passing unit test.

### 4.1 How it works

Confidence is a rolling score per player, updated per match the player appeared in (missed matches are skipped — no decay). After each match, confidence is clamped to `[−4, +5]`. The asymmetric range is intentional: a player at the floor should be able to reach neutral in a realistic recovery stretch; `+5` is deliberately scarce.

| Event                                                       | FDR ≤ 3 (easy) | FDR ≥ 4 (hard) |
| ----------------------------------------------------------- | -------------- | -------------- |
| MOTM (1+ goals or 2+ assists)                               | +2             | +3             |
| Performance (exactly 1 assist, 0 goals)                     | +1             | +2             |
| Blank (0 G/A)                                               | −2             | −1             |
| Clean sheet (GK/DEF only)                                   | +1             | +2             |
| DefCon (defensive contribution threshold, Blank substitute) | +1             | +2             |
| SaveCon (4+ saves, GK only, Blank substitute)               | +1 flat        | +1 flat        |

**Fatigue:** after 3 MOTM performances, apply −2 (intermediate-clamp rule) and reset the counter. Independent fatigue counters also exist for DefCon and SaveCon.

**FDR replaces "big team":** the binary big-team flag is gone. Fixture Difficulty Rating (1–5 integer from FPL's fixtures endpoint) determines the multiplier. Arsenal (ID 1) has a hard override to FDR 5 as of v1.7.1.

**Current algorithm version:** v1.7.2. See the changelog at the top of `docs/ALGORITHM.md`.

### 4.2 Hot Streak indicator

A Hot Streak fires when a player's `eventMagnitude` (raw multiplier output before any clamp) for a single match is ≥ 3. It has two dimensions:

- **Color** = boost magnitude (hot/warm/mild, based on eventMagnitude ≥ 5 / ≥ 4 / ≥ 3)
- **Intensity** = recency (full, ~70%, ~40% opacity, based on matches since the streak: 0, 1, 2)

An empirical analysis (`docs/analysis/hot-streak-predictive-value.md`) confirmed the signal is real: post-streak return rate is 22.1% vs 11.1% baseline — a 2x lift with p < 0.001.

Note: `eventMagnitude` was added in v1.7.2 specifically because `rawDelta` had a ceiling-absorption defect (a player near +5 getting a Big MOTM would show `rawDelta=4` instead of 5, displaying a warm flame instead of hot).

---

## 5. The database — migration history and current state

### 5.1 SQLite → Supabase Postgres

The original architecture used `better-sqlite3` with a local `data/fpl.db` file. This was the right call for a single-server, single-user app.

The migration to Supabase Postgres happened in commit `aadf94c`. The rationale: Vercel serverless functions are stateless and cannot reliably share a file-based SQLite database across invocations; the cron sync pipeline requires concurrent reads and writes across different function instances.

The migration preserved the repository interface pattern, so most code above the infrastructure layer was unchanged.

### 5.2 Dual-path infrastructure

`src/lib/db/server.ts` `getRepositories()` detects whether `DATABASE_URL` is set:

- **If set:** uses `PostgresManagerSquadRepository` and siblings via `postgres.js` (transaction-mode pooler, `prepare: false`)
- **If not set:** falls back to `better-sqlite3` with a local file

This allows local development without a Supabase connection. Tests use the SQLite path with temp files.

In production, `DATABASE_URL` points to the Supabase transaction-mode pooler (port 6543). The connection user has `BYPASSRLS=true`, so Row Level Security is irrelevant for all server-side operations that go through `getRepositories()`.

### 5.3 Vestigial `user_id` column in `manager_squads`

The `manager_squads` table has a `user_id INTEGER NOT NULL DEFAULT 1` column that is no longer used. It exists from the original single-user architecture. It is not in `DbManagerSquadPick`, not in `PostgresManagerSquadRepository`'s column lists, and not referenced anywhere in application code.

**Do not remove it yet.** The migration to full multi-user (Phase 2) will change the primary key of `manager_squads` from `(team_id, gameweek, squad_position)` to `(user_id, team_id, gameweek, squad_position)`, where `user_id` becomes a UUID foreign key to `auth.users`. The full schema change is documented in `docs/v2/multi-user-decisions.md §Decision 3`. That migration requires a maintenance window.

### 5.4 RLS — what is and isn't protected

Applied by `supabase/migrations/0002_phase4_auth_rls.sql`:

| Table                                      | Policy                                                        |
| ------------------------------------------ | ------------------------------------------------------------- |
| `players`, `teams`, `confidence_snapshots` | Public SELECT; service-role writes                            |
| `sync_meta`, `users`, `manager_squads`     | Service-role only (no permissive policies)                    |
| `watchlist`                                | Per-user: `auth.uid() = auth_user_id` on SELECT/INSERT/DELETE |
| `user_profiles`                            | Per-user SELECT + UPDATE; service-role INSERT                 |

The `manager_squads` table being service-role-only is intentional for Phase 4. It's a global squad cache — all users share it. Phase 2 will add real per-user isolation when the PK changes.

---

## 6. Authentication — current state

### 6.1 What was built

Authentication uses Supabase Auth (`@supabase/ssr`). Key files:

| File                                   | Purpose                                                                    |
| -------------------------------------- | -------------------------------------------------------------------------- |
| `src/lib/supabase/browser.ts`          | Singleton browser client with explicit `getAll/setAll` cookie methods      |
| `src/lib/supabase/server.ts`           | Server client that reads cookies from Next.js `cookies()`                  |
| `src/components/auth/AuthContext.tsx`  | Client-side auth state (session, user, `isPanelOpen`)                      |
| `src/components/auth/AuthPanel.tsx`    | Slide-over panel with sign-in / create-account tabs                        |
| `src/components/auth/AuthButton.tsx`   | Topbar button that opens the panel or shows the signed-in avatar           |
| `src/app/actions/createUserProfile.ts` | Server action that creates a `user_profiles` row on sign-up (service-role) |
| `src/app/api/watchlist/route.ts`       | Watchlist CRUD, Supabase cookie-auth, per-user rows                        |

### 6.2 Known architectural edge cases

**WatchlistCard stale auth state (documented in `docs/ARCHITECTURE_NOTES.md §1`):** After a client-side sign-in via AuthPanel, the dashboard's server-rendered `WatchlistCard` remains in the "not authenticated" state for the lifetime of that render. It self-corrects on the next navigation. A `router.refresh()` would fix it but causes a visible flash. The current UX is acceptable and intentional.

**WatchlistContext fetch-on-mount only (documented in `docs/ARCHITECTURE_NOTES.md §2`):** `WatchlistContext` fetches watchlist IDs once on mount and does not subscribe to auth state changes. After a client-side sign-in, star buttons show as un-starred until the next navigation. Same self-correction behavior.

These are known, documented, and intentionally deferred. Do not add `router.refresh()` or a full context subscription without understanding the trade-offs in the architecture notes.

### 6.3 `user_profiles` table

Created on sign-up by `createUserProfileAction`. Stores the user's FPL manager ID (nullable until they link it in Settings) and a display name. This is the bridge between Supabase Auth UUIDs and FPL team IDs.

The `fpl_manager_id` column here is the mechanism by which My Team will eventually be tied to an authenticated user rather than a session-stored team ID. That work is Phase 2.

---

## 7. FPL API — characteristics and constraints

The FPL API is undocumented, unauthenticated, and protected by Cloudflare.

**Public endpoints** (`bootstrap-static`, `element-summary`, `fixtures`) are reliable from any IP, including Vercel datacenter IPs.

**User-specific endpoints** (`entry/{id}/`, `entry/{id}/event/{gw}/picks/`) behave differently. Testing has shown they work from the default Vercel region (iad1). Headers mimicking a real browser request are included in all fetches:

```typescript
// src/lib/fpl/api.ts
headers: {
  'User-Agent': 'Mozilla/5.0 ...',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-GB,en;q=0.9',
  Referer: 'https://fantasy.premierleague.com/',
  Origin: 'https://fantasy.premierleague.com',
}
```

**Do not change the Vercel deployment region.** A previous attempt to move to `lhr1` (London) made the user-specific endpoints fail. The default region (iad1) is proven to work. The `vercel.json` currently has no `regions` field — that is correct.

All FPL responses are validated through Zod schemas in `src/lib/fpl/schemas.ts` before use. The API client returns `Result<T, FetchError>` — it never throws. Every fetch path from the API to the DB goes through this Result pattern.

**Caching:** `bootstrap-static` cached 1 hour, `element-summary` 6 hours, `fixtures` 1 hour, user-specific endpoints 1 hour. These are Next.js Data Cache revalidation times passed to `fetch({ next: { revalidate: N } })`.

---

## 8. The cron sync pipeline

**`GET /api/cron/sync`** — triggered daily at 12:00 UTC by Vercel Cron (configured in `vercel.json`).

The pipeline:

1. Reads all players and teams from `bootstrap-static`
2. For each player, fetches `element-summary` for match history
3. Runs the Confidence calculator per player
4. Upserts `confidence_snapshots` to the DB
5. Writes `sync_meta.current_gameweek` and `sync_meta.last_sync`

The cron endpoint uses a concurrency guard (conditional UPSERT on `sync_state`) to prevent overlapping invocations on the Vercel Hobby tier.

**If the cron has not run since a gameweek finished**, confidence data will be stale. The `syncedAt` timestamp in the My Team response and the Dashboard staleness indicator surface this to the user.

The cron route is at `src/app/api/cron/sync/route.ts`. Authorization is via `CRON_SECRET` environment variable.

---

## 9. Recent incident — production outage 2026-05-02

### What happened

Commit `cf3338a` (auth phase staging) broke `GET /api/my-team` for all team IDs. The endpoint returned `500` with an empty body and `null` Content-Type.

### Root cause

`PostgresManagerSquadRepository.upsertMany` had an invalid SQL construction after the auth commit removed `user_id` from the operation:

```typescript
// BROKEN — postgres.js sql(values) generates (col1, col2) VALUES (...) from object keys.
// Adding an explicit column list creates a duplicate column list → Postgres syntax error.
await this.sql`
  INSERT INTO manager_squads
    (team_id, gameweek, player_id, squad_position, is_captain, is_vice_captain, fetched_at)
  ${this.sql(values)}  -- ← also generates the column list
  ON CONFLICT ...
`;
```

The fix (`7366c71`) is a one-line change:

```typescript
// CORRECT — sql(values) generates the column list from object keys.
// user_id not in the objects → DB DEFAULT 1 applies.
await this.sql`
  INSERT INTO manager_squads ${this.sql(values)}
  ON CONFLICT ...
`;
```

The `upsertMany` call is `await`-ed in the route handler without a surrounding try/catch, so the Postgres exception propagated as an unhandled exception → 500 empty body.

### Three lessons for the incoming architect

**1. `postgres.js` tagged template interpolation is not string concatenation.** `${sql(values)}` generates its own column list and VALUES clause from the object's keys. Never prepend an explicit column list in the SQL text when using this interpolation. If you need to select specific columns, pass them as additional arguments: `sql(values, 'col1', 'col2')`.

**2. Test the infrastructure layer in production parity before committing auth or schema changes.** The pre-auth iad1 deployment returned 200. The post-auth iad1 deployment returned 500. A 10-minute isolation test (two curl commands against two Vercel preview deployments) would have caught this before it hit production. The FPL geo-blocking hypothesis was investigated for hours based on wrong evidence. Isolation tests first.

**3. `upsertMany` and other DB writes in route handlers should be wrapped in try/catch.** An unhandled DB exception produces a 500 with no body — completely opaque to the client and hard to diagnose from logs. Wrap all DB operations in the route handler in try/catch and return a typed error response.

---

## 10. Open work items — what the previous architect left incomplete

### 10.1 Immediate (bugs / tech debt)

| Item                                                                            | File                            | Status                                                        |
| ------------------------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------- |
| Vestigial `user_id` column in `manager_squads`                                  | `0001_initial_schema.sql`       | Cannot remove until Phase 2 PK migration                      |
| Duplicate test files with spaces in names (`cronSync 2.ts`, `route 2.ts`)       | root                            | These cause spurious lint errors; delete the ` 2.ts` variants |
| WatchlistCard stale auth after client-side sign-in                              | `docs/ARCHITECTURE_NOTES.md §1` | Intentionally deferred; acceptable UX                         |
| WatchlistContext fetch-on-mount only                                            | `docs/ARCHITECTURE_NOTES.md §2` | Intentionally deferred; acceptable UX                         |
| DGW staleness false-positive for players with only a DGW row in the 3-GW window | `docs/ARCHITECTURE_NOTES.md §3` | Fixed in commit `914f826`; no action needed                   |

### 10.2 Phase 2 — real multi-user (requires owner approval before starting)

The current auth infrastructure supports creating an account and a `user_profiles` row. It does **not** yet tie the My Team page to the authenticated user's FPL team ID. That is Phase 2.

Phase 2 requires three decisions documented in `docs/v2/multi-user-decisions.md`:

- **Auth provider:** Supabase Auth is already in place (the multi-user-decisions doc predates this choice and still recommends NextAuth). The decision has effectively been made. No action needed.
- **Database host:** Supabase Postgres is already in place (the doc recommends Turso). Same situation — decision made. No action needed.
- **User data model:** The `manager_squads` primary key must change from `(team_id, gameweek, squad_position)` to `(user_id, team_id, gameweek, squad_position)` where `user_id` is a UUID FK to `auth.users`. This requires a maintenance-window migration. The full migration SQL is in `docs/v2/multi-user-decisions.md §Decision 3`.

**The Phase 2 `manager_squads` migration is the most consequential pending DB change.** Until it runs, My Team data is not per-user — all users looking up the same `teamId` share the same cached rows.

### 10.3 Probability module — hidden, not deleted

A probability calculator (`src/lib/probability/`) predicts P(Goal) and P(Assist) for each player's next fixture. It works and its tests are green. **Its UI surfaces are hidden.** The decision to hide it is documented in `docs/v2/probability-metrics-deferred.md`.

**Why it's hidden:** The model has a structural ceiling because the FPL API does not expose xG/xA per match. ICT-derived signals cannot break the calibration ceiling. The calibration failure modes are documented in `docs/v2/calibration-results.md`. Reactivate this work only when a reliable xG/xA data source becomes available.

The metric toggle spec (`docs/v2/metric-toggle-spec.md`) documents how probability metrics would be surfaced when the model is ready: a `C / G / A` pill switcher in the topbar, with URL-persisted state (`?metric=g`).

### 10.4 Algorithm — no pending changes

The algorithm is at v1.7.2. There are no known defects and no pending changes. The changelog is at the top of `docs/ALGORITHM.md`. Do not modify the algorithm without reading the full document and running the full test suite.

---

## 11. How to make decisions

### 11.1 Document precedence

When documents conflict, this is the resolution order:

1. `docs/ENGINEERING.md` — architecture and quality bar
2. `PLANNING.md` — product spec and build order
3. `docs/ALGORITHM.md` — Confidence calculation (do not deviate without approval)
4. `docs/TESTING.md` — testing strategy and coverage floors
5. `docs/UI_GUIDELINES.md` — design system
6. `docs/API.md` — FPL API contracts

### 11.2 Before touching the algorithm or the DB schema

**Stop and get approval.** Both are high-blast-radius. The algorithm has 15+ unit test examples that serve as regression anchors. The DB schema change for `manager_squads` requires a maintenance window.

### 11.3 Before adding a dependency

Write one sentence: what problem does this solve, and why can't it be solved with existing tools? Await confirmation before installing.

### 11.4 Before merging any PR

Run the Definition of Done checklist in `docs/ENGINEERING.md §10`. All 14 items must be true. There is no partial credit.

---

## 12. Local development setup

```bash
npm install
cp .env.example .env.local   # fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
                              # SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL, CRON_SECRET
npm run dev                  # starts on localhost:3000
npm test                     # vitest unit tests
npm run test:coverage        # coverage report (floor: 90% src/lib/, 70% src/components/)
npm run typecheck            # tsc --noEmit
npm run lint                 # eslint, zero warnings policy
npm run test:e2e             # playwright (requires `npm run build && npm start` first)
```

If `DATABASE_URL` is not set in `.env.local`, the app falls back to SQLite (`data/fpl.db`). This is useful for offline development but the schema may drift from Supabase if migrations are not applied.

Pre-commit hooks (Husky + lint-staged) run typecheck, ESLint, and Prettier on staged files. Do not use `--no-verify`.

---

## 13. Contacts and external resources

| Resource                | Location                                                      |
| ----------------------- | ------------------------------------------------------------- |
| Vercel project          | Linked to this repo's `main` branch; auto-deploys on push     |
| Supabase project        | Credentials in env vars; migrations in `supabase/migrations/` |
| FPL API                 | `https://fantasy.premierleague.com/api/` — no auth, no key    |
| Hot streak analysis     | `docs/analysis/hot-streak-predictive-value.md`                |
| Probability calibration | `docs/v2/calibration-results.md`                              |

The FPL API has no SLA. It goes down during transfer windows and after gameweeks finish. Build defensively: all fetches return `Result<T, FetchError>`, and the sync pipeline is idempotent and restartable.
