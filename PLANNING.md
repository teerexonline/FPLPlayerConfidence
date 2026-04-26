# FPL Confidence — Project Plan

> A Fantasy Premier League companion app that predicts player return likelihood using a custom **Confidence** metric (`-5` to `+5`). **UI is the top priority. Engineering quality is the floor.**

---

## 1. Product Vision

**One-line pitch:** "Don't pick by points. Pick by confidence."

FPL managers obsess over xG, form, and fixtures, but those signals are noisy. **Confidence** is a single, opinionated number from `-5` to `+5` that tells you whether a player is trending toward a return. Above `0` = back them. Below `0` = bench or transfer.

**Target user:** FPL managers who want a clean, glanceable second-opinion tool — not another spreadsheet.

**Design north star:** Linear / Arc / Things 3 — minimal, confident, fast. Every screen should feel intentional.

**Engineering north star:** principal-engineer-grade code at a Big Four / FAANG-tier company. See `docs/ENGINEERING.md` for the bar.

---

## 2. Operating principles

These are non-negotiable. Every decision is checked against them.

1. **Engineering quality is the floor, not the ceiling.** All code follows `docs/ENGINEERING.md`.
2. **Test-driven development for all logic.** All `src/lib/` code is written test-first. See `docs/TESTING.md`.
3. **The `frontend-design` skill is used on every UI task.** No exceptions.
4. **UI is the #1 product priority.** When in doubt, choose beauty.
5. **One clear authority per concern.** ALGORITHM.md owns the math, ENGINEERING.md owns the architecture, TESTING.md owns the tests, UI_GUIDELINES.md owns the design system. They don't contradict each other; if they appear to, the precedence in CLAUDE.md decides.

---

## 3. The Confidence Algorithm (summary)

> Full spec, edge cases, and 14+ unit-test examples in `docs/ALGORITHM.md`.

Confidence is a rolling score per player, starting at `0`, updating per match the player appeared in (missed matches skipped), clamped to `[-5, +5]` after every update.

| Event                            | vs Big | vs Non-Big |
| -------------------------------- | ------ | ---------- |
| Performance (1 assist, 0 goals)  | +2     | +1         |
| MOTM (1+ goals OR 2+ assists)    | +3     | +2         |
| Blank (0 G/A)                    | −1     | −2         |
| Clean sheet (GK/DEF only)        | +2     | +1         |
| Assist (GK/DEF, treated as MOTM) | +3     | +2         |

**Fatigue:** after 3 cumulative MOTM performances, apply −2 once and reset the counter.

**Big team:** configurable, defaults to top 6 of last completed PL season.

---

## 4. Tech Stack

Locked. See `CLAUDE.md` for the full list and forbidden libraries.

- Next.js 15 (App Router) + TypeScript (strict + `noUncheckedIndexedAccess`)
- Tailwind CSS v4 + shadcn/ui
- Motion (formerly Framer Motion)
- Recharts (heavily restyled)
- better-sqlite3
- Vitest + Testing Library + MSW + Playwright
- ESLint flat config + `@typescript-eslint/strict-type-checked` + Prettier
- Geist Sans (UI) + Fraunces (display)

---

## 5. Data Sources

See `docs/API.md` for endpoint contracts, caching rules, and the SQLite schema.

- Public FPL API: `bootstrap-static`, `element-summary/{id}`, `fixtures`
- FPL entry endpoint: `entry/{team_id}/event/{gw}/picks/` for manager squad picks (see `docs/API.md` §8)
- Premier League CDN for jerseys/badges (cached locally)
- All responses validated through Zod before use

---

## 6. Information Architecture

Five screens. Resist scope creep.

1. **Dashboard** (`/`) — Top movers, watchlist, gameweek overview, Team Confidence hero
2. **Players** (`/players`) — Sortable, filterable, virtualized table
3. **Player detail** (`/players/[id]`) — Match-by-match confidence history
4. **My Team** (`/my-team`) — Personal squad confidence breakdown by position
5. **Settings** (`/settings`) — Edit Big Team list, theme, cache

---

## 7. UI Direction

> Full design system, screen briefs, and component patterns in `docs/UI_GUIDELINES.md`.

- One number, hero-treated. Confidence is the protagonist of every screen.
- Restraint over decoration. No gradients on everything, no glassmorphism.
- Information density done right. Linear's issue list as reference.
- Color carries meaning only. Green = positive, red = negative, gray = zero.
- Motion only on state change. Numbers count up; no decorative scroll animations.

---

## 8. Project Structure

