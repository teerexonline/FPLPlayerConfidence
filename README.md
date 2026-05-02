# FPL Confidence

A Fantasy Premier League companion app that tracks player form through a custom Confidence metric.

## What is Confidence?

Each player carries a Confidence score in the range `−5` to `+5`. After every gameweek the score shifts up or down based on what happened — MOTM performances, clean sheets, blanks, double gameweek bonuses, fatigue, and opponent difficulty. A score above zero means the player is in good form; below zero means they're struggling. The full calculation is in `docs/ALGORITHM.md`.

## Running locally

```bash
npm install
npm run dev          # dev server at http://localhost:3000
npm run build        # production build
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm test             # vitest unit + integration tests
npm run test:watch   # vitest in watch mode
npm run test:coverage
npm run test:e2e     # playwright (requires dev or preview server)
```

Data lives in a single SQLite file at `data/fpl.db`. Run a sync via Settings → Refresh data to populate it on first use.

## Before merging Supabase migration changes

Run the RLS verification suite against the live database:

```bash
npm run test:rls
```

This applies `supabase/migrations/0002_phase4_auth_rls.sql` (idempotent) and runs 20 assertions verifying that:

- Anonymous users can read public tables (`players`, `teams`, `confidence_snapshots`) and are blocked from everything else
- Authenticated users can read/write only their own `watchlist` rows and cannot spoof another user's `auth_user_id`
- `user_profiles` is service-role-only for INSERT; authenticated users can SELECT and UPDATE their own row

**How it works:** The script reads `.env.local` for `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `DATABASE_URL`. Test users (User A and User B) are created per-run via the Supabase Admin API and deleted at the end — no hardcoded accounts, no shared state between runs. Anyone with repo access and a valid `.env.local` can reproduce the results.

## v1 scope (shipped)

- **Dashboard** — Biggest Risers/Fallers, Watchlist placeholder, My Team confidence widget, position-tabbed Leaderboard (All/GK/DEF/MID/FWD)
- **Players list** — sortable, filterable table of all players with sparkline trend
- **Player detail** — full confidence trajectory chart, match-by-match history strip (DGW rendered as split dual-card), positional stats
- **My Team** — connect FPL team ID to see squad confidence, Starting XI breakdown, positional percentages
- **Settings** — theme (system/light/dark), FPL data sync trigger, team connection management

## v2 queue

- Watchlist — pin players and track them across gameweeks
- Transfer suggestions — compare confidence deltas for buy/sell decisions
- Historical season archive — store and compare across multiple seasons
- Push alerts — notify when a pinned player's confidence crosses a threshold

## For Claude Code

Read these files before writing any code:

1. `CLAUDE.md` — operating rules and mandatory skills
2. `docs/ENGINEERING.md` — code quality bar
3. `PLANNING.md` — product spec and build order
4. `docs/ALGORITHM.md` — the confidence calculation
5. `docs/TESTING.md` — testing strategy and coverage requirements
6. `docs/UI_GUIDELINES.md` — design system
7. `docs/API.md` — FPL API reference

## Quality gates

- Coverage floor: 90% on `src/lib/`, 70% on `src/components/`
- Lighthouse: Performance >= 90, Accessibility >= 95
- axe-core: zero violations on every page
- TypeScript: zero errors, zero warnings, no `any`
