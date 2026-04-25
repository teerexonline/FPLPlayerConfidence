# Engineering Standards

This document defines the engineering bar for this codebase. The goal is **principal-engineer-grade code** — the kind of work expected at a Big Four / FAANG-tier company. Every PR is reviewed against this document.

If you can't meet a standard, raise it as a question. Do not silently lower the bar.

---

## 1. Architectural principles

### 1.1 Layered architecture

The codebase is split into four layers. Dependencies flow **downward only**.

```
┌─────────────────────────────────────────────────┐
│  Presentation (src/app/, src/components/)       │  ← React, RSC, Tailwind
├─────────────────────────────────────────────────┤
│  Application (src/lib/<domain>/)                │  ← orchestration, use cases
├─────────────────────────────────────────────────┤
│  Domain (src/lib/confidence/, src/lib/fpl/)     │  ← pure business logic
├─────────────────────────────────────────────────┤
│  Infrastructure (src/lib/db/, src/lib/cache/)   │  ← I/O, persistence, network
└─────────────────────────────────────────────────┘
```

**Rules:**

- Domain code is **pure**. No `fetch`, no `Date.now()`, no `Math.random()`, no DB. Inject everything via parameters.
- Infrastructure code is **thin**. No business logic. Just I/O.
- Presentation never imports from Infrastructure directly. It goes through Application.
- A Domain module never imports from Presentation, Application, or Infrastructure.

### 1.2 Module boundaries

Every module under `src/lib/` is a self-contained unit:

```
src/lib/confidence/
├── index.ts              ← barrel export (public API)
├── calculator.ts         ← implementation
├── calculator.test.ts    ← colocated tests
├── types.ts              ← public type definitions
├── internal/             ← anything not in the barrel
│   ├── fatigue.ts
│   └── fatigue.test.ts
└── README.md             ← what this module does, in 3 paragraphs
```

**Rules:**

- Other modules import only from `index.ts`. Never reach into `internal/`.
- Every module has a `README.md` explaining its purpose, public API, and invariants.
- If a module exceeds ~600 lines total, split it.

### 1.3 Dependency injection

Anything non-deterministic — clocks, randomness, network, DB — is **injected**, never imported directly into domain code.

```ts
// ❌ Bad — hidden dependency on the system clock
export function isStale(updatedAt: number) {
  return Date.now() - updatedAt > 3_600_000;
}

// ✅ Good — clock is a parameter
export function isStale(updatedAt: number, now: number) {
  return now - updatedAt > 3_600_000;
}

// At the call site (infrastructure or application layer):
isStale(record.updatedAt, Date.now());
```

This makes domain code trivially testable and deterministic.

---

## 2. TypeScript standards

### 2.1 Compiler config

`tsconfig.json` must include:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "exactOptionalPropertyTypes": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

These are not negotiable. Loosening any of them requires a written justification.

### 2.2 Type rules

- **No `any`.** Use `unknown` and narrow with type guards.
- **No `as` casts** except for narrowing `unknown` after a runtime check, or for Zod-validated parsing output.
- **No non-null assertions (`!`).** If you "know" something isn't null, encode that in the type.
- **Discriminated unions over optional fields.** Prefer `{ status: 'loading' } | { status: 'ready'; data: T }` over `{ data?: T; loading: boolean }`.
- **Branded types for IDs.** A `PlayerId` should not be assignable to a `TeamId` even though both are numbers.

```ts
// types.ts
export type PlayerId = number & { readonly __brand: 'PlayerId' };
export type TeamId = number & { readonly __brand: 'TeamId' };
export const playerId = (n: number): PlayerId => n as PlayerId;
```

### 2.3 Runtime validation

Any data crossing a trust boundary (FPL API responses, localStorage reads, URL params) must be validated with **Zod** before use. Never trust `JSON.parse` output as the type you expect.

```ts
const ElementSchema = z.object({
  id: z.number().int().positive(),
  web_name: z.string().min(1),
  // …
});

const parsed = ElementSchema.parse(rawJson); // throws on bad data
```

---

## 3. Code quality

### 3.1 Naming

- **Functions:** verbs. `calculateConfidence`, not `confidenceCalculator`.
- **Booleans:** `is`/`has`/`should`/`can` prefix. `isBigTeam`, `hasCleanSheet`.
- **Types:** PascalCase nouns. `MatchEvent`, `CalculatorOutput`.
- **Constants:** SCREAMING_SNAKE_CASE only for module-level immutable primitives. Otherwise camelCase.
- **No abbreviations** unless they're industry-standard (`url`, `id`, `db`). `confidence` not `conf`. `gameweek` not `gw` (except in URLs).

### 3.2 Functions

- Functions do **one thing**. If you need the word "and" to describe what it does, split it.
- Max 4 parameters. If you need more, take an options object.
- Max ~40 lines. If longer, extract.
- Pure where possible. Side effects are localized to thin wrapper functions.

### 3.3 Comments

- Code reads like prose. Comments explain **why**, not **what**.
- Every public function has a TSDoc block: one-line summary, `@param` for non-obvious params, `@throws` if it can throw, `@example` if behavior is subtle.
- `// TODO`, `// FIXME`, `// HACK` are forbidden in main. Use GitHub issues. The only exception is `// TODO(v2):` for explicitly out-of-scope features.

### 3.4 Error handling

- **Never silently swallow errors.** Every `catch` either re-throws, logs with context, or transforms into a typed error result.
- **Use Result types for expected failures**, exceptions for bugs:

```ts
type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };
```

- Network calls and DB calls return `Result`, not raw promises.
- React error boundaries are required at the route level.

---

## 4. React standards

### 4.1 Component rules