```
fpl-confidence/
├── CLAUDE.md
├── PLANNING.md
├── README.md
├── docs/
│   ├── ENGINEERING.md
│   ├── TESTING.md
│   ├── ALGORITHM.md
│   ├── UI_GUIDELINES.md
│   └── API.md
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                      # Dashboard
│   │   ├── players/
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── my-team/page.tsx
│   │   └── settings/page.tsx
│   ├── components/
│   │   ├── ui/                           # shadcn primitives
│   │   ├── confidence/
│   │   │   ├── ConfidenceNumber.tsx
│   │   │   ├── ConfidenceNumber.test.tsx
│   │   │   ├── ConfidenceBadge.tsx
│   │   │   ├── ConfidenceBadge.test.tsx
│   │   │   ├── ConfidenceSlider.tsx
│   │   │   ├── ConfidenceSlider.test.tsx
│   │   │   └── ConfidenceTrend.tsx
│   │   ├── player/
│   │   │   ├── PlayerCard.tsx
│   │   │   ├── PlayerRow.tsx
│   │   │   ├── PlayerJersey.tsx
│   │   │   └── MatchHistoryCard.tsx
│   │   └── layout/
│   │       ├── Topbar.tsx
│   │       └── ThemeToggle.tsx
│   ├── lib/
│   │   ├── confidence/
│   │   │   ├── index.ts                  # public barrel
│   │   │   ├── calculator.ts
│   │   │   ├── calculator.test.ts
│   │   │   ├── types.ts
│   │   │   ├── README.md                 # module purpose & invariants
│   │   │   ├── __fixtures__/
│   │   │   │   └── matches.ts
│   │   │   └── internal/
│   │   │       ├── fatigue.ts
│   │   │       └── fatigue.test.ts
│   │   ├── team-confidence/
│   │   │   ├── index.ts                  # public barrel
│   │   │   ├── teamCalculator.ts
│   │   │   ├── teamCalculator.test.ts
│   │   │   ├── types.ts
│   │   │   └── README.md
│   │   ├── fpl/
│   │   │   ├── index.ts
│   │   │   ├── api.ts
│   │   │   ├── api.test.ts
│   │   │   ├── schemas.ts                # Zod schemas
│   │   │   ├── types.ts
│   │   │   ├── cache.ts
│   │   │   └── README.md
│   │   ├── db/
│   │   │   ├── index.ts
│   │   │   ├── client.ts
│   │   │   ├── client.test.ts
│   │   │   ├── schema.sql
│   │   │   ├── migrations/
│   │   │   └── README.md
│   │   ├── logger/
│   │   │   ├── index.ts
│   │   │   └── logger.ts
│   │   ├── hooks/
│   │   └── utils/
│   ├── styles/globals.css
│   └── test/
│       ├── setup.ts                      # vitest setup, jest-axe, MSW
│       └── msw/
│           ├── handlers.ts
│           └── fixtures/
├── e2e/
│   ├── dashboard.spec.ts
│   ├── players-list.spec.ts
│   ├── player-detail.spec.ts
│   ├── my-team.spec.ts
│   └── settings.spec.ts
├── public/
│   ├── jerseys/                          # cached shirts
│   └── badges/
├── data/
│   └── fpl.db
├── playwright.config.ts
├── vitest.config.ts
├── eslint.config.mjs
├── tsconfig.json
└── package.json
```

---

## 9. Build Order (sequential — do not skip)

Each step ends with a stop-and-show checkpoint. Don't begin step N+1 without confirmation.

### Step 0 — Foundation ✓ DONE

- Initialize Next.js 15 with TypeScript strict + `noUncheckedIndexedAccess`
- Configure ESLint flat config with `strict-type-checked`, Prettier, Tailwind plugin
- Configure Vitest with coverage, jest-axe, MSW
- Configure Playwright
- Set up CI workflow (`.github/workflows/ci.yml`) running typecheck, lint, test, build, e2e
- Add `.editorconfig`, commit hooks (Husky + lint-staged) running typecheck + lint + test on staged files
- **Checkpoint:** show me the green CI run on a no-op commit.

### Step 1 — Design system foundation ✓ DONE

- **Use the `frontend-design` skill.**
- Install Geist Sans + Fraunces, configure in `app/layout.tsx`
- Define color tokens, typography scale, spacing scale per `docs/UI_GUIDELINES.md` in `globals.css`
- Build a `/_dev/styles` page that renders every token, every typography level, and every component variant for visual review
- **Checkpoint:** I review the styles page in light + dark.

### Step 2 — Confidence calculator (TDD) ✓ DONE

- Write `docs/ALGORITHM.md`-driven tests in `calculator.test.ts` first. All 14 worked examples + 3 property tests.
- Confirm all tests fail.
- Implement `calculator.ts` to make them pass.
- Add `internal/fatigue.ts` if extraction is warranted.
- Coverage: 100% on this module.
- **Checkpoint:** show test output and coverage report.

### Step 3 — FPL API client ✓ DONE

- Define Zod schemas for `bootstrap-static`, `element-summary`, `fixtures`
- Implement `api.ts` returning `Result<T, FetchError>`
- Cache layer (in-memory + Next.js fetch cache)
- Test with MSW + recorded fixture responses
- **Checkpoint:** integration tests green, manual smoke against real API.

