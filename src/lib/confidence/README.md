# confidence

The `confidence` module implements the core scoring algorithm for the FPL Confidence app. It is the heart of the domain layer — a pure function that accepts a player's position and ordered match history, then returns a rolling Confidence score in the range `[-5, +5]` along with a per-match audit trail. Scoring rules differ by position (GK/DEF stack clean-sheet and goal/assist bonuses; MID/FWD take exactly one outcome per match), and a fatigue penalty of −2 applies after every third cumulative MOTM performance. The full scoring table, definitions, and every worked example that doubles as a canonical test case live in `docs/ALGORITHM.md`.

## Public API

The module exposes a single function and five types through its barrel export (`index.ts`):

- **`calculateConfidence(input: CalculatorInput): CalculatorOutput`** — the entry point. Iterates matches in order, accumulates confidence, applies fatigue, clamps per match, and returns the final value with a complete history.
- **`CalculatorInput`** — `{ position: Position; matches: readonly MatchEvent[] }`. Matches must be in chronological order with `minutesPlayed > 0`; the caller is responsible for enforcing these preconditions.
- **`CalculatorOutput`** — `{ finalConfidence: number; history: readonly MatchDelta[] }`.
- **`MatchDelta`** — per-match record: `gameweek`, `delta`, `reason` (human-readable string), `fatigueApplied`, `confidenceAfter`, `motmCounterAfter`.
- **`Position`** and **`MatchEvent`** — re-exported for callers that build inputs.

## Invariants

The calculator is a **pure function**: no I/O, no `Date.now()`, no global state. Given the same `CalculatorInput` it always returns a deeply equal `CalculatorOutput`. Confidence is hard-clamped to `[-5, +5]` once per match after all sub-rules (including fatigue) are summed — never between sub-rules within a single match. Precondition violations (matches out of order, `minutesPlayed ≤ 0`, negative goals/assists) produce undefined behavior; validation is the caller's responsibility, enforced in `src/lib/fpl/` before inputs reach this module.
