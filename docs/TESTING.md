# Testing Standards

Testing is not optional, not deferred, and not a "polish phase." It happens **as code is written**, not after.

This document defines the testing strategy, tools, and coverage requirements. Every PR is reviewed against it.

---

## 1. Philosophy

1. **Test behavior, not implementation.** A test should not break when you refactor internals.
2. **Tests are documentation.** A reader of `Component.test.tsx` should understand what `Component` does without opening `Component.tsx`.
3. **Tests are first-class code.** Same naming, formatting, and review bar as production code.
4. **Failing tests are urgent.** A red test in main is a P0. Either fix the test or revert the change.

---

## 2. The pyramid

```
        ╱╲
       ╱E2╲          5% — Playwright, critical user paths only
      ╱────╲
     ╱ Integ╲        20% — Vitest, real DB, real fetch with MSW
    ╱────────╲
   ╱   Unit   ╲      75% — Vitest, pure functions and components
  ╱────────────╲
```

We invest most heavily in unit tests because they're fast, deterministic, and pinpoint failures precisely.

---

## 3. Tools

| Layer             | Tool                            | Why                                          |
| ----------------- | ------------------------------- | -------------------------------------------- |
| Unit (logic)      | Vitest                          | Fast, native ESM, TS-first                   |
| Unit (components) | Vitest + @testing-library/react | Test behavior, not internals                 |
| User events       | @testing-library/user-event     | Realistic event simulation                   |
| API mocking       | MSW (Mock Service Worker)       | Mocks at the network layer, not the function |
| Coverage          | @vitest/coverage-v8             | Built into Vitest                            |
| Accessibility     | @axe-core/react + jest-axe      | Automated a11y assertions                    |
| E2E               | Playwright                      | Cross-browser, fast, modern                  |

**Forbidden:** Jest, Enzyme, Cypress (Playwright covers this), `react-test-renderer`.

---

## 4. Unit tests — pure logic

### 4.1 TDD is mandatory for `src/lib/`

For every function in `src/lib/`, follow this loop:

1. Write the failing test that describes the next behavior.
2. Run `npm run test:watch` — confirm it fails for the right reason.
3. Write the minimum code to make it pass.
4. Refactor with the test as a safety net.
5. Commit test and implementation together (or test first, then implementation, in adjacent commits).

The Confidence calculator is built **entirely** this way. Every worked example in `docs/ALGORITHM.md` becomes an `it(...)` block before any calculator code is written.

### 4.2 Structure

```ts
// src/lib/confidence/calculator.test.ts
import { describe, it, expect } from 'vitest';
import { calculateConfidence } from './calculator';
import type { CalculatorInput } from './types';

describe('calculateConfidence', () => {
  describe('MID/FWD scoring', () => {
    it('awards +3 for a goal vs a big team (MOTM)', () => {
      const input: CalculatorInput = {
        position: 'MID',
        matches: [
          {
            gameweek: 1,
            opponentTeamId: 1,
            isOpponentBigTeam: true,
            minutesPlayed: 90,
            goals: 2,
            assists: 0,
            cleanSheet: false,
          },
        ],
      };

      const result = calculateConfidence(input);

      expect(result.finalConfidence).toBe(3);
      expect(result.history[0]).toMatchObject({
        delta: 3,
        reason: 'MOTM vs big team',
        confidenceAfter: 3,
        motmCounterAfter: 1,
      });
    });
  });

  describe('clamping', () => {
    it('clamps the upper bound at +5', () => {
      /* … */
    });
    it('clamps the lower bound at -5', () => {
      /* … */
    });
  });

  describe('fatigue', () => {
    it('applies -2 after the 3rd MOTM and resets the counter', () => {
      /* … */
    });
  });

  describe('GK/DEF resolution', () => {
    it('stacks MOTM points and clean sheet bonus', () => {
      /* … */
    });
    it('treats an assist as MOTM for fatigue tracking', () => {
      /* … */
    });
  });
});
```

### 4.3 Rules