### Step 4 — SQLite layer ✓ DONE

- Schema from `docs/API.md`
- Migration runner
- `client.ts` exposing typed query helpers (parameterized only)
- Integration tests with temp DB files
- **Checkpoint:** tests green.

### Step 5 — Confidence sync pipeline ✓ DONE

- Application-layer module that orchestrates: fetch → validate → calculate → persist
- Idempotent, restartable
- Tests with MSW + temp DB
- **Checkpoint:** run end-to-end, inspect DB.

### Step 6 — `ConfidenceNumber` component (the hero) ✓ DONE

- **Use the `frontend-design` skill.**
- Three sizes (sm/md/xl), three sign states, animated mount
- Component tests + axe test
- Render in `/_dev/styles`
- **Checkpoint:** I review and sign off on this component before any other UI work.

### Step 7 — Players list page ✓ DONE

- **Use the `frontend-design` skill.**
- Virtualized table, filters, search
- Component tests for filter logic
- E2E test for search → navigate
- Lighthouse Performance ≥ 90
- **Checkpoint:** I review on mobile and desktop.

### Step 8 — Player detail page ✓ DONE

- **Use the `frontend-design` skill.**
- Hero confidence + slider + match history strip + chart + breakdown
- Component tests
- E2E test for navigation
- **Checkpoint:** I review.

### Step 9 — Dashboard ✓ DONE

- **Use the `frontend-design` skill.**
- Hero strip + leaderboard preview + watchlist
- Team Confidence hero (conditionally rendered when team ID is set)
- Empty states designed (the watchlist starts empty; no team linked → hero hidden)
- E2E test for cold-start render
- **Checkpoint:** I review.

### Step 9.5 — Team Confidence calculator (TDD) ✓ DONE

- Write `docs/ALGORITHM.md` §11-driven tests in `teamCalculator.test.ts` first. All 6 TEAM-EX worked examples + 3 TEAM-PROP property tests.
- Confirm all tests fail.
- Implement `teamCalculator.ts` to make them pass.
- Coverage: 100% on this module.
- **Checkpoint:** show test output and coverage report.

### Step 9.7 — My Team page ✓ DONE

- **Use the `frontend-design` skill.**
- Empty state (no team ID): input + CTA, designed and tested
- Loaded state: Team % hero + positional breakdown + Starting XI list + Bench section
- Fetch via entry picks endpoint (`docs/API.md` §8), store in `manager_squads` table
- Component tests for empty → loaded transition; axe test
- E2E test: enter team ID → see squad
- **Checkpoint:** I review.

### Step 10 — Settings + recompute ✓ DONE

- **Use the `frontend-design` skill.**
- Big team toggles, cache controls, theme
- FPL team ID field (persisted to localStorage, validated via Zod on read)
- Triggering a recompute updates all confidence values
- E2E test for big-team toggle → recompute
- **Checkpoint:** I review.

### Step 12 — Polish & a11y pass ✓ DONE

- Empty / loading / error states audited across every page
- Keyboard navigation full pass — focus-visible rings on all interactive elements
- axe-core green on every page — zero violations, tests in every component
- Lighthouse: Performance ≥ 90, Accessibility ≥ 95 on every page (manual run skipped; trusted from axe + tests)
- Position-tabbed leaderboard (All/GK/DEF/MID/FWD), URL-persisted
- DGW snapshots rendered as split dual-card layout
- Chart Y-axis clipping and X-axis tick distribution fixed
- ConfidenceTrend no-data vs neutral-delta visual distinction
- Dashboard hero strip card heights equalized (orphaned whitespace eliminated)
- README updated with plain-English overview, v1 scope, v2 queue
- **Checkpoint:** signed off 2026-04-26.

---

## 10. Definition of Done (project-level)

- [ ] Confidence calculator passes all unit tests in `docs/ALGORITHM.md` (15 cases + 3 property tests)
- [ ] Team Confidence calculator passes all TEAM-EX and TEAM-PROP tests in `docs/ALGORITHM.md` §11
- [ ] Coverage ≥ 90% on `src/lib/`, ≥ 70% on `src/components/`
- [ ] All five screens responsive at 375px / 768px / 1280px
- [ ] Dark mode fully designed, not auto-inverted
- [ ] Lighthouse Performance ≥ 90, Accessibility ≥ 95 on every route
- [ ] axe-core has zero violations on every page
- [ ] Big-team list editable, triggers recompute
- [ ] FPL team ID linkable; My Team page shows live squad breakdown
- [ ] Cmd+K player search works
- [ ] No `any`, no `!`, no `console.log` in source
- [ ] Every module under `src/lib/` has a README
- [ ] CI is green
- [ ] E2E suite green on Chromium + WebKit

---

## 11. Out of Scope

- User accounts / login
- Push notifications
- Multi-season historical data
- Mobile native app
- Social features / sharing

If any of these come up, file as `// TODO(v2):` and move on.