- **Server Components by default.** Add `'use client'` only when you need interactivity, browser APIs, or hooks like `useState`.
- **Push `'use client'` to the leaves.** A static page should not have a `'use client'` directive at the top.
- **No prop drilling beyond two levels.** Use composition (children/slots) or context.
- **No business logic in components.** Components compose UI. Logic lives in `src/lib/`.
- **Props are objects, not positional.** Even single-prop components: `<ConfidenceNumber value={3} />`, not `<ConfidenceNumber>3</ConfidenceNumber>` unless the value is genuinely children.

### 4.2 Component anatomy

```tsx
// ConfidenceNumber.tsx
'use client';

import { motion, useMotionValue, animate } from 'motion/react';
import { cn } from '@/lib/utils';
import type { Confidence } from '@/lib/confidence/types';

export interface ConfidenceNumberProps {
  value: Confidence;
  size?: 'sm' | 'md' | 'xl';
  animated?: boolean;
  className?: string;
}

export function ConfidenceNumber({
  value,
  size = 'md',
  animated = true,
  className,
}: ConfidenceNumberProps) {
  // …
}
```

- Named export, never default (except Next.js pages/layouts).
- Props interface exported and named `<Component>Props`.
- Optional props have defaults at the destructure.
- `className` always accepted and merged with `cn`.

### 4.3 Forbidden patterns

- ❌ `useEffect` for data fetching. Use Server Components or Server Actions.
- ❌ `useState` for derived values. Compute inline or use `useMemo` only when measurably needed.
- ❌ Inline styles except for dynamic values that can't be expressed in classes.
- ❌ Tailwind utility soup with 15+ classes per element. Extract to a component.
- ❌ Wrapping shadcn primitives in trivial wrappers. Use them directly or replace them.

---

## 5. Performance budget

| Metric                     | Budget                                            |
| -------------------------- | ------------------------------------------------- |
| Lighthouse Performance     | ≥ 90                                              |
| Lighthouse Accessibility   | ≥ 95                                              |
| Largest Contentful Paint   | < 1.5s on 4G                                      |
| Time to Interactive        | < 2.5s on 4G                                      |
| Total client JS (gzipped)  | < 200 KB on the players page (the heaviest route) |
| Server response time (p95) | < 200ms for cached routes                         |

Every PR that touches the players list or dashboard must include a Lighthouse run in the description.

---

## 6. Accessibility

- All interactive elements keyboard-reachable with visible focus rings.
- Color contrast ≥ 4.5:1 for body text, ≥ 3:1 for large text.
- Color is never the only signal — confidence sign also shown via `+` / `−` glyph.
- All images have meaningful `alt` text or `alt=""` for decorative.
- Forms have associated `<label>` elements.
- Live regions (`aria-live`) for confidence updates.
- Run `axe-core` in tests for every page.

---

## 7. Security

- Never commit secrets. Use `.env.local`, validated through Zod at startup.
- All user input validated via Zod, even in this single-user app.
- No `dangerouslySetInnerHTML`.
- CSP headers configured in `next.config.ts`.
- SQLite queries always parameterized — never string-concatenated.

---

## 8. Logging and observability

- Use a typed logger (`src/lib/logger/`) that wraps `console` with levels: `debug`, `info`, `warn`, `error`.
- Every log entry has a `context` object: `{ module: 'confidence/calculator', playerId: 123 }`.
- No `console.log` in source. ESLint rule enforces this. Use the logger.

---

## 9. Git hygiene

### 9.1 Commits

- Conventional Commits format: `<type>(<scope>): <subject>`.
  - Types: `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `chore`, `style`, `build`, `ci`.
  - Example: `feat(confidence): add fatigue penalty after 3 MOTM streak`
- Subject ≤ 72 chars, imperative mood, no trailing period.
- Body explains why, not what (the diff already shows what).
- Every commit's tests pass. No "WIP" commits in main.

### 9.2 Branches

- `main` is always deployable.
- Feature branches: `feat/short-description`. Bugfix: `fix/short-description`.
- Squash merge into main with a clean conventional commit message.

### 9.3 PR requirements

Every PR description includes:

- Link to the relevant build-order step in PLANNING.md
- What changed, in 3 bullets
- Screenshots/recordings for any UI change
- Test coverage delta
- Lighthouse run for routes touched

---

## 10. Definition of Done (PR-level checklist)

A task is complete only when ALL of these are true. No partial credit.

- [ ] Code compiles with zero TS errors and zero warnings (`npm run typecheck`)
- [ ] Lint passes with zero warnings (`npm run lint`)
- [ ] All tests pass (`npm test`)
- [ ] Coverage meets floor: 90% on `src/lib/`, 70% on `src/components/`
- [ ] New public functions have TSDoc
- [ ] No `any`, no `!`, no `as` casts (except where TESTING.md / ENGINEERING.md §2.2 explicitly allow)
- [ ] No `console.log` left in source
- [ ] UI changes responsive at 375px / 768px / 1280px
- [ ] Dark mode designed and tested
- [ ] Empty / loading / error states implemented
- [ ] Accessibility: keyboard navigation works, focus rings visible, axe-core passes
- [ ] If route changed: Lighthouse Performance ≥ 90, Accessibility ≥ 95
- [ ] Module README updated if public API changed
- [ ] PLANNING.md build-order step marked complete

---

## 11. When to deviate

These standards exist to make code reviewable, maintainable, and correct. They are not theology. If you encounter a situation where following the rule produces worse code, **stop and propose the deviation in a comment**. Don't just break the rule.

Examples of acceptable deviations (with justification):

- A 50-line function that is genuinely a single linear sequence.
- An `as` cast in a Zod parser bridge.
- A `useEffect` for genuine browser API integration (e.g. `IntersectionObserver`).

Examples of unacceptable deviations:

- "I didn't have time to write the test."
- "It's just a small component."
- "We can refactor it later."
