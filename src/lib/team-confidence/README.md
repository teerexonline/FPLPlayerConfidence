# `src/lib/team-confidence`

Pure function that converts an FPL manager's 15-player squad into a single
**Team Confidence %** (0–100) and three positional line averages.

No I/O. No side effects. No framework dependencies.

---

## Algorithm

Inputs: a list of 15 `SquadPick`s (positions 1–15) and a `playerData` map
keyed by `playerId` that carries each player's `{ confidence, position }`.

1. **Validate** — reject if total ≠ 15 or starters (squadPosition ≤ 11) ≠ 11.
2. **Group starters by position** — bench players (squadPosition 12–15) are ignored.
   Players missing from `playerData` are silently skipped.
3. **Compute positional means**:
   - `defence` = mean(GK + DEF confidence values)
   - `midfield` = mean(MID confidence values)
   - `attack` = mean(FWD confidence values)
   - Missing lines (no starters in that group) default to 0.
4. **Line average** = mean(defence, midfield, attack) — equal weight regardless of
   how many players each line contains.
5. **Percent** = `((lineAverage + 5) / 10) × 100`, rounded to 2 dp.
   Maps the confidence range [−5, +5] onto [0, 100].

---

## Worked examples

| Scenario           | defence | midfield | attack | lineAverage | %      |
| ------------------ | ------- | -------- | ------ | ----------- | ------ |
| All starters at +5 | 5.00    | 5.00     | 5.00   | 5.00        | 100.00 |
| All starters at −5 | −5.00   | −5.00    | −5.00  | −5.00       | 0.00   |
| All starters at 0  | 0.00    | 0.00     | 0.00   | 0.00        | 50.00  |
| Mixed (TEAM-EX-04) | 1.50    | 1.00     | 3.00   | 1.833…      | 68.33  |
| No FWD starters    | 4.00    | 2.00     | 0.00   | 2.00        | 70.00  |

---

## Public API

```ts
import { calculateTeamConfidence } from '@/lib/team-confidence';
import type {
  TeamCalculatorInput,
  TeamCalculatorOutput,
  TeamValidationError,
  Result,
} from '@/lib/team-confidence';

const result: Result<TeamCalculatorOutput, TeamValidationError> = calculateTeamConfidence(input);

if (result.ok) {
  result.value.teamConfidencePercent; // 0–100, 2 dp
  result.value.positional; // { defence, midfield, attack } each in [−5, +5]
  result.value.starterCount; // always 11 for a valid squad
} else {
  result.error.code; // 'WRONG_PICK_COUNT' | 'WRONG_STARTER_COUNT'
  result.error.message; // human-readable description
}
```

### `TeamCalculatorInput`

| Field        | Type                                            | Description                     |
| ------------ | ----------------------------------------------- | ------------------------------- |
| `picks`      | `readonly SquadPick[]`                          | All 15 squad entries.           |
| `playerData` | `ReadonlyMap<number, { confidence, position }>` | Confidence snapshot per player. |

### `SquadPick`

| Field           | Type      | Description                    |
| --------------- | --------- | ------------------------------ |
| `playerId`      | `number`  | FPL player ID.                 |
| `squadPosition` | `number`  | 1–11 = starter, 12–15 = bench. |
| `isCaptain`     | `boolean` | Unused in this calculation.    |
| `isViceCaptain` | `boolean` | Unused in this calculation.    |

---

## Test coverage

13 tests across three suites:

- **Worked examples** (TEAM-EX-01…07) — pin exact numeric outputs for representative squads.
- **Validation** — reject bad pick counts and wrong starter/bench splits.
- **Properties** (TEAM-PROP-01…03, fast-check) — percent always in [0, 100], neutral squads always 50%, bench confidence never changes the result.

Coverage: **100% statements / 100% branches / 100% functions / 100% lines**.