- **Arrange-Act-Assert.** Use whitespace to separate the three sections.
- **One assertion concept per test.** If you need three `expect` calls, that's fine — but they should all assert the same behavior.
- **Test names describe behavior in plain English.** "applies -2 after the 3rd MOTM" not "test fatigue case 3".
- **No shared mutable state between tests.** Each `it` block is independent.
- **No conditional logic in tests.** No `if`, no `for`. If you need them, you're testing implementation.
- **No mocks for pure functions.** Pure code needs no mocks. If you find yourself mocking, the function isn't pure — fix it.

### 4.4 Property-based testing

For functions with non-trivial input space (the calculator, parsers), include property tests using **fast-check**:

```ts
import { fc } from 'fast-check';

it('always produces confidence within [-5, +5]', () => {
  fc.assert(
    fc.property(arbCalculatorInput(), (input) => {
      const result = calculateConfidence(input);
      expect(result.finalConfidence).toBeGreaterThanOrEqual(-5);
      expect(result.finalConfidence).toBeLessThanOrEqual(5);
    }),
  );
});
```

The Confidence calculator must have at least three property tests:

1. Output is always within `[-5, +5]`.
2. Empty match list always returns `0`.
3. Reordering matches preserving event order produces the same final value (sanity check determinism).

---

## 5. Component tests

### 5.1 Test the contract

A component test answers: "If a user does X, do they see Y?" Not "does this component call `useState` correctly?"

```tsx
// ConfidenceNumber.test.tsx
import { render, screen } from '@testing-library/react';
import { ConfidenceNumber } from './ConfidenceNumber';

describe('ConfidenceNumber', () => {
  it('renders positive values with a + sign and positive color', () => {
    render(<ConfidenceNumber value={3} />);
    const node = screen.getByText('+3');
    expect(node).toHaveAttribute('data-sign', 'positive');
  });

  it('renders zero as 0 with neutral styling', () => {
    render(<ConfidenceNumber value={0} />);
    const node = screen.getByText('0');
    expect(node).toHaveAttribute('data-sign', 'neutral');
  });

  it('uses Unicode minus, not hyphen, for negative values', () => {
    render(<ConfidenceNumber value={-2} />);
    expect(screen.getByText('−2')).toBeInTheDocument(); // U+2212
    expect(screen.queryByText('-2')).not.toBeInTheDocument(); // hyphen
  });
});
```

### 5.2 Required tests per component

Every component with any of the following must have a test:

- Conditional rendering (`if` / ternary in JSX)
- Props that change visual output
- User interaction (click, type, keyboard)
- Async state (loading, error, empty)
- Accessibility-critical behavior (focus, aria, semantics)

Pure presentational components with no logic don't need a test, but the component using them does.

### 5.3 Querying

In order of preference:

1. `getByRole` — most accessible, most realistic
2. `getByLabelText` — for form fields
3. `getByText` — for visible text
4. `getByTestId` — last resort. `data-testid` only on elements where role/text fails.

**Forbidden:** `container.querySelector`, snapshot tests for component output.

### 5.4 User interactions

Always use `@testing-library/user-event`, never `fireEvent`:

```tsx
import { userEvent } from '@testing-library/user-event';

it('pins a player when the pin button is clicked', async () => {
  const user = userEvent.setup();
  const onPin = vi.fn();
  render(<PlayerRow player={fixture} onPin={onPin} />);

  await user.click(screen.getByRole('button', { name: /pin/i }));

  expect(onPin).toHaveBeenCalledWith(fixture.id);
});
```

### 5.5 Accessibility tests

Every page-level component runs `axe`:

```tsx
import { axe } from 'jest-axe';

it('has no a11y violations', async () => {
  const { container } = render(<PlayersPage initialData={fixture} />);
  expect(await axe(container)).toHaveNoViolations();
});
```

---

## 6. Integration tests

### 6.1 What counts as integration

- Functions that hit the SQLite layer
- Server Actions and Route Handlers
- API client (`src/lib/fpl/api.ts`) against MSW-mocked endpoints

