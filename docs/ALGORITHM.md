# Confidence Algorithm

This document is the **complete specification** for how Confidence is calculated, and the **canonical test specification** for `src/lib/confidence/`. Every worked example here must be a passing unit test. See `docs/TESTING.md` for testing standards.

---

## 1. Core principles

1. Every player starts at confidence `0`.
2. Confidence updates **per match the player appeared in**. Missed matches are skipped — no decay, no zero-fill.
3. Confidence is hard-clamped to `[-5, +5]` after every match update.
4. The calculator is a **pure function**: same inputs always produce the same output. No I/O, no `Date.now()`, no globals. (See `docs/ENGINEERING.md` §1.3.)

---

## 2. Type contract

```ts
export type Position = 'GK' | 'DEF' | 'MID' | 'FWD';

export interface MatchEvent {
  readonly gameweek: number; // 1..38
  readonly opponentTeamId: number;
  readonly isOpponentBigTeam: boolean;
  readonly minutesPlayed: number; // > 0 by precondition (caller filters)
  readonly goals: number;
  readonly assists: number;
  readonly cleanSheet: boolean; // true iff minutes >= 60 AND team conceded 0
}

export interface CalculatorInput {
  readonly position: Position;
  readonly matches: readonly MatchEvent[]; // chronological, appearances only
}

export interface MatchDelta {
  readonly gameweek: number;
  readonly delta: number; // post-clamp net change
  readonly reason: string;
  readonly fatigueApplied: boolean;
  readonly confidenceAfter: number; // clamped, -5..+5
  readonly motmCounterAfter: number;
}

export interface CalculatorOutput {
  readonly finalConfidence: number;
  readonly history: readonly MatchDelta[];
}
```

**Preconditions** (caller is responsible — calculator does not validate):

- Every match has `minutesPlayed > 0`
- Matches are in chronological order
- Goals, assists, minutesPlayed are non-negative integers

If preconditions are violated, behavior is undefined. The caller (the sync pipeline in `src/lib/fpl/`) enforces them.

---

## 3. Definitions

| Term                 | Meaning                                                           |
| -------------------- | ----------------------------------------------------------------- |
| **Performance**      | exactly 1 assist AND 0 goals                                      |
| **MOTM performance** | (1+ goals) OR (2+ assists)                                        |
| **Blank**            | 0 goals AND 0 assists                                             |
| **Big team**         | opponent is in the configured big-teams set                       |
| **Clean sheet**      | `cleanSheet === true` (caller enforces minutes ≥ 60 + conceded 0) |

For MID and FWD, only Performance / MOTM / Blank apply. Clean sheet bonuses do **not** apply to MID/FWD even though FPL itself awards CS points to MIDs in some cases — this is a deliberate Confidence-design choice.

---

## 4. Scoring table

| Event                                         | vs Big | vs Non-Big |
| --------------------------------------------- | ------ | ---------- |
| Performance (1 assist, 0 goals)               | +2     | +1         |
| MOTM performance                              | +3     | +2         |
| Blank                                         | −1     | −2         |
| Clean sheet (GK/DEF only)                     | +2     | +1         |
| Assist (GK/DEF only — counts as MOTM, see §5) | +3     | +2         |

---

## 5. Per-match resolution

### MID / FWD (single-rule path)

Apply exactly one of:

1. MOTM performance → +3 / +2
2. Performance → +2 / +1
3. Blank → −1 / −2

A midfielder who scores AND assists once: that's MOTM (1+ goals). Single rule fires.

### GK / DEF (stacking path)

Evaluate in this order, applying all that match, then clamp once at the end:

