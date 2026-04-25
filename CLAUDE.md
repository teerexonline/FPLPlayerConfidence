# CLAUDE.md

This file is loaded automatically by Claude Code at the start of every session. It is the project's operating manual. **Read it fully before doing anything.**

---

## Engineering bar

This codebase is written to a **principal-engineer standard** — the kind of work expected at a Big Four / FAANG-tier company. That means:

- Every module has a single, well-defined responsibility.
- Every public function is typed, documented, and tested.
- Every architectural decision is intentional and defensible.
- No "we'll fix it later" code. No commented-out blocks. No `console.log` left behind.
- Code reads like prose. If a reviewer needs a comment to understand _what_ it does, the code is wrong. Comments explain _why_, not _what_.

**If you cannot meet this bar on a given task, stop and tell me. Do not lower the bar silently.**

The full engineering standards are in **`docs/ENGINEERING.md`**. Read it before writing any code.

---

## Mandatory skills

You **must** use the following skills on every relevant task. These are not suggestions.

### 1. `frontend-design` — for ALL UI work

Any time you create or modify a React component, page, layout, or styling, you **must** load and apply the `frontend-design` skill. This includes:

- Initial component scaffolding
- Visual polish passes
- Empty states, loading states, error states
- Theme tokens and typography
- Animations and micro-interactions

The skill enforces production-grade aesthetic quality. Generic AI-looking UI is a failure of this project.

> **Note on typography:** The frontend-design skill warns against generic fonts like Inter. For _this_ project, we override that with an intentional choice (see `docs/UI_GUIDELINES.md` §3): **Geist Sans** for UI and **Fraunces** for display accents. These are deliberate, not defaults. Do not change them without approval.

### 2. Testing discipline — for ALL logic and components

There is no first-party testing skill, so testing standards are codified in **`docs/TESTING.md`**. You must read and follow it. Summary:

- **Pure logic in `src/lib/`:** TDD. Write the failing test first, then the implementation. No exceptions for the Confidence calculator.
- **Components:** Vitest + Testing Library. Test behavior, not implementation. Every component with conditional rendering, user interaction, or async state needs a test.
- **Integration tests:** For data fetching and DB writes, use Vitest with a temp SQLite file.
- **Coverage floor:** 90% on `src/lib/`, 70% on `src/components/`. Below floor = task not done.

---

## Required reading order

Before writing any code, read these files in this order:

1. **`docs/ENGINEERING.md`** — architectural standards, code quality bar, review checklist
2. **`PLANNING.md`** — full product spec, build order
3. **`docs/ALGORITHM.md`** — Confidence calculation, with worked examples that double as test cases
4. **`docs/TESTING.md`** — testing strategy, tools, coverage requirements
5. **`docs/UI_GUIDELINES.md`** — design tokens, component patterns, visual rules
6. **`docs/API.md`** — FPL API endpoints, caching rules, jersey CDN

If any of these files conflict, the order above is the precedence: ENGINEERING > PLANNING > ALGORITHM > TESTING > UI_GUIDELINES > API.

---

## Core rules — non-negotiable

1. **Use the `frontend-design` skill on every UI task.** No exceptions.
2. **TDD on all `src/lib/` code.** Test first, implementation second. Commit them together.
3. **Never modify the Confidence algorithm without my approval.** ALGORITHM.md is the source of truth.
4. **Follow the build order in PLANNING.md §8.** Do not skip ahead. Stop and show results at each numbered step.
5. **No new dependencies without asking.** The stack is fixed (see Stack section). Adding anything else requires a one-line justification and my approval.
6. **No `any` types anywhere.** Not in `src/lib/`, not in `src/components/`, not in tests. Use `unknown` and narrow.
7. **No client-side hotlinking of remote images.** Jerseys/badges cached locally on first fetch (see `docs/API.md`).
8. **Empty, loading, and error states are real features.** Designed, tested, accessible. Skeleton loaders match the exact final layout — no spinners.
9. **Every PR must pass the Definition of Done checklist (`docs/ENGINEERING.md` §10).** No partial green builds.

---

## Stack (do not change)

- **Framework:** Next.js 15 (App Router) + TypeScript with `strict: true` and `noUncheckedIndexedAccess: true`
- **Styling:** Tailwind CSS v4 + shadcn/ui (New York style, neutral base)
- **Animation:** Motion (formerly Framer Motion) — sparingly
- **Icons:** Lucide React
- **Charts:** Recharts (heavily restyled)
- **State:** React Server Components + URL state. Zustand only with written justification.
- **Storage:** SQLite via `better-sqlite3` (single file at `data/fpl.db`)
- **Search palette:** `cmdk`
- **Virtualization:** `@tanstack/react-virtual`
- **Testing:** Vitest + Testing Library + `@vitest/coverage-v8` + Playwright (E2E for critical paths only)
- **Linting:** ESLint flat config + `@typescript-eslint/strict-type-checked` + Prettier
- **Fonts:** Geist Sans (UI), Fraunces (display)

**Forbidden:** Redux, tRPC, GraphQL, Prisma, NextAuth, any UI library other than shadcn, any CSS-in-JS solution.

---

## Working style

- **Plan before coding.** For any task larger than a single component, write a 3–5 bullet plan and wait for me to confirm.
- **Small commits.** One logical change per commit. Conventional Commits format (`feat:`, `fix:`, `chore:`, `refactor:`, `style:`, `test:`, `docs:`, `perf:`).
- **Test commits paired with implementation commits.** Either as one commit, or test commit immediately before implementation. Never implementation alone.
- **Show your work.** When you finish a step, summarize: what you did, what you didn't do, what's next, and any open questions.
- **Ask, don't assume.** If a spec is ambiguous, ask one specific question. Don't invent answers.
- **No README marketing copy.** No emoji-heavy headers. No "Getting Started" boilerplate unless requested.

---

## File and folder conventions

- React components: PascalCase, one component per file, colocated `Component.tsx` + `Component.test.tsx`.
- Hooks: `useThing.ts` in `src/lib/hooks/`, colocated test file.
- Pure logic: `src/lib/<domain>/` with `index.ts` barrel export and per-file tests.
- No default exports except for Next.js pages and layouts.
- Server-only code: `import 'server-only'` at top of file.
- Client-only code: `'use client'` directive — used as sparingly as possible.

---

## When you're stuck

If you've tried something twice and it isn't working, **stop and tell me**. Don't keep iterating blindly. Describe:

1. What you tried
2. What happened
3. What you'd try next
4. Whether you need a decision from me

---

## Pre-approved commands

```bash
npm install
npm run dev
npm run build
npm run lint
npm run typecheck
npm test
npm run test:watch
npm run test:coverage
npm run test:e2e
```

**Never run** `npm run db:reset`, `git push`, `git reset --hard`, or `rm -rf` on anything outside `node_modules` / `.next` / `dist` without explicit confirmation.