### 6.2 Database tests

Use a temp SQLite file per test, never an in-memory shared one (we want to test the real persistence path):

```ts
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach } from 'vitest';
import { createDb } from '@/lib/db/client';

let dbPath: string;
let db: ReturnType<typeof createDb>;

beforeEach(() => {
  const dir = mkdtempSync(join(tmpdir(), 'fpl-test-'));
  dbPath = join(dir, 'test.db');
  db = createDb(dbPath);
});

afterEach(() => {
  db.close();
  rmSync(dbPath, { force: true });
});
```

### 6.3 Network mocks with MSW

```ts
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

const server = setupServer(
  http.get('https://fantasy.premierleague.com/api/bootstrap-static/', () =>
    HttpResponse.json(bootstrapFixture),
  ),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

`onUnhandledRequest: 'error'` is mandatory. If a test makes an unmocked request, the test fails. No accidental real network calls.

---

## 7. E2E tests

Reserved for **critical user paths only**. Each E2E test takes 5–30 seconds; we don't put low-value flows here.

### 7.1 Required E2E coverage

1. Cold start → dashboard renders with confidence data
2. Players list → search → click player → detail page → confidence number animates
3. Settings → toggle big team → confidence values update
4. Cmd+K → search "Salah" → navigate to detail

### 7.2 Playwright config

- Chromium + WebKit. Skip Firefox unless we hit a regression.
- Run against `npm run build && npm run start` (production build), not dev.
- No flaky retries. If a test is flaky, it's broken — fix it or delete it.

---

## 8. Coverage requirements

| Layer                  | Floor                         |
| ---------------------- | ----------------------------- |
| `src/lib/` (all logic) | **90% lines, 90% branches**   |
| `src/components/`      | **70% lines**                 |
| `src/app/` (pages)     | covered by E2E, no unit floor |

Below the floor = task is not done. CI fails the PR.

Run: `npm run test:coverage`. The HTML report is in `coverage/index.html`.

**Coverage is a floor, not a ceiling.** 90% line coverage with no behavioral assertions is worse than 70% with strong assertions. Reviewers check both.

---

## 9. Test fixtures

- Fixtures live in `src/lib/<domain>/__fixtures__/`.
- Use builder functions, not raw objects, so each test states only what it cares about:

```ts
// __fixtures__/match.ts
export const aMatch = (overrides: Partial<MatchEvent> = {}): MatchEvent => ({
  gameweek: 1,
  opponentTeamId: 1,
  isOpponentBigTeam: false,
  minutesPlayed: 90,
  goals: 0,
  assists: 0,
  cleanSheet: false,
  ...overrides,
});

// In a test:
const match = aMatch({ goals: 2, isOpponentBigTeam: true });
```

This pattern is mandatory for any type used in more than two tests.

---

## 10. CI

The CI pipeline (GitHub Actions) runs on every push:

1. `npm ci`
2. `npm run typecheck`
3. `npm run lint`
4. `npm test -- --coverage`
5. `npm run build`
6. `npm run test:e2e` (only on PRs to main)

A red step fails the build. No merge until green.

---

## 11. What "done" looks like for a test

- Test name describes behavior in plain English
- Arrange/Act/Assert structure is clear
- No shared state between tests
- No `any` in the test file
- Runs in < 100ms (unit) or < 2s (integration)
- Fails for the right reason (try breaking the implementation and confirm)
- Doesn't break under refactoring of internals

---

## 12. Anti-patterns

- ❌ Snapshot tests of component output (brittle, no behavioral signal)
- ❌ Mocking `react`, `next`, or framework internals
- ❌ Tests that assert on CSS class names (asserts implementation, not behavior)
- ❌ `setTimeout` / `waitFor` with arbitrary timeouts (use `findBy*` queries)
- ❌ Large fixtures inlined in test files (extract to `__fixtures__/`)
- ❌ One mega-test with 20 assertions
- ❌ `expect(true).toBe(true)` placeholder tests
- ❌ Skipping tests with `.skip` in main (delete or fix)