1. **Assist?** Apply assist bonus (+3 big / +2 non-big). This **also satisfies the MOTM branch** — do not double-count by also firing step 2.
2. **Goal (and didn't already trigger step 1)?** Apply MOTM points (+3 / +2).
3. **Clean sheet?** Apply CS bonus (+2 / +1).
4. **Steps 1–3 all skipped AND goals = 0 AND assists = 0?** Apply Blank (−1 / −2).

A defender with 1 goal + clean sheet vs big team → +3 (goal/MOTM) + +2 (CS) = **+5** raw, clamp to +5.
A defender with 1 assist + clean sheet vs non-big team → +2 (assist) + +1 (CS) = **+3** raw.
A defender with 0 G/A + clean sheet vs big team → +2 (CS only). Not a blank, because CS fired.
A defender with 0 G/A, no CS, vs big team → −1 (Blank vs big).

---

## 6. Fatigue modifier

- Maintain a counter `motmCount` starting at 0.
- Increment by 1 every time a MOTM performance is recorded for this player. This includes GK/DEF assists (which count as MOTM) and GK/DEF goals.
- When `motmCount` reaches **3**, after applying that match's normal points, **also apply −2** to confidence and reset `motmCount` to 0.
- The fatigue penalty is part of that match's adjustment, applied **before** the single end-of-match clamp.

---

## 7. Clamping

After all match-level adjustments (including fatigue) are summed for a single match, clamp the resulting confidence to `[-5, +5]`. Apply clamp **once per match, at the end**. Never between sub-rules within a single match.

The `delta` field in `MatchDelta` is the difference between `confidenceAfter` and the previous match's `confidenceAfter`. If raw points would push past the clamp, `delta` reflects the clamped change.

---

## 8. Worked examples (canonical test cases)

Each example is a required `it(...)` block in `calculator.test.ts`. Use the exact expected values.

### EX-01 — MOTM vs big team (MID)

```
position: MID
match: { goals: 2, assists: 0, isOpponentBigTeam: true, cleanSheet: false, minutesPlayed: 90 }
expected: delta=+3, reason="MOTM vs big team", confidenceAfter=+3, motmCounterAfter=1
```

### EX-02 — Performance vs non-big (MID)

```
position: MID
match: { goals: 0, assists: 1, isOpponentBigTeam: false, cleanSheet: false, minutesPlayed: 85 }
expected: delta=+1, reason="Performance vs non-big team", confidenceAfter=+1, motmCounterAfter=0
```

### EX-03 — Blank vs big (FWD)

```
position: FWD
match: { goals: 0, assists: 0, isOpponentBigTeam: true, cleanSheet: false, minutesPlayed: 90 }
expected: delta=-1, reason="Blank vs big team", confidenceAfter=-1, motmCounterAfter=0
```

### EX-04 — Clean sheet vs non-big (DEF)

```
position: DEF
match: { goals: 0, assists: 0, isOpponentBigTeam: false, cleanSheet: true, minutesPlayed: 90 }
expected: delta=+1, reason="Clean sheet vs non-big team", confidenceAfter=+1, motmCounterAfter=0
```

### EX-05 — Defender assist vs big (treated as MOTM)

```
position: DEF
match: { goals: 0, assists: 1, isOpponentBigTeam: true, cleanSheet: false, minutesPlayed: 90 }
expected: delta=+3, reason="Assist vs big team (MOTM)", confidenceAfter=+3, motmCounterAfter=1
```

### EX-06 — Defender scores AND keeps CS vs big team

```
position: DEF
match: { goals: 1, assists: 0, isOpponentBigTeam: true, cleanSheet: true, minutesPlayed: 90 }
expected: delta=+5, reason="MOTM vs big team + Clean sheet vs big team", confidenceAfter=+5, motmCounterAfter=1
```

### EX-07 — Fatigue trigger (3 MOTMs vs non-big from 0)

```
position: FWD
matches:
  GW1: goals=1, isOpponentBigTeam=false → +2 → conf=+2, motm=1
  GW2: goals=1, isOpponentBigTeam=false → +2 → conf=+4, motm=2
  GW3: goals=1, isOpponentBigTeam=false → +2 then -2 fatigue → conf=+4, motm=0 (reset), fatigueApplied=true
finalConfidence: +4
```

### EX-08 — Clamp at upper bound

Player at +4, MOTM vs big team:

```
position: MID
preceding state: confidence=+4
match: { goals: 1, isOpponentBigTeam: true, … } → raw +3 → would be +7 → clamp to +5
expected: confidenceAfter=+5, delta=+1 (clamped)
```

### EX-09 — Clamp at lower bound

Player at −4, blank vs non-big:

```
position: FWD
preceding state: confidence=-4
match: { goals: 0, assists: 0, isOpponentBigTeam: false, … } → raw -2 → would be -6 → clamp to -5
expected: confidenceAfter=-5, delta=-1 (clamped)
```

### EX-10 — Empty matches

```
position: MID
matches: []
expected: finalConfidence=0, history=[]
```

### EX-11 — GK clean sheet vs big team, no G/A

```
position: GK
match: { goals: 0, assists: 0, isOpponentBigTeam: true, cleanSheet: true, minutesPlayed: 90 }
expected: delta=+2, reason="Clean sheet vs big team", confidenceAfter=+2
```

### EX-12 — MID with 2 assists qualifies as MOTM

```
position: MID
match: { goals: 0, assists: 2, isOpponentBigTeam: false, cleanSheet: false, minutesPlayed: 90 }
expected: delta=+2, reason="MOTM vs non-big team", confidenceAfter=+2, motmCounterAfter=1
```

### EX-13 — Defender 0 G/A, no CS, vs big team → blank

```
position: DEF
match: { goals: 0, assists: 0, isOpponentBigTeam: true, cleanSheet: false, minutesPlayed: 90 }
expected: delta=-1, reason="Blank vs big team", confidenceAfter=-1
```

### EX-14 — Clamp interaction with fatigue

Player at +5 with motmCount=2 (so this match's MOTM is the 3rd), MOTM vs big team:

```
preceding state: confidence=+5, motmCount=2
match: MOTM vs big team
raw delta: +3 (MOTM) - 2 (fatigue) = +1
new confidence: +5 + 1 = +6 → clamp → +5
expected: confidenceAfter=+5, delta=0, fatigueApplied=true, motmCounterAfter=0
```

### EX-15 — GK/DEF: assist + goal in same match counts once for MOTM

```
position: DEF
match: { goals: 1, assists: 1, isOpponentBigTeam: false, cleanSheet: false, minutesPlayed: 90 }
resolution:
  step 1 fires (assist) → +2, motmCount += 1
  step 2 skipped (already MOTM via step 1 — do NOT double count)
  step 3 skipped (no CS)
expected: delta=+2, reason="Assist vs non-big team (MOTM)", confidenceAfter=+2, motmCounterAfter=1
```

---

## 9. Required property tests

In addition to the 15 worked examples, `calculator.test.ts` includes three property-based tests using `fast-check`:

### PROP-01 — Output is always within `[-5, +5]`

For any valid `CalculatorInput`, `finalConfidence` ∈ `[-5, +5]` and every `history[i].confidenceAfter` ∈ `[-5, +5]`.

### PROP-02 — Empty matches produce zero

For any `Position`, `calculate({ position, matches: [] }).finalConfidence === 0`.

### PROP-03 — Determinism

Calling `calculate(input)` twice with the same input produces deeply equal outputs.

---

## 10. Reference implementation

This pseudocode is illustrative. The real implementation must be cleanly typed, broken into helpers, and follow ENGINEERING.md standards — but the logic flow must match exactly.

```ts
import { clamp } from '@/lib/utils/math';
import type { CalculatorInput, CalculatorOutput, MatchDelta, MatchEvent, Position } from './types';

const CONFIDENCE_MIN = -5;
const CONFIDENCE_MAX = 5;
const FATIGUE_THRESHOLD = 3;
const FATIGUE_PENALTY = -2;

interface MatchAdjustment {
  readonly raw: number;
  readonly reasons: readonly string[];
  readonly isMotm: boolean;
}

function resolveMidFwd(match: MatchEvent): MatchAdjustment {
  const big = match.isOpponentBigTeam;
  const motm = match.goals >= 1 || match.assists >= 2;
  const performance = match.assists === 1 && match.goals === 0;
  const blank = match.goals === 0 && match.assists === 0;

  if (motm) {
    return {
      raw: big ? 3 : 2,
      reasons: [big ? 'MOTM vs big team' : 'MOTM vs non-big team'],
      isMotm: true,
    };
  }
  if (performance) {
    return {
      raw: big ? 2 : 1,
      reasons: [big ? 'Performance vs big team' : 'Performance vs non-big team'],
      isMotm: false,
    };
  }
  if (blank) {
    return {
      raw: big ? -1 : -2,
      reasons: [big ? 'Blank vs big team' : 'Blank vs non-big team'],
      isMotm: false,
    };
  }
  return { raw: 0, reasons: [], isMotm: false };
}

function resolveGkDef(match: MatchEvent): MatchAdjustment {
  const big = match.isOpponentBigTeam;
  let raw = 0;
  const reasons: string[] = [];
  let isMotm = false;

  if (match.assists >= 1) {
    raw += big ? 3 : 2;
    reasons.push(big ? 'Assist vs big team (MOTM)' : 'Assist vs non-big team (MOTM)');
    isMotm = true;
  } else if (match.goals >= 1) {
    raw += big ? 3 : 2;
    reasons.push(big ? 'MOTM vs big team' : 'MOTM vs non-big team');
    isMotm = true;
  }

  if (match.cleanSheet) {
    raw += big ? 2 : 1;
    reasons.push(big ? 'Clean sheet vs big team' : 'Clean sheet vs non-big team');
  }

  if (!isMotm && !match.cleanSheet && match.goals === 0 && match.assists === 0) {
    raw += big ? -1 : -2;
    reasons.push(big ? 'Blank vs big team' : 'Blank vs non-big team');
  }

  return { raw, reasons, isMotm };
}

export function calculateConfidence(input: CalculatorInput): CalculatorOutput {
  let confidence = 0;
  let motmCount = 0;
  const history: MatchDelta[] = [];

  for (const match of input.matches) {
    const before = confidence;
    const { raw, reasons, isMotm } =
      input.position === 'GK' || input.position === 'DEF'
        ? resolveGkDef(match)
        : resolveMidFwd(match);

    let totalRaw = raw;
    const reasonList = [...reasons];
    let fatigueApplied = false;

    if (isMotm) {
      motmCount += 1;
      if (motmCount >= FATIGUE_THRESHOLD) {
        totalRaw += FATIGUE_PENALTY;
        reasonList.push('Fatigue −2');
        fatigueApplied = true;
        motmCount = 0;
      }
    }

    confidence = clamp(before + totalRaw, CONFIDENCE_MIN, CONFIDENCE_MAX);

    history.push({
      gameweek: match.gameweek,
      delta: confidence - before,
      reason: reasonList.join(' + '),
      fatigueApplied,
      confidenceAfter: confidence,
      motmCounterAfter: motmCount,
    });
  }

  return { finalConfidence: confidence, history };
}
```
