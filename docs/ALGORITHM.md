# Confidence Algorithm

This document is the **complete specification** for how Confidence is calculated, and the **canonical test specification** for `src/lib/confidence/`. Every worked example here must be a passing unit test. See `docs/TESTING.md` for testing standards.

---

## Changelog

| Version | Summary                                                                                                                                                                                                                                                                                                                                                         |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| v1.7    | Split `GOAL_ASSIST_FDR_MULTIPLIERS` into `MOTM_FDR_MULTIPLIERS`, `PERFORMANCE_FDR_MULTIPLIERS`, and `CS_FDR_MULTIPLIERS`. GK/DEF single assists now use the Performance path (no MOTM reclassification). CS suppressed when MOTM fires. Added `rawDelta` to `MatchDelta` and `confidence_snapshots.raw_delta`. Hot Streak trigger and level now use `rawDelta`. |
| v1.6    | Asymmetric confidence range `[-4, +5]`; three independent fatigue mechanisms (MOTM, DC, SC); intermediate-clamp fatigue rule; SaveCon for GK; FDR-replaced big-team binary flag.                                                                                                                                                                                |

---

## 1. Core principles

1. Every player starts at confidence `0`.
2. Confidence updates **per match the player appeared in**. Missed matches are skipped — no decay, no zero-fill.
3. Confidence is hard-clamped to `[-4, +5]` after every match update. The asymmetric range reflects how form recovery works in practice — a player at the floor should be able to climb back to neutral within a realistic stretch of good performances, while the upper bound preserves the deliberate scarcity of +5.
4. The calculator is a **pure function**: same inputs always produce the same output. No I/O, no `Date.now()`, no globals. (See `docs/ENGINEERING.md` §1.3.)

---

## 2. Type contract

```ts
export type Position = 'GK' | 'DEF' | 'MID' | 'FWD';

export interface MatchEvent {
  readonly gameweek: number; // 1..38
  readonly opponentTeamId: number;
  readonly opponentFdr: number; // 1–5 integer from FPL fixtures endpoint
  readonly minutesPlayed: number; // > 0 by precondition (caller filters)
  readonly goals: number;
  readonly assists: number;
  readonly cleanSheet: boolean; // true iff minutes >= 60 AND team conceded 0
  readonly saves: number; // non-negative integer from FPL match history
  readonly defensiveContribution: number; // raw FPL aggregate; 0 when unavailable
}

export interface CalculatorInput {
  readonly position: Position;
  readonly matches: readonly MatchEvent[]; // chronological, appearances only
}

export interface MatchDelta {
  readonly gameweek: number;
  readonly delta: number; // post-clamp net change (includes fatigue adjustment)
  readonly rawDelta: number; // pre-fatigue clamped delta: clamp(before + raw) − before
  readonly reason: string;
  readonly fatigueApplied: boolean; // true iff MOTM Fatigue penalty was applied
  readonly dcFatigueApplied: boolean; // true iff DC Fatigue penalty was applied
  readonly scFatigueApplied: boolean; // true iff SC Fatigue penalty was applied
  readonly confidenceAfter: number; // clamped, -4..+5
  readonly motmCounterAfter: number;
  readonly defConCounterAfter: number;
  readonly saveConCounterAfter: number;
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
- `opponentFdr` is an integer in `{1, 2, 3, 4, 5}`

If preconditions are violated, behavior is undefined. The caller (the sync pipeline in `src/lib/fpl/`) enforces them.

---

## 3. Definitions

| Term                 | Meaning                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Performance**      | exactly 1 assist AND 0 goals                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **MOTM performance** | (1+ goals) OR (2+ assists) OR a Performance whose computed delta ≥ +3 (reclassification — see §4.2)                                                                                                                                                                                                                                                                                                                                                                            |
| **Blank**            | 0 goals AND 0 assists                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **DefCon**           | `defensive_contribution` field from FPL match history meets or exceeds the position-specific threshold (DEF: 10, MID: 12, FWD: 12). Not applicable to GK. Applies only as a **Blank substitute**: if any other positive event (goal, assist, clean sheet) fired in the same match, DefCon is silent.                                                                                                                                                                           |
| **FDR**              | Fixture Difficulty Rating — a 1–5 integer per match, sourced from FPL's fixtures endpoint. FDR 1 = easiest fixture, FDR 5 = hardest. Determines the multiplier applied to base event values.                                                                                                                                                                                                                                                                                   |
| **Clean sheet**      | `cleanSheet === true` (caller enforces minutes ≥ 60 + conceded 0)                                                                                                                                                                                                                                                                                                                                                                                                              |
| **SaveCon**          | `saves >= 4` in a match (GK only). Acts as a Blank substitute when no other positive event (goal, assist, clean sheet) fired. The +1 is flat regardless of FDR — 4 saves exceeds FPL's own save-point threshold (3 saves = 1 FPL point) and signals above-average shot-stopping workload, not a difficulty-adjusted output. SaveCon mirrors DefCon's role for outfielders: a structural safety net that prevents an unjust Blank penalty when the keeper was genuinely active. |
| **DC Fatigue**       | Applied when `defConFatigueCount` reaches 3 — i.e., DefCon has fired as primary for three tracked matches. Uses the same intermediate-clamp rule as MOTM Fatigue: penalty is −2, applied to the clamped post-DefCon confidence; waived if the hypothetical result would be ≤ 0. Counter resets to 0 regardless of apply/waive. Not applicable to GK. Independent of `motmCount` and `saveConFatigueCount`.                                                                     |
| **SC Fatigue**       | Applied when `saveConFatigueCount` reaches 3 — i.e., SaveCon has fired as primary for three tracked matches. Same waiver rule and −2 penalty as MOTM Fatigue and DC Fatigue. Counter resets to 0 regardless of apply/waive. GK only. Independent of `motmCount` and `defConFatigueCount`.                                                                                                                                                                                      |

> **Big-team badge:** Although the binary big-team concept no longer drives the calculation, the UI renders a "BIG" badge on match history cards when `opponentFdr ≥ 4`. This is a purely presentational signal — it does not affect any numeric output.

For MID and FWD, only Performance / MOTM / Blank apply. Clean sheet bonuses do **not** apply to MID/FWD even though FPL itself awards CS points to MIDs in some cases — this is a deliberate Confidence-design choice.

---

## 4. Scoring table

### 4.1 Base values

These are the raw values before FDR scaling. All positive events share a single positive-multiplier column; blanks use the blank-multiplier column.

| Event                                                                                                       | Base value |
| ----------------------------------------------------------------------------------------------------------- | ---------- |
| MOTM performance (1+ goals OR 2+ assists, all positions; GK/DEF single assist no longer qualifies — see §5) | +2         |
| Performance (1 assist, 0 goals; MID/FWD and GK/DEF single-assist path)                                      | +1         |
| Clean sheet (GK/DEF only; FDR-scaled via `CS_FDR_MULTIPLIERS` — yields +1 at FDR 1–4, +2 at FDR 5)          | +1         |
| DefCon (DEF/MID/FWD only — **flat, no FDR multiplier**)                                                     | +1         |
| SaveCon (GK only, Blank substitute — **flat, no FDR multiplier**)                                           | +1         |
| Blank                                                                                                       | −1         |

### 4.2 FDR multiplier tables

Three separate multiplier tables exist for positive events, each calibrated to its signal strength. Blank events use a fourth, inverse table. DefCon and SaveCon remain flat +1 with no FDR multiplier.

#### MOTM events (1+ goals OR 2+ assists)

`MOTM_FDR_MULTIPLIERS` — applied as `round(2 × multiplier)`. Rewards are elevated at FDR 4–5 where goals against elite opposition are genuinely exceptional.

| FDR         | Multiplier | Delta |
| ----------- | ---------- | ----- |
| 5 (hardest) | ×2.5       | +5    |
| 4           | ×2.0       | +4    |
| 3 (neutral) | ×1.0       | +2    |
| 2           | ×0.75      | +2    |
| 1 (easiest) | ×0.75      | +2    |

#### Performance events (1 assist, 0 goals)

`PERFORMANCE_FDR_MULTIPLIERS` — applied as `round(1 × multiplier)`. Steeply boosted at FDR 4–5 to reflect that an assist against top opposition is a high-signal output.

| FDR         | Multiplier | Delta | Note                                    |
| ----------- | ---------- | ----- | --------------------------------------- |
| 5 (hardest) | ×3.5       | +4    | MID/FWD only: reclassified as MOTM (≥3) |
| 4           | ×2.5       | +3    | MID/FWD only: reclassified as MOTM (≥3) |
| 3 (neutral) | ×1.0       | +1    |                                         |
| 2           | ×0.75      | +1    |                                         |
| 1 (easiest) | ×0.5       | +1    |                                         |

#### Clean sheet events (GK/DEF only)

`CS_FDR_MULTIPLIERS` — applied as `round(1 × multiplier)`. Uses `match.opponentFdr` directly — the big-team override does **not** apply. Produces +1 at FDR 1–4 and +2 at FDR 5.

| FDR         | Multiplier | Delta |
| ----------- | ---------- | ----- |
| 5 (hardest) | ×1.5       | +2    |
| 4           | ×1.25      | +1    |
| 3 (neutral) | ×1.0       | +1    |
| 2           | ×0.75      | +1    |
| 1 (easiest) | ×0.5       | +1    |

#### Blank events

`FDR_BLANK_MULTIPLIER` — unchanged. Inverse relationship to MOTM: harder fixtures penalise blanks less.

| FDR         | Multiplier | Delta |
| ----------- | ---------- | ----- |
| 5 (hardest) | ×0.5       | −1    |
| 4           | ×0.75      | −1    |
| 3 (neutral) | ×1.0       | −1    |
| 2           | ×1.25      | −1    |
| 1 (easiest) | ×1.5       | −2    |

**MOTM reclassification (MID/FWD only):** After computing the Performance delta (`round(1 × PERFORMANCE_FDR_MULTIPLIERS[fdr])`), if the result is ≥ +3, the event is reclassified as MOTM for label and MOTM fatigue counter eligibility. The delta is not recalculated. Fires at FDR 4 (`round(1 × 2.5) = +3`) and FDR 5 (`round(1 × 3.5) = +4`). **GK/DEF single assists are never reclassified regardless of magnitude** — they stay Performance.

**CS and MOTM do not stack:** When MOTM fires for GK/DEF (goals ≥ 1 or assists ≥ 2), the CS branch is skipped entirely. CS can stack with a GK/DEF Performance (single assist, 0 goals).

**Design rationale:** Splitting MOTM and Performance into separate tables lets each signal carry its own risk/reward profile. A goal against FDR 5 (MOTM) is worth +5; an assist against the same opponent (Performance) is worth +4 — still a significant reward but calibrated to the lower signal strength. CS is now FDR-aware because a clean sheet against a top-ranked side is a meaningfully harder achievement than one against relegation opposition, but CS is capped with a gentler multiplier than MOTM/Performance since it measures defensive organisation rather than attacking output. The big-team override remains absent from CS to prevent perverse incentives where the badge inflates CS rewards for defenders against nominally "big" sides whose FPL FDR might not reflect their current attacking threat.

**DefCon/SaveCon:** Always flat **+1** with no FDR multiplier and no big-team override.

### 4.3 Big-team FDR override

Four clubs are treated as effective FDR 5 for the purpose of MOTM, Performance, and Blank events, regardless of the FDR value FPL assigns to the fixture:

| Club      | FPL Team ID |
| --------- | ----------- |
| Chelsea   | 7           |
| Liverpool | 12          |
| Man City  | 13          |
| Man Utd   | 14          |

The override applies to `MOTM_FDR_MULTIPLIERS` (for MOTM), `PERFORMANCE_FDR_MULTIPLIERS` (for Performance), and `FDR_BLANK_MULTIPLIER` (for Blank). When the override fires, the reason string displays `"vs BIG opponent"` instead of `"vs FDR X opponent"`.

**The override does NOT apply to CS, DefCon, or SaveCon.** Clean sheet uses `match.opponentFdr` directly via `CS_FDR_MULTIPLIERS` — not the effective FDR computed by `getOpponentLabel`. DefCon and SaveCon are flat +1 regardless of big-team status. All three use actual FPL-assigned FDR in their reason strings: `"Clean sheet vs FDR X opponent"`, `"DefCon vs FDR X opponent"`, `"SaveCon vs FDR X opponent"`. The "BIG" label never appears in reason strings for these events.

### 4.4 Rounding rule

After computing the floating-point raw delta (sum of all components' `base × multiplier`), apply **round half away from zero** to produce an integer delta. This is _not_ JavaScript's `Math.round`, which rounds `.5` toward positive infinity for negative halves. The safe implementation:

```ts
function roundAwayFromZero(x: number): number {
  return Math.sign(x) * Math.round(Math.abs(x));
}
```

Reference values: `+0.5 → +1`, `−0.5 → −1`, `+1.5 → +2`, `−1.5 → −2`, `+2.5 → +3`, `−2.5 → −3`.

For the GK/DEF stacking path, sum all floating-point components first, then call `roundAwayFromZero` **once** on the total. Do not round intermediate per-component values.

### 4.5 Fatigue modifiers

Three independent fatigue mechanisms can apply a −2 penalty on top of the event score. All three share the same threshold, penalty, and waiver rule.

| Mechanism    | Counter               | Trigger           | Penalty | Waiver condition                                          |
| ------------ | --------------------- | ----------------- | ------- | --------------------------------------------------------- |
| MOTM Fatigue | `motmCount`           | Counter reaches 3 | −2      | Hypothetical post-penalty confidence ≤ 0 → penalty waived |
| DC Fatigue   | `defConFatigueCount`  | Counter reaches 3 | −2      | Hypothetical post-penalty confidence ≤ 0 → penalty waived |
| SC Fatigue   | `saveConFatigueCount` | Counter reaches 3 | −2      | Hypothetical post-penalty confidence ≤ 0 → penalty waived |

The penalty is applied to the clamped post-event confidence (intermediate-clamp rule). Counter resets to 0 regardless of apply/waive. Counters never interact (see §6.4).

---

## 5. Per-match resolution

### MID / FWD (single-rule path)

Apply exactly one of, in order:

1. **MOTM performance** (1+ goals OR 2+ assists): base +2 × `MOTM_FDR_MULTIPLIERS[fdr]` → round. DefCon is silent.
2. **Performance** (1 assist, 0 goals): base +1 × `PERFORMANCE_FDR_MULTIPLIERS[fdr]` → round. DefCon is silent. If the result is ≥ +3, reclassify as MOTM (label and counter only — no delta recalculation). Fires at FDR 4 (+3) and FDR 5 (+4).
3. **DefCon-only** (0 goals, 0 assists, threshold met): flat **+1** (no FDR multiplier). Prevents the blank penalty entirely.
4. **True blank** (0 goals, 0 assists, DefCon not met): base −1 × `FDR_BLANK_MULTIPLIER[fdr]` → round.

A midfielder who scores AND assists once: that's MOTM (1+ goals). Single rule fires; DefCon absorbed if also met.

### GK / DEF (stacking path)

Accumulate floating-point contributions from all applicable sub-rules, then call `roundAwayFromZero` **once** on the total, then clamp:

1. **Goals ≥ 1 OR assists ≥ 2?** MOTM. Add `2 × MOTM_FDR_MULTIPLIERS[effectiveFdr]`. DefCon and SaveCon are silent.
2. **Assists == 1 (no goals)?** Performance. Add `1 × PERFORMANCE_FDR_MULTIPLIERS[effectiveFdr]`. DefCon is silent. **No MOTM reclassification** — GK/DEF single assists remain Performance regardless of computed delta.
3. **Clean sheet? Only if MOTM (step 1) did not fire.** Add `1 × CS_FDR_MULTIPLIERS[match.opponentFdr]`. Note: uses `match.opponentFdr` directly — no big-team override for CS. Stacks with Performance (step 2). SaveCon is silent.
4. **Steps 1–3 all skipped (0 goals, 0 assists, no CS) — DEF only — DefCon threshold met?** Add flat **+1** (no FDR). Blank prevented.
5. **Steps 1–3 all skipped — GK only — `saves >= 4` (SaveCon threshold)?** Add flat **+1** (no FDR). Blank prevented. SaveCon is mutually exclusive with DefCon and with Blank — only one of steps 4/5/6 executes.
6. **Steps 1–5 all skipped?** Add `−1 × FDR_BLANK_MULTIPLIER[effectiveFdr]`. Blank.

After accumulating, call `roundAwayFromZero(rawFloat)`, then clamp to `[-4, +5]`.

**Safety guard:** If the accumulated integer result ≥ +3 and neither MOTM nor Performance has fired, reclassify as MOTM. With current event values this cannot fire — it is retained as a defensive invariant check.

### 5.1 Inline resolution examples

- **DEF 1 goal + CS, FDR 5:** MOTM fires → CS suppressed. float = 2 × 2.5 = 5.0 → round → **+5** (clamped from +5, no CS added).
- **DEF 1 assist (single), FDR 5:** Performance → float = 1 × 3.5 = 3.5 → round → **+4**. No MOTM reclassification.
- **DEF 1 assist + CS, FDR 4:** Performance fires, then CS fires (MOTM did not). float = (1 × 2.5) + (1 × 1.25) = 3.75 → round → **+4**. motmCounterAfter=0.
- **DEF 0 G/A + CS, FDR 5:** float = 1 × 1.5 = 1.5 → round → **+2**.
- **DEF 0 G/A + CS, FDR 2:** float = 1 × 0.75 = 0.75 → round → **+1**.
- **DEF 0 G/A, no CS, DefCon threshold met:** flat **+1**. Not a blank.
- **DEF 0 G/A, no CS, no DefCon, FDR 5:** float = −1 × 0.5 = −0.5 → round → **−1**.
- **MID 1 assist (Performance), FDR 5:** base +1 × 3.5 = 3.5 → round → **+4**, reclassified as MOTM (delta ≥ 3).
- **MID 1 assist (Performance), FDR 4:** base +1 × 2.5 = 2.5 → round → **+3**, reclassified as MOTM (delta ≥ 3).
- **GK with any defensive_contribution, no positive events:** DefCon never fires for GK; blank applies normally.

### 5.2 Why FDR replaced the binary big-team flag

The big-team flag was binary and required a configurable team list that was fragile (teams promoted/relegated, form fluctuates). FDR is a continuous 1–5 scale maintained by FPL itself, updated per gameweek, and captures genuine fixture difficulty without any configuration overhead. FDR 4–5 corresponds roughly to the old "big team" fixtures; FDR 1–2 to "non-big". FDR 3 is neutral (multiplier ×1.0 on both sides, matching the old implied midpoint).

---

## 6. Fatigue modifiers

Three independent fatigue mechanisms run in parallel. All three share the same threshold (3), penalty (−2), intermediate-clamp rule, waiver logic, and counter-reset behaviour. The counters never interact — see §6.4.

### 6.1 MOTM Fatigue

- Maintain a counter `motmCount` starting at 0.
- Increment by 1 every time a MOTM performance is recorded. This includes GK/DEF assists (which count as MOTM) and GK/DEF goals.
- When `motmCount` reaches **3**, evaluate the fatigue penalty using the **intermediate-clamp rule**:
  1. Compute `confidenceAfterMotm = clamp(before + motmRaw, CONFIDENCE_MIN, CONFIDENCE_MAX)` — this is the confidence the player would have from the MOTM alone, fully clamped.
  2. Compute `hypotheticalPostFatigue = confidenceAfterMotm + FATIGUE_PENALTY` (where `FATIGUE_PENALTY = −2`).
  3. If `hypotheticalPostFatigue > 0`: **apply** the penalty — `confidence = hypotheticalPostFatigue`, append "Fatigue −2" to the reason string, `fatigueApplied = true`.
  4. If `hypotheticalPostFatigue ≤ 0`: **waive** the penalty — `confidence = confidenceAfterMotm`, append "Fatigue waived" to the reason string, `fatigueApplied = false`.
  5. Reset `motmCount = 0` **regardless** of whether the penalty was applied or waived.
- For all other matches (counter < 3, or not a MOTM match), the single end-of-match clamp applies normally: `confidence = clamp(before + raw, CONFIDENCE_MIN, CONFIDENCE_MAX)`.

#### 6.1.1 Rationale — the waiver rule

The waiver protects recovering players. Fatigue's design intent is to model regression-to-the-mean after a hot streak, but a player climbing out of a slump shouldn't be punished by the same mechanic. Players at or below the neutral baseline are by definition not on an unsustainable peak.

**Why the boundary is 0 (not −4):** The confidence range [−4, +5] maps to a user-facing percentage where 0 = 50% (the neutral midpoint). A player at 0 is exactly neutral — neither good form nor poor form. Applying fatigue below this point would be penalising a player who has not yet established a positive streak. The intent is: "you've earned your recovery — don't lose it to a mechanical penalty that wasn't designed for this scenario."

**Why `> 0` (strict) rather than `≥ 0`:** If applying fatigue would land the player at exactly 0, that's a neutral outcome — the player would be at the midpoint. A player who MOTM'd their way from negative back to exactly neutral hasn't built a "hot streak" in any meaningful sense. The waiver keeps them at whatever positive confidence the MOTM earned, rather than dropping them back to neutral.

**Consequence for the clamp interaction (see EX-14):** Under the old rule, a player at the +5 ceiling who triggered fatigue on their third MOTM would stay at +5 — the −2 penalty was absorbed by the ceiling along with the +3 MOTM gain (net +1, clamped to +5, delta = 0). Under the new rule, the clamp is applied to the MOTM gain first (+5 ceiling holds), then the −2 penalty is applied to the clamped value (+5 − 2 = +3 > 0 → applied). The player lands at +3. This is the intended behaviour: fatigue should have a real effect even at the ceiling.

**The same waiver rationale applies identically to DC Fatigue and SC Fatigue** — both mechanisms protect recovering players by the same logic.

### 6.2 DC Fatigue

- Maintain a counter `defConFatigueCount` starting at 0.
- Increment by 1 every time DefCon fires **as primary** — i.e., the match was a true blank candidate (0 goals, 0 assists, no clean sheet for DEF/MID/FWD) and DefCon alone prevented the blank. The counter is **not** incremented when DefCon is silent (any positive event — goal, assist, CS — fired in the same match, causing DefCon to be absorbed).
- When `defConFatigueCount` reaches **3**, evaluate the fatigue penalty using the same intermediate-clamp rule:
  1. Compute `confidenceAfterDefCon = clamp(before + 1, CONFIDENCE_MIN, CONFIDENCE_MAX)` — the flat +1 from DefCon, fully clamped.
  2. Compute `hypotheticalPostFatigue = confidenceAfterDefCon + FATIGUE_PENALTY`.
  3. If `hypotheticalPostFatigue > 0`: **apply** — `confidence = hypotheticalPostFatigue`, append "DC Fatigue −2", `dcFatigueApplied = true`.
  4. If `hypotheticalPostFatigue ≤ 0`: **waive** — `confidence = confidenceAfterDefCon`, append "DC Fatigue waived", `dcFatigueApplied = false`.
  5. Reset `defConFatigueCount = 0` **regardless**.
- Not applicable to GK. GK never fires DefCon, so `defConFatigueCount` is always 0 for GK positions.
- Independent of `motmCount` and `saveConFatigueCount`.

### 6.3 SC Fatigue

- Maintain a counter `saveConFatigueCount` starting at 0.
- Increment by 1 every time SaveCon fires **as primary** — i.e., the GK had 0 goals, 0 assists, no clean sheet, and `saves >= 4`. The counter is **not** incremented when SaveCon is silent (any positive event fired first).
- When `saveConFatigueCount` reaches **3**, evaluate the fatigue penalty using the same intermediate-clamp rule:
  1. Compute `confidenceAfterSaveCon = clamp(before + 1, CONFIDENCE_MIN, CONFIDENCE_MAX)`.
  2. Compute `hypotheticalPostFatigue = confidenceAfterSaveCon + FATIGUE_PENALTY`.
  3. If `hypotheticalPostFatigue > 0`: **apply** — `confidence = hypotheticalPostFatigue`, append "SC Fatigue −2", `scFatigueApplied = true`.
  4. If `hypotheticalPostFatigue ≤ 0`: **waive** — `confidence = confidenceAfterSaveCon`, append "SC Fatigue waived", `scFatigueApplied = false`.
  5. Reset `saveConFatigueCount = 0` **regardless**.
- GK only. Outfielders never fire SaveCon; `saveConFatigueCount` is always 0 for non-GK positions.
- Independent of `motmCount` and `defConFatigueCount`.

### 6.4 Counter independence

The three counters track different phenomena and never cross-influence:

| Counter               | Incremented when                                        | Never incremented by |
| --------------------- | ------------------------------------------------------- | -------------------- |
| `motmCount`           | MOTM event fires (goal, 2+ assists, GK/DEF assist/goal) | DefCon, SaveCon      |
| `defConFatigueCount`  | DefCon fires as primary (DEF/MID/FWD only)              | MOTM events, SaveCon |
| `saveConFatigueCount` | SaveCon fires as primary (GK only)                      | MOTM events, DefCon  |

A single match can only ever increment one counter. If MOTM fires, DefCon and SaveCon are both silent by definition (§5). If DefCon fires as primary, MOTM did not fire. If SaveCon fires as primary, MOTM did not fire. The `else if` chain in the pseudocode (§10) encodes this invariant structurally.

---

## 7. Clamping and rawDelta

After all match-level adjustments (including fatigue) are summed for a single match, clamp the resulting confidence to `[-4, +5]`. Apply clamp **once per match, at the end**. Never between sub-rules within a single match.

The `delta` field in `MatchDelta` is the final difference: `confidenceAfter − confidenceBefore` (post-fatigue). If raw points would push past the clamp, `delta` reflects the clamped change.

`rawDelta` is computed **before fatigue is applied**: `clamp(before + raw, CONFIDENCE_MIN, CONFIDENCE_MAX) − before`. It represents how much the event alone (without any fatigue penalty) moved confidence. `rawDelta` is stored in `confidence_snapshots.raw_delta` and is used by the Hot Streak engine (see §7.1).

For a match where fatigue fires:

- `rawDelta = confidenceAfterEvent − before` (pre-fatigue clamped delta)
- `delta = finalConfidenceAfter − before` (post-fatigue delta, which is rawDelta − 2 when penalty applies)

When no fatigue fires, `delta === rawDelta`.

### 7.1 Hot Streak

A player is on a **Hot Streak** when a single match's `rawDelta >= 3`. The streak window covers the boosting match and the **two** subsequent matches (total 3 matches). All matches within the window share the same streak indicator.

Streak level is determined by `rawDelta` of the boosting match:

| `rawDelta` | Level | Colour           |
| ---------- | ----- | ---------------- |
| ≥ 5        | hot   | `#f43f5e` red    |
| ≥ 4        | warm  | `#fb923c` orange |
| ≥ 3        | mild  | `#94a3b8` slate  |

The level is fixed by the boosting match's `rawDelta` and does **not** change across the streak window.

**Key invariants:**

- Streak trigger uses `rawDelta`, not `delta`. A +5 MOTM that incurs a fatigue penalty (net delta = +3) still triggers at the `rawDelta = +5` (hot) level.
- A DGW is counted as two consecutive matches for streak-window purposes.

---

## 8. Worked examples (canonical test cases)

Each example is a required `it(...)` block in `calculator.test.ts`. Use the exact expected values.

### EX-01 — MOTM vs FDR 5 (MID)

```
position: MID
match: { goals: 2, assists: 0, opponentFdr: 5, cleanSheet: false, minutesPlayed: 90 }
resolution: MOTM (1+ goals) → base +2 × 2.5 = +5.0 → round → +5
expected: delta=+5, reason="MOTM vs FDR 5 opponent", confidenceAfter=+5, motmCounterAfter=1
```

### EX-02 — Performance vs FDR 1 (MID)

```
position: MID
match: { goals: 0, assists: 1, opponentFdr: 1, cleanSheet: false, minutesPlayed: 85 }
resolution: Performance → base +1 × 0.5 = +0.5 → round half away from zero → +1
expected: delta=+1, reason="Performance vs FDR 1 opponent", confidenceAfter=+1, motmCounterAfter=0
```

### EX-03 — Blank vs FDR 5 (FWD)

```
position: FWD
match: { goals: 0, assists: 0, opponentFdr: 5, cleanSheet: false, minutesPlayed: 90 }
resolution: Blank → base −1 × 0.5 = −0.5 → round half away from zero → −1
expected: delta=-1, reason="Blank vs FDR 5 opponent", confidenceAfter=-1, motmCounterAfter=0
```

### EX-04 — Clean sheet vs FDR 2 (DEF)

```
position: DEF
match: { goals: 0, assists: 0, opponentFdr: 2, cleanSheet: true, minutesPlayed: 90 }
resolution: CS → base +1 × CS_FDR_MULTIPLIERS[2] (= 0.75) = +0.75 → round → +1
expected: delta=+1, reason="Clean sheet vs FDR 2 opponent", confidenceAfter=+1, motmCounterAfter=0
```

### EX-05 — Defender single assist vs FDR 5 (Performance path)

```
position: DEF
match: { goals: 0, assists: 1, opponentFdr: 5, cleanSheet: false, minutesPlayed: 90 }
resolution: Single assist → Performance (GK/DEF path) → base +1 × PERFORMANCE_FDR_MULTIPLIERS[5] (= 3.5) = +3.5
            → round half away from zero → +4. No MOTM reclassification for GK/DEF single assists.
expected: delta=+4, reason="Assist vs FDR 5 opponent", confidenceAfter=+4, motmCounterAfter=0
```

### EX-06 — Defender goal + CS vs FDR 5 (CS suppressed)

```
position: DEF
match: { goals: 1, assists: 0, opponentFdr: 5, cleanSheet: true, minutesPlayed: 90 }
resolution:
  Goal (MOTM):  +2 × MOTM_FDR_MULTIPLIERS[5] (= 2.5) = +5.0
  CS suppressed: MOTM fired → clean sheet branch skipped entirely
  raw float:    +5.0 → round → +5 → clamp to +5
expected: delta=+5, reason="MOTM vs FDR 5 opponent", confidenceAfter=+5, motmCounterAfter=1
```

### EX-06b — Defender goal + CS vs FDR 4 (CS suppressed)

```
position: DEF
match: { goals: 1, assists: 0, opponentFdr: 4, cleanSheet: true, minutesPlayed: 90 }
resolution:
  Goal (MOTM):  +2 × MOTM_FDR_MULTIPLIERS[4] (= 2.0) = +4.0
  CS suppressed: MOTM fired → clean sheet branch skipped
  raw float:    +4.0 → round → +4
expected: delta=+4, reason="MOTM vs FDR 4 opponent", confidenceAfter=+4, motmCounterAfter=1
```

### EX-07 — Fatigue trigger (3 MOTMs vs FDR 3 from 0)

```
position: FWD
matches:
  GW1: goals=1, opponentFdr=3 → base +2 × 1.0 = +2.0 → +2 → conf=+2, motm=1
  GW2: goals=1, opponentFdr=3 → base +2 × 1.0 = +2.0 → +2 → conf=+4, motm=2
  GW3: goals=1, opponentFdr=3 → base +2 × 1.0 = +2.0 → +2
       confidenceAfterMotm = clamp(+4 + 2) = clamp(6) = +5
       counter = 3 → fatigue evaluates
       hypotheticalPostFatigue = +5 + (−2) = +3   → +3 > 0, penalty applied
       conf=+3, delta=−1, motm=0 (reset), fatigueApplied=true
finalConfidence: +3
```

> **Changed from the pre-waiver spec:** The old rule summed MOTM and fatigue raw values before clamping (net = +2 − 2 = 0, clamp(4+0) = 4). The new rule clamps the MOTM gain first (+4+2 = 6 → clamped to +5), then applies the fatigue penalty (+5 − 2 = +3). The fatigue now has a real effect even when the MOTM alone would have hit the ceiling. `finalConfidence` changes from `+4` to `+3`.

### EX-08 — Clamp at upper bound

Player at +4, MOTM vs FDR 5:

```
position: MID
preceding state: confidence=+4
match: { goals: 1, opponentFdr: 5, … } → MOTM base +2 × 2.5 = +5.0 → +5 → would be +9 → clamp to +5
expected: confidenceAfter=+5, delta=+1 (clamped)
```

### EX-09 — Clamp at lower bound

Player at −3, blank vs FDR 1:

```
position: FWD
preceding state: confidence=-3
match: { goals: 0, assists: 0, opponentFdr: 1, … } → Blank base −1 × 1.5 = −1.5 → round half away → −2 → would be −5 → clamp to −4
expected: confidenceAfter=-4, delta=-1 (clamped)
```

### EX-10 — Empty matches

```
position: MID
matches: []
expected: finalConfidence=0, history=[]
```

### EX-11 — GK clean sheet vs FDR 5, no G/A

```
position: GK
match: { goals: 0, assists: 0, opponentFdr: 5, cleanSheet: true, minutesPlayed: 90 }
resolution: CS → base +1 × CS_FDR_MULTIPLIERS[5] (= 1.5) = +1.5 → round half away from zero → +2
            Uses match.opponentFdr directly — no big-team override for CS.
expected: delta=+2, reason="Clean sheet vs FDR 5 opponent", confidenceAfter=+2
```

### EX-12 — MID with 2 assists qualifies as MOTM (FDR 3)

```
position: MID
match: { goals: 0, assists: 2, opponentFdr: 3, cleanSheet: false, minutesPlayed: 90 }
resolution: MOTM (2+ assists) → base +2 × 1.0 = +2.0 → +2
expected: delta=+2, reason="MOTM vs FDR 3 opponent", confidenceAfter=+2, motmCounterAfter=1
```

### EX-13 — Defender 0 G/A, no CS, vs FDR 5 → blank

```
position: DEF
match: { goals: 0, assists: 0, opponentFdr: 5, cleanSheet: false, minutesPlayed: 90 }
resolution: Blank → base −1 × 0.5 = −0.5 → round half away from zero → −1
expected: delta=-1, reason="Blank vs FDR 5 opponent", confidenceAfter=-1
```

### EX-13b — Defender 0 G/A, no CS, vs FDR 2 → blank

```
position: DEF
match: { goals: 0, assists: 0, opponentFdr: 2, cleanSheet: false, minutesPlayed: 90 }
resolution: Blank → base −1 × 1.25 = −1.25 → round → −1
expected: delta=-1, reason="Blank vs FDR 2 opponent", confidenceAfter=-1
```

### EX-13c — Goalkeeper 0 G/A, no CS, vs FDR 2 → blank

```
position: GK
match: { goals: 0, assists: 0, opponentFdr: 2, cleanSheet: false, minutesPlayed: 90 }
resolution: Blank → base −1 × 1.25 = −1.25 → round → −1
expected: delta=-1, reason="Blank vs FDR 2 opponent", confidenceAfter=-1
```

### EX-14 — Clamp interaction with fatigue (FDR 5)

Player at +5 with motmCount=2 (so this match's MOTM is the 3rd), MOTM vs FDR 5:

```
preceding state: confidence=+5, motmCount=2
match: MOTM vs FDR 5 → base +2 × 2.5 = +5.0 → motmRaw=+5
confidenceAfterMotm = clamp(+5 + 5) = clamp(10) = +5   (ceiling holds)
counter = 3 → fatigue evaluates
hypotheticalPostFatigue = +5 + (−2) = +3   → +3 > 0, penalty applied
expected: confidenceAfter=+3, delta=−2, fatigueApplied=true, motmCounterAfter=0
```

> **Changed from the pre-waiver spec:** Old expected was `confidenceAfter=+5, delta=0` — the ceiling was eating both the MOTM gain and the fatigue penalty, making fatigue invisible at +5. New rule: clamp is applied to the MOTM gain first (ceiling holds at +5), then fatigue is applied to the clamped value. Fatigue now has a real −2 effect from the ceiling.

### EX-15 — GK/DEF: goal + assist in same match, goal branch fires first (FDR 3)

```
position: DEF
match: { goals: 1, assists: 1, opponentFdr: 3, cleanSheet: false, minutesPlayed: 90 }
resolution:
  Goals ≥ 1 → MOTM fires first: +2 × MOTM_FDR_MULTIPLIERS[3] (= 1.0) = +2.0
  Assist check skipped (already MOTM via goals branch)
  CS skipped (no CS)
  raw float: +2.0 → round → +2
expected: delta=+2, reason="MOTM vs FDR 3 opponent", confidenceAfter=+2, motmCounterAfter=1
```

### EX-16 — MID DefCon-only vs FDR 3 (blank prevented)

```
position: MID
match: { goals: 0, assists: 0, defensiveContribution: 12, opponentFdr: 3, minutesPlayed: 90 }
resolution: threshold met (12 ≥ 12), no goals, no assists → DefCon-only → flat +1 (no FDR)
expected: delta=+1, reason="DefCon vs FDR 3 opponent", confidenceAfter=+1, motmCounterAfter=0
```

### EX-17 — MID blank (DefCon NOT met) vs FDR 3

```
position: MID
match: { goals: 0, assists: 0, defensiveContribution: 8, opponentFdr: 3, minutesPlayed: 90 }
resolution: threshold not met (8 < 12), no goals, no assists → Blank → base −1 × 1.0 = −1.0 → −1
expected: delta=-1, reason="Blank vs FDR 3 opponent", confidenceAfter=-1, motmCounterAfter=0
```

### EX-18 — MID Performance + DefCon vs FDR 5 (reclassified MOTM; DefCon silent)

```
position: MID
match: { goals: 0, assists: 1, defensiveContribution: 12, opponentFdr: 5, minutesPlayed: 90 }
resolution: Performance fires (1 assist) → base +1 × PERFORMANCE_FDR_MULTIPLIERS[5] (= 3.5) = +3.5
            → round half away → +4; delta ≥ 3 → reclassified as MOTM (MID/FWD only); DefCon silent
expected: delta=+4, reason="MOTM vs FDR 5 opponent", confidenceAfter=+4, motmCounterAfter=1
```

### EX-19 — DEF clean sheet + DefCon vs FDR 2 (DefCon silent)

```
position: DEF
match: { goals: 0, assists: 0, cleanSheet: true, defensiveContribution: 10, opponentFdr: 2, minutesPlayed: 90 }
resolution: CS fires → flat recovery point → +1 (no FDR multiplier); DefCon silent (positive event fired)
expected: delta=+1, reason="Clean sheet vs FDR 2 opponent", confidenceAfter=+1, motmCounterAfter=0
```

### EX-19b — DEF DefCon-only vs FDR 2 (blank prevented)

```
position: DEF
match: { goals: 0, assists: 0, cleanSheet: false, defensiveContribution: 10, opponentFdr: 2, minutesPlayed: 90 }
resolution: no positive events fired → DefCon fires → flat +1
expected: delta=+1, reason="DefCon vs FDR 2 opponent", confidenceAfter=+1, motmCounterAfter=0
```

### EX-19c — DEF single assist + high DefCon vs FDR 2 (Performance; DefCon silent)

```
position: DEF
match: { goals: 0, assists: 1, cleanSheet: false, defensiveContribution: 15, opponentFdr: 2, minutesPlayed: 90 }
resolution: Single assist → Performance (GK/DEF path) → base +1 × PERFORMANCE_FDR_MULTIPLIERS[2] (= 0.75) = +0.75
            → round → +1; DefCon silent (Performance fired as primary)
expected: delta=+1, reason="Assist vs FDR 2 opponent", confidenceAfter=+1, motmCounterAfter=0
```

### EX-19d — DEF single assist + CS vs FDR 4 (Performance + CS stack)

```
position: DEF
match: { goals: 0, assists: 1, cleanSheet: true, opponentFdr: 4, minutesPlayed: 90 }
resolution:
  Single assist → Performance: +1 × PERFORMANCE_FDR_MULTIPLIERS[4] (= 2.5) = +2.5
  CS fires (MOTM did not fire): +1 × CS_FDR_MULTIPLIERS[4] (= 1.25) = +1.25
  raw float: +3.75 → round half away from zero → +4
  Safety guard: raw=4 ≥ 3 but isPerformance=true → guard skipped; stays Performance
expected: delta=+4, reason="Assist vs FDR 4 opponent + Clean sheet vs FDR 4 opponent",
          confidenceAfter=+4, motmCounterAfter=0
```

### EX-20 — MID MOTM + DefCon vs FDR 3 (DefCon absorbed)

```
position: MID
match: { goals: 0, assists: 2, defensiveContribution: 12, opponentFdr: 3, minutesPlayed: 90 }
resolution: MOTM fires (2+ assists) → base +2 × 1.0 = +2.0 → +2; DefCon absorbed
expected: delta=+2, reason="MOTM vs FDR 3 opponent", confidenceAfter=+2, motmCounterAfter=1
```

### EX-21 — GK with high defensive_contribution, no CS, vs FDR 2 (DefCon never fires for GK)

```
position: GK
match: { goals: 0, assists: 0, cleanSheet: false, defensiveContribution: 15, opponentFdr: 2, minutesPlayed: 90 }
resolution: GK skips DefCon entirely regardless of value → Blank → base −1 × 1.25 = −1.25 → round → −1
expected: delta=-1, reason="Blank vs FDR 2 opponent", confidenceAfter=-1, motmCounterAfter=0
```

### EX-22 — DEF one below threshold (defensiveContribution = 9, threshold = 10)

```
position: DEF
match: { goals: 0, assists: 0, cleanSheet: false, defensiveContribution: 9, opponentFdr: 3, minutesPlayed: 90 }
resolution: 9 < 10 → DefCon does not fire → Blank → base −1 × 1.0 = −1.0 → −1
expected: delta=-1, reason="Blank vs FDR 3 opponent", confidenceAfter=-1, motmCounterAfter=0
```

### EX-23 — DEF exactly at threshold (defensiveContribution = 10, threshold = 10)

```
position: DEF
match: { goals: 0, assists: 0, cleanSheet: false, defensiveContribution: 10, opponentFdr: 3, minutesPlayed: 90 }
resolution: 10 ≥ 10 → DefCon fires (≥ threshold, not >) → flat +1
expected: delta=+1, reason="DefCon vs FDR 3 opponent", confidenceAfter=+1, motmCounterAfter=0
```

### EX-24 — MID blank vs FDR 3 (neutral — multiplier ×1.0 has no effect)

```
position: MID
match: { goals: 0, assists: 0, defensiveContribution: 0, opponentFdr: 3, cleanSheet: false, minutesPlayed: 90 }
resolution: Blank → base −1 × 1.0 = −1.0 → −1. Confirms neutral FDR leaves blank unchanged.
expected: delta=-1, reason="Blank vs FDR 3 opponent", confidenceAfter=-1, motmCounterAfter=0
```

### EX-25 — FWD MOTM vs FDR 1 (easier fixture = reduced reward)

```
position: FWD
match: { goals: 1, assists: 0, opponentFdr: 1, cleanSheet: false, minutesPlayed: 90 }
resolution: MOTM (1 goal) → base +2 × MOTM_FDR_MULTIPLIERS[1] (= 0.75) = +1.5 → round half away from zero → +2
expected: delta=+2, reason="MOTM vs FDR 1 opponent", confidenceAfter=+2, motmCounterAfter=1
```

### EX-26 — DEF blank vs FDR 1 (harsher penalty for must-perform fixture)

```
position: DEF
match: { goals: 0, assists: 0, cleanSheet: false, defensiveContribution: 0, opponentFdr: 1, minutesPlayed: 90 }
resolution: Blank → base −1 × 1.5 = −1.5 → round half away from zero → −2
expected: delta=-2, reason="Blank vs FDR 1 opponent", confidenceAfter=-2, motmCounterAfter=0
```

### EX-27 — GK CS vs FDR 5 (hardest fixture earns extra)

```
position: GK
match: { goals: 0, assists: 0, cleanSheet: true, opponentFdr: 5, minutesPlayed: 90 }
resolution: CS → base +1 × CS_FDR_MULTIPLIERS[5] (= 1.5) = +1.5 → round half away from zero → +2
            Uses match.opponentFdr directly — no big-team override for CS.
expected: delta=+2, reason="Clean sheet vs FDR 5 opponent", confidenceAfter=+2, motmCounterAfter=0
```

### EX-28 — DefCon fires for MID vs FDR 5 (flat +1, no FDR multiplier)

```
position: MID
match: { goals: 0, assists: 0, defensiveContribution: 12, opponentFdr: 5, cleanSheet: false, minutesPlayed: 90 }
resolution: DefCon fires → flat +1 (FDR multiplier NOT applied)
Contrast: a Blank at FDR 5 would be −1 × 0.5 = −0.5 → −1. DefCon is better regardless of FDR.
expected: delta=+1, reason="DefCon vs FDR 5 opponent", confidenceAfter=+1, motmCounterAfter=0
```

### EX-29 — GK SaveCon vs FDR 5 (4+ saves, no CS, no G/A)

```
position: GK
match: { saves: 8, goals: 0, assists: 0, cleanSheet: false, opponentFdr: 5, minutesPlayed: 90 }
resolution: no G/A, no CS; saves 8 ≥ 4 → SaveCon → flat +1 (FDR multiplier NOT applied)
Contrast: without SaveCon, blank vs FDR 5 = −1 × 0.5 = −0.5 → −1.
expected: delta=+1, reason="SaveCon vs FDR 5 opponent", confidenceAfter=+1, motmCounterAfter=0
```

### EX-30 — GK CS fires, SaveCon silent (CS takes priority)

```
position: GK
match: { saves: 8, goals: 0, assists: 0, cleanSheet: true, opponentFdr: 3, minutesPlayed: 90 }
resolution: CS fires → base +1 × 1.0 = +1.0 → +1; SaveCon silent (positive event fired)
expected: delta=+1, reason="Clean sheet vs FDR 3 opponent", confidenceAfter=+1, motmCounterAfter=0
```

### EX-31 — GK one below SaveCon threshold (saves = 3), Blank fires

```
position: GK
match: { saves: 3, goals: 0, assists: 0, cleanSheet: false, opponentFdr: 1, minutesPlayed: 90 }
resolution: 3 < 4 → SaveCon does not fire → Blank → base −1 × 1.5 = −1.5 → round half away → −2
expected: delta=-2, reason="Blank vs FDR 1 opponent", confidenceAfter=-2, motmCounterAfter=0
```

### EX-32 — GK exactly at SaveCon threshold (saves = 4), SaveCon fires (boundary: ≥ not >)

```
position: GK
match: { saves: 4, goals: 0, assists: 0, cleanSheet: false, opponentFdr: 1, minutesPlayed: 90 }
resolution: 4 ≥ 4 → SaveCon fires → flat +1
Contrast: EX-31 has saves=3 and fires the Blank. This confirms the threshold is ≥ not >.
expected: delta=+1, reason="SaveCon vs FDR 1 opponent", confidenceAfter=+1, motmCounterAfter=0
```

### EX-33 — DEF with high saves, no other events, vs FDR 3 (SaveCon never fires for DEF)

```
position: DEF
match: { saves: 8, goals: 0, assists: 0, cleanSheet: false, defensiveContribution: 0, opponentFdr: 3, minutesPlayed: 90 }
resolution: DEF excluded from SaveCon regardless of save count → Blank → base −1 × 1.0 = −1.0 → −1
expected: delta=-1, reason="Blank vs FDR 3 opponent", confidenceAfter=-1, motmCounterAfter=0
```

### EX-34 — Fatigue waived: recovering player (built from scratch with FDR 1 MOTM setup)

Multi-match scenario to verify that the waiver fires correctly when the 3rd MOTM event cannot push confidence above zero.

```
position: FWD
matches:
  GW1: goals=1, opponentFdr=1 → MOTM → +2 × MOTM_FDR_MULTIPLIERS[1] (= 0.75) = +1.5 → +2
       conf=+2, motm=1
  GW2: goals=1, opponentFdr=1 → MOTM → +2 × 0.75 = +1.5 → +2
       conf=+4, motm=2
  GW3–GW9: 7× blank vs FDR 3 → −1 each; conf: +4 → +3 → +2 → +1 → 0 → −1 → −2 → −3
  GW10: goals=1, opponentFdr=3
        MOTM → base +2 × 1.0 = +2.0 → motmRaw=+2
        confidenceAfterMotm = clamp(−3 + 2) = −1
        counter = 3 → fatigue evaluates
        hypotheticalPostFatigue = −1 + (−2) = −3   → −3 ≤ 0, waived
history[9] (GW10) expected:
  confidenceAfter=−1, delta=+2, reason="MOTM vs FDR 3 opponent + Fatigue waived",
  fatigueApplied=false, motmCounterAfter=0
```

### EX-35 — Fatigue applies: post-MOTM is positive, post-fatigue still positive

```
position: FWD
preceding state: confidence=+1, motmCount=2
match: { goals: 1, assists: 0, opponentFdr: 3, cleanSheet: false, minutesPlayed: 90 }
resolution:
  MOTM (1 goal) → base +2 × 1.0 = +2.0 → motmRaw=+2
  confidenceAfterMotm = clamp(+1 + 2) = +3
  counter = 3 → fatigue evaluates
  hypotheticalPostFatigue = +3 + (−2) = +1   → +1 > 0, applied
expected: confidenceAfter=+1, delta=0, reason="MOTM vs FDR 3 opponent + Fatigue −2",
          fatigueApplied=true, motmCounterAfter=0
```

### EX-36 — Fatigue waived: post-MOTM lands at exactly 0 (boundary)

```
position: FWD
preceding state: confidence=−2, motmCount=2
match: { goals: 1, assists: 0, opponentFdr: 3, cleanSheet: false, minutesPlayed: 90 }
resolution:
  MOTM (1 goal) → base +2 × 1.0 = +2.0 → motmRaw=+2
  confidenceAfterMotm = clamp(−2 + 2) = 0
  counter = 3 → fatigue evaluates
  hypotheticalPostFatigue = 0 + (−2) = −2   → −2 ≤ 0, waived (0 ≤ 0 is the inclusive boundary)
expected: confidenceAfter=0, delta=+2, reason="MOTM vs FDR 3 opponent + Fatigue waived",
          fatigueApplied=false, motmCounterAfter=0
```

### EX-37 — Fatigue waived: hypothetical would be exactly −1 (strict check catches it)

```
position: FWD
preceding state: confidence=−1, motmCount=2
match: { goals: 1, assists: 0, opponentFdr: 3, cleanSheet: false, minutesPlayed: 90 }
resolution:
  MOTM (1 goal) → base +2 × 1.0 = +2.0 → motmRaw=+2
  confidenceAfterMotm = clamp(−1 + 2) = +1
  counter = 3 → fatigue evaluates
  hypotheticalPostFatigue = +1 + (−2) = −1   → −1 ≤ 0, waived
expected: confidenceAfter=+1, delta=+2, reason="MOTM vs FDR 3 opponent + Fatigue waived",
          fatigueApplied=false, motmCounterAfter=0
```

### EX-38 — Fatigue applies: clearly above zero after penalty

```
position: FWD
preceding state: confidence=+2, motmCount=2
match: { goals: 1, assists: 0, opponentFdr: 3, cleanSheet: false, minutesPlayed: 90 }
resolution:
  MOTM (1 goal) → base +2 × 1.0 = +2.0 → motmRaw=+2
  confidenceAfterMotm = clamp(+2 + 2) = +4
  counter = 3 → fatigue evaluates
  hypotheticalPostFatigue = +4 + (−2) = +2   → +2 > 0, applied
expected: confidenceAfter=+2, delta=0, reason="MOTM vs FDR 3 opponent + Fatigue −2",
          fatigueApplied=true, motmCounterAfter=0
```

### EX-39 — DC Fatigue applies: 3× DefCon-as-primary from 0 (MID)

```
position: MID
matches:
  GW1: goals=0, assists=0, defensiveContribution=12, opponentFdr=3 → DefCon-only → flat +1
       conf=+1, defConCounterAfter=1
  GW2: goals=0, assists=0, defensiveContribution=12, opponentFdr=3 → DefCon-only → flat +1
       conf=+2, defConCounterAfter=2
  GW3: goals=0, assists=0, defensiveContribution=12, opponentFdr=3 → DefCon-only
       confidenceAfterDefCon = clamp(+2 + 1) = +3
       counter = 3 → DC Fatigue evaluates
       hypotheticalPostFatigue = +3 + (−2) = +1   → +1 > 0, penalty applied
       conf=+1, defConCounterAfter=0, dcFatigueApplied=true
GW3 expected: delta=−1, reason="DefCon vs FDR 3 opponent + DC Fatigue −2",
              dcFatigueApplied=true, defConCounterAfter=0
finalConfidence: +1
```

### EX-40 — DC Fatigue waived: 3× DefCon-as-primary from −2 (MID)

Starting at −2, DefCon accumulates but the penalty is waived because the hypothetical result is negative.

```
position: MID
matches:
  GW1: DefCon-only → flat +1; conf=−1, defConCounterAfter=1
  GW2: DefCon-only → flat +1; conf=0,  defConCounterAfter=2
  GW3: DefCon-only
       confidenceAfterDefCon = clamp(0 + 1) = +1
       counter = 3 → DC Fatigue evaluates
       hypotheticalPostFatigue = +1 + (−2) = −1   → −1 ≤ 0, waived
       conf=+1, defConCounterAfter=0, dcFatigueApplied=false
GW3 expected: delta=+1, reason="DefCon vs FDR 3 opponent + DC Fatigue waived",
              dcFatigueApplied=false, defConCounterAfter=0
finalConfidence: +1
```

### EX-41 — DC Fatigue boundary: confidenceAfterDefCon = 0 (waived)

Analogous to EX-36 (MOTM boundary). The hypothetical result is −2, which is ≤ 0, so the penalty is waived even though the counter hit 3.

```
position: MID
preceding state: confidence=−1, defConFatigueCount=2
match: goals=0, assists=0, defensiveContribution=12, opponentFdr=3
       confidenceAfterDefCon = clamp(−1 + 1) = 0
       counter = 3 → DC Fatigue evaluates
       hypotheticalPostFatigue = 0 + (−2) = −2   → −2 ≤ 0, waived
expected: confidenceAfter=0, delta=+1, reason="DefCon vs FDR 3 opponent + DC Fatigue waived",
          dcFatigueApplied=false, defConCounterAfter=0
```

### EX-42 — Counter independence: motmCount=2, DefCon fires → defConCounterAfter=1, motmCount unchanged

```
position: MID
preceding state: confidence=+1, motmCount=2, defConFatigueCount=0
match: goals=0, assists=0, defensiveContribution=12, opponentFdr=3
       DefCon fires as primary → flat +1; defConFatigueCount increments to 1; motmCount stays 2
expected: confidenceAfter=+2, delta=+1, reason="DefCon vs FDR 3 opponent",
          fatigueApplied=false, dcFatigueApplied=false,
          motmCounterAfter=2, defConCounterAfter=1
```

### EX-43 — DefCon silent → defConFatigueCount unchanged

When a positive event fires (CS), DefCon is silent. The DC Fatigue counter must not increment.

```
position: DEF
preceding state: confidence=0, defConFatigueCount=1
match: goals=0, assists=0, cleanSheet=true, defensiveContribution=10, opponentFdr=3
       CS fires → base +1 × 1.0 = +1; DefCon is silent
expected: confidenceAfter=+1, delta=+1, reason="Clean sheet vs FDR 3 opponent",
          dcFatigueApplied=false, defConCounterAfter=1  (unchanged)
```

### EX-44 — Cross-counter isolation: MOTM fires, defConFatigueCount stays 2

When `motmCount` reaches 3 and MOTM Fatigue triggers, the `defConFatigueCount` is not touched.

```
position: MID
preceding state: confidence=+3, motmCount=2, defConFatigueCount=2
match: goals=1, assists=0, opponentFdr=3
       MOTM fires → motmCount increments to 3
       confidenceAfterMotm = clamp(+3 + 2) = +5
       MOTM Fatigue evaluates: hypothetical = +5 − 2 = +3 > 0 → applied
       conf=+3; motmCount resets to 0; defConFatigueCount stays 2
expected: confidenceAfter=+3, delta=0, reason="MOTM vs FDR 3 opponent + Fatigue −2",
          fatigueApplied=true, dcFatigueApplied=false,
          motmCounterAfter=0, defConCounterAfter=2  (unchanged)
```

### EX-45 — SC Fatigue applies: 3× SaveCon-as-primary from 0 (GK)

Mirror of EX-39, for GK with SaveCon.

```
position: GK
matches:
  GW1: saves=5, goals=0, assists=0, cleanSheet=false, opponentFdr=3 → SaveCon → flat +1
       conf=+1, saveConCounterAfter=1
  GW2: saves=5, goals=0, assists=0, cleanSheet=false, opponentFdr=3 → SaveCon → flat +1
       conf=+2, saveConCounterAfter=2
  GW3: saves=5, goals=0, assists=0, cleanSheet=false, opponentFdr=3 → SaveCon
       confidenceAfterSaveCon = clamp(+2 + 1) = +3
       counter = 3 → SC Fatigue evaluates
       hypotheticalPostFatigue = +3 + (−2) = +1   → +1 > 0, penalty applied
       conf=+1, saveConCounterAfter=0, scFatigueApplied=true
GW3 expected: delta=−1, reason="SaveCon vs FDR 3 opponent + SC Fatigue −2",
              scFatigueApplied=true, saveConCounterAfter=0
finalConfidence: +1
```

### EX-46 — SC Fatigue waived: GK at −3, confidenceAfterSaveCon = −2

```
position: GK
preceding state: confidence=−3, saveConFatigueCount=2
match: saves=5, goals=0, assists=0, cleanSheet=false, opponentFdr=3
       confidenceAfterSaveCon = clamp(−3 + 1) = −2
       counter = 3 → SC Fatigue evaluates
       hypotheticalPostFatigue = −2 + (−2) = −4   → −4 ≤ 0, waived
expected: confidenceAfter=−2, delta=+1, reason="SaveCon vs FDR 3 opponent + SC Fatigue waived",
          scFatigueApplied=false, saveConCounterAfter=0
```

### EX-47 — Mutual exclusivity: GK never touches defConFatigueCount; DEF never touches saveConFatigueCount

**Part a — GK SaveCon does not increment defConFatigueCount:**

```
position: GK
preceding state: defConFatigueCount=0, saveConFatigueCount=0
match: saves=5, goals=0, assists=0, cleanSheet=false, opponentFdr=3
       SaveCon fires → saveConFatigueCount=1; defConFatigueCount stays 0
expected: defConCounterAfter=0, saveConCounterAfter=1
```

**Part b — DEF DefCon does not increment saveConFatigueCount:**

```
position: DEF
preceding state: defConFatigueCount=0, saveConFatigueCount=0
match: saves=0, goals=0, assists=0, cleanSheet=false, defensiveContribution=10, opponentFdr=3
       DefCon fires → defConFatigueCount=1; saveConFatigueCount stays 0
expected: defConCounterAfter=1, saveConCounterAfter=0
```

---

## 9. Required property tests

In addition to the worked examples, `calculator.test.ts` includes property-based tests using `fast-check`:

### PROP-01 — Output is always within `[-4, +5]`

For any valid `CalculatorInput`, `finalConfidence` ∈ `[-4, +5]` and every `history[i].confidenceAfter` ∈ `[-4, +5]`.

### PROP-02 — Empty matches produce zero

For any `Position`, `calculate({ position, matches: [] }).finalConfidence === 0`.

### PROP-03 — Determinism

Calling `calculate(input)` twice with the same input produces deeply equal outputs.

### PROP-04 — DefCon never increments the MOTM counter

For any DEF/MID/FWD match where only DefCon fires (goals = 0, assists = 0, cleanSheet = false, defensiveContribution ≥ threshold), `motmCounterAfter` equals `motmCounterBefore`. DefCon is structurally excluded from the MOTM fatigue loop.

### PROP-06 — SaveCon never increments the MOTM counter

For any GK match where only SaveCon fires (saves ≥ 4, goals = 0, assists = 0, cleanSheet = false), `motmCounterAfter` equals `motmCounterBefore`. SaveCon is structurally excluded from the MOTM fatigue loop, identical to DefCon.

### PROP-07 — MOTM Fatigue never pushes confidence to ≤ 0

For any `MatchDelta` in the calculator output: if `fatigueApplied === true`, then `confidenceAfter > 0`. The penalty is only applied when doing so keeps the player strictly above the neutral floor; the waiver mechanism guarantees this invariant by construction.

Property test form: for any valid `CalculatorInput`, every `history[i]` satisfies `history[i].fatigueApplied === false || history[i].confidenceAfter > 0`.

### PROP-08 — DC Fatigue never pushes confidence to ≤ 0

Identical invariant for the DC Fatigue path: if `dcFatigueApplied === true`, then `confidenceAfter > 0`.

Property test form: for any valid `CalculatorInput`, every `history[i]` satisfies `history[i].dcFatigueApplied === false || history[i].confidenceAfter > 0`.

### PROP-09 — SC Fatigue never pushes confidence to ≤ 0

Identical invariant for the SC Fatigue path: if `scFatigueApplied === true`, then `confidenceAfter > 0`.

Property test form: for any valid `CalculatorInput`, every `history[i]` satisfies `history[i].scFatigueApplied === false || history[i].confidenceAfter > 0`.

### PROP-10 — Counter mutual exclusivity

For any `MatchDelta`, at most one counter can have incremented relative to the previous match's counters. Specifically:

- If `motmCounterAfter > prevMotmCounterAfter` (counter incremented), then `defConCounterAfter === prevDefConCounterAfter` and `saveConCounterAfter === prevSaveConCounterAfter`.
- If `defConCounterAfter > prevDefConCounterAfter` (counter incremented, not reset), then `motmCounterAfter === prevMotmCounterAfter` and `saveConCounterAfter === prevSaveConCounterAfter`.
- If `saveConCounterAfter > prevSaveConCounterAfter` (counter incremented, not reset), then `motmCounterAfter === prevMotmCounterAfter` and `defConCounterAfter === prevDefConCounterAfter`.

Note: counter resets (to 0) are excluded from this check since a reset and an increment on a different counter can occur in the same match when fatigue fires.

### PROP-11 — DEF MOTM at any FDR — Clean Sheet is suppressed

For any DEF match where `goals ≥ 1` or `assists ≥ 2`, regardless of `cleanSheet` value and `opponentFdr`:

- `reason` must **not** contain the string `"Clean sheet"`
- `reason` must contain `"MOTM"`

This verifies the `!isMotm` gate on the CS branch is structurally enforced.

```ts
for (const opponentFdr of [1, 2, 3, 4, 5] as const) {
  const result = calculateConfidence({
    position: 'DEF',
    matches: [aMatch({ goals: 1, cleanSheet: true, opponentFdr })],
  });
  const reason = result.history[0]?.reason ?? '';
  expect(reason).not.toContain('Clean sheet');
  expect(reason).toMatch(/MOTM/);
}
```

### PROP-05 — FDR multiplier never produces out-of-range values

For any valid `CalculatorInput` with `opponentFdr ∈ {1, 2, 3, 4, 5}`, `finalConfidence ∈ [-4, +5]` and every `history[i].confidenceAfter ∈ [-4, +5]`. The FDR multiplier never allows values to escape the clamp range from a starting confidence that is already within range. (This is a tighter claim than PROP-01 — it verifies that FDR scaling specifically does not break the invariant.)

---

## 10. Reference implementation

This pseudocode is illustrative. The real implementation must be cleanly typed, broken into helpers, and follow ENGINEERING.md standards — but the logic flow must match exactly.

```ts
import { clamp } from '@/lib/utils/math';
import type { CalculatorInput, CalculatorOutput, MatchDelta, MatchEvent, Position } from './types';

const CONFIDENCE_MIN = -4;
const CONFIDENCE_MAX = 5;
const FATIGUE_THRESHOLD = 3;
const FATIGUE_PENALTY = -2;

const SAVECON_THRESHOLD = 4;
const DEFCON_THRESHOLD: Record<Position, number | null> = {
  GK: null,
  DEF: 10,
  MID: 12,
  FWD: 12,
};

/** MOTM events (1+ goals OR 2+ assists). Elevated reward at FDR 4–5. */
const MOTM_FDR_MULTIPLIERS: Record<number, number> = {
  1: 0.75,
  2: 0.75,
  3: 1.0,
  4: 2.0,
  5: 2.5,
};

/** Performance events (1 assist, 0 goals). Steeply boosted at FDR 4–5. */
const PERFORMANCE_FDR_MULTIPLIERS: Record<number, number> = {
  1: 0.5,
  2: 0.75,
  3: 1.0,
  4: 2.5,
  5: 3.5,
};

/**
 * Clean sheet multiplier. Applied via match.opponentFdr directly — the big-team
 * override does NOT apply to CS. Yields +1 at FDR 1–4 and +2 at FDR 5.
 */
const CS_FDR_MULTIPLIERS: Record<number, number> = {
  1: 0.5,
  2: 0.75,
  3: 1.0,
  4: 1.25,
  5: 1.5,
};

/** Blank penalty. Inverse relationship to MOTM table. */
const FDR_BLANK_MULTIPLIER: Record<number, number> = {
  1: 1.5,
  2: 1.25,
  3: 1.0,
  4: 0.75,
  5: 0.5,
};

/**
 * Opponents whose team ID triggers effective FDR 5 for MOTM/Performance/Blank events.
 * Does NOT apply to CS, DefCon, or SaveCon.
 *   7 = Chelsea, 12 = Liverpool, 13 = Man City, 14 = Man Utd
 */
const BIG_TEAM_IDS: ReadonlySet<number> = new Set([7, 12, 13, 14]);

function getOpponentLabel(match: MatchEvent): { fdr: number; label: string } {
  if (BIG_TEAM_IDS.has(match.opponentTeamId)) {
    return { fdr: 5, label: 'BIG' };
  }
  return { fdr: match.opponentFdr, label: `FDR ${match.opponentFdr.toString()}` };
}

function roundAwayFromZero(x: number): number {
  return Math.sign(x) * Math.round(Math.abs(x));
}

function isDefConThresholdMet(position: Position, defensiveContribution: number): boolean {
  const threshold = DEFCON_THRESHOLD[position];
  return threshold !== null && defensiveContribution >= threshold;
}

interface MatchAdjustment {
  readonly raw: number;
  readonly reasons: readonly string[];
  readonly isMotm: boolean;
  readonly isDefCon: boolean;
  readonly isSaveCon: boolean;
}

function resolveMidFwd(match: MatchEvent, defconHit: boolean): MatchAdjustment {
  const { fdr, label } = getOpponentLabel(match);
  const motmMul = MOTM_FDR_MULTIPLIERS[fdr] ?? 1;
  const perfMul = PERFORMANCE_FDR_MULTIPLIERS[fdr] ?? 1;
  const blkMul = FDR_BLANK_MULTIPLIER[fdr] ?? 1;

  if (match.goals >= 1 || match.assists >= 2) {
    return {
      raw: roundAwayFromZero(2 * motmMul),
      reasons: [`MOTM vs ${label} opponent`],
      isMotm: true,
      isDefCon: false,
      isSaveCon: false,
    };
  }
  if (match.assists === 1) {
    const raw = roundAwayFromZero(1 * perfMul);
    const reclassified = raw >= 3; // fires at FDR 4 (+3) and FDR 5 (+4)
    return {
      raw,
      reasons: [reclassified ? `MOTM vs ${label} opponent` : `Performance vs ${label} opponent`],
      isMotm: reclassified,
      isDefCon: false,
      isSaveCon: false,
    };
  }
  if (defconHit) {
    return {
      raw: 1,
      reasons: [`DefCon vs FDR ${match.opponentFdr.toString()} opponent`],
      isMotm: false,
      isDefCon: true,
      isSaveCon: false,
    };
  }
  return {
    raw: roundAwayFromZero(-1 * blkMul),
    reasons: [`Blank vs ${label} opponent`],
    isMotm: false,
    isDefCon: false,
    isSaveCon: false,
  };
}

function resolveGkDef(
  match: MatchEvent,
  position: 'GK' | 'DEF',
  defconHit: boolean,
): MatchAdjustment {
  const { fdr: effectiveFdr, label } = getOpponentLabel(match);
  const motmMul = MOTM_FDR_MULTIPLIERS[effectiveFdr] ?? 1;
  const perfMul = PERFORMANCE_FDR_MULTIPLIERS[effectiveFdr] ?? 1;
  const csMul = CS_FDR_MULTIPLIERS[match.opponentFdr] ?? 1; // actual FDR — no BIG override
  const blkMul = FDR_BLANK_MULTIPLIER[effectiveFdr] ?? 1;
  const actualFdr = match.opponentFdr;

  let rawFloat = 0;
  const reasons: string[] = [];
  let isMotm = false;
  let isPerformance = false;

  // MOTM: 1+ goals takes priority; 2+ assists also qualifies.
  if (match.goals >= 1 || match.assists >= 2) {
    rawFloat += 2 * motmMul;
    reasons.push(`MOTM vs ${label} opponent`);
    isMotm = true;
  } else if (match.assists === 1) {
    // Single assist: Performance path for GK/DEF — no MOTM reclassification, ever.
    rawFloat += 1 * perfMul;
    reasons.push(`Assist vs ${label} opponent`);
    isPerformance = true;
  }

  // CS fires only if MOTM did not fire. CS uses actual FDR (no big-team override).
  if (!isMotm && match.cleanSheet) {
    rawFloat += 1 * csMul;
    reasons.push(`Clean sheet vs FDR ${actualFdr.toString()} opponent`);
  }

  // DefCon/SaveCon fire only when no positive event has already fired.
  let isDefCon = false;
  let isSaveCon = false;
  if (!isMotm && !isPerformance && !match.cleanSheet) {
    if (position === 'DEF' && defconHit) {
      rawFloat += 1;
      reasons.push(`DefCon vs FDR ${actualFdr.toString()} opponent`);
      isDefCon = true;
    } else if (position === 'GK' && match.saves >= SAVECON_THRESHOLD) {
      rawFloat += 1;
      reasons.push(`SaveCon vs FDR ${actualFdr.toString()} opponent`);
      isSaveCon = true;
    } else {
      rawFloat += -1 * blkMul;
      reasons.push(`Blank vs ${label} opponent`);
    }
  }

  const raw = roundAwayFromZero(rawFloat);
  // Safety guard: non-MOTM, non-Performance stacking result ≥ +3 is reclassified.
  // With current event values this cannot fire — retained as a defensive invariant.
  if (raw >= 3 && !isMotm && !isPerformance) {
    isMotm = true;
  }
  return { raw, reasons, isMotm, isDefCon, isSaveCon };
}

export function calculateConfidence(input: CalculatorInput): CalculatorOutput {
  let confidence = 0;
  let motmCount = 0;
  let defConFatigueCount = 0;
  let saveConFatigueCount = 0;
  const history: MatchDelta[] = [];

  for (const match of input.matches) {
    const before = confidence;
    const defconHit = isDefConThresholdMet(input.position, match.defensiveContribution);

    const { raw, reasons, isMotm, isDefCon, isSaveCon } =
      input.position === 'GK' || input.position === 'DEF'
        ? resolveGkDef(match, input.position, defconHit)
        : resolveMidFwd(match, defconHit);

    const reasonList = [...reasons];
    let fatigueApplied = false;
    let dcFatigueApplied = false;
    let scFatigueApplied = false;

    // Clamp after the event gain; fatigue is applied to the clamped value.
    confidence = clamp(before + raw, CONFIDENCE_MIN, CONFIDENCE_MAX);
    // rawDelta: pre-fatigue delta, used by the Hot Streak engine.
    const rawDelta = confidence - before;

    // Exactly one of these three branches executes per match (see §6.4).
    if (isMotm) {
      motmCount += 1;
      if (motmCount >= FATIGUE_THRESHOLD) {
        const hypotheticalPostFatigue = confidence + FATIGUE_PENALTY;
        if (hypotheticalPostFatigue > 0) {
          confidence = hypotheticalPostFatigue;
          reasonList.push('Fatigue −2');
          fatigueApplied = true;
        } else {
          reasonList.push('Fatigue waived');
        }
        motmCount = 0;
      }
    } else if (isDefCon) {
      defConFatigueCount += 1;
      if (defConFatigueCount >= FATIGUE_THRESHOLD) {
        const hypotheticalPostFatigue = confidence + FATIGUE_PENALTY;
        if (hypotheticalPostFatigue > 0) {
          confidence = hypotheticalPostFatigue;
          reasonList.push('DC Fatigue −2');
          dcFatigueApplied = true;
        } else {
          reasonList.push('DC Fatigue waived');
        }
        defConFatigueCount = 0;
      }
    } else if (isSaveCon) {
      saveConFatigueCount += 1;
      if (saveConFatigueCount >= FATIGUE_THRESHOLD) {
        const hypotheticalPostFatigue = confidence + FATIGUE_PENALTY;
        if (hypotheticalPostFatigue > 0) {
          confidence = hypotheticalPostFatigue;
          reasonList.push('SC Fatigue −2');
          scFatigueApplied = true;
        } else {
          reasonList.push('SC Fatigue waived');
        }
        saveConFatigueCount = 0;
      }
    }

    history.push({
      gameweek: match.gameweek,
      delta: confidence - before,
      rawDelta,
      reason: reasonList.join(' + '),
      fatigueApplied,
      dcFatigueApplied,
      scFatigueApplied,
      confidenceAfter: confidence,
      motmCounterAfter: motmCount,
      defConCounterAfter: defConFatigueCount,
      saveConCounterAfter: saveConFatigueCount,
    });
  }

  return { finalConfidence: confidence, history };
}
```

---

## 11. Team Confidence

Team Confidence converts a manager's current squad into a single percentage that reflects the positional confidence balance across starters.

### 11.1 Types

```ts
// src/lib/team-confidence/types.ts
import type { Position } from '@/lib/confidence/types';

/** One player in a manager's squad as returned by the picks endpoint. */
export interface SquadPick {
  readonly playerId: number;
  readonly squadPosition: number; // 1–15; 1–11 = starters, 12–15 = bench
  readonly isCaptain: boolean;
  readonly isViceCaptain: boolean;
}

/** Input to the team calculator. */
export interface TeamCalculatorInput {
  readonly picks: readonly SquadPick[];
  /** Map from playerId → { confidence, position } — caller resolves from confidence snapshots. */
  readonly playerData: ReadonlyMap<
    number,
    { readonly confidence: number; readonly position: Position }
  >;
}

/** Positional line averages, each in [-5, +5]. */
export interface PositionalRating {
  readonly defence: number; // average of GK + all DEF starters
  readonly midfield: number; // average of all MID starters
  readonly attack: number; // average of all FWD starters
}

export interface TeamCalculatorOutput {
  readonly teamConfidencePercent: number; // 0..100, two decimal places
  readonly positional: PositionalRating;
  readonly starterCount: number; // always 11 for a valid squad
}
```

### 11.2 Algorithm

1. **Filter starters:** keep only picks where `squadPosition <= 11`.
2. **Group by position** using the `position` field from `playerData`.
3. **Compute line averages:**
   - `defence` = mean confidence of all GK + DEF starters
   - `midfield` = mean confidence of all MID starters
   - `attack` = mean confidence of all FWD starters
4. **Compute team average:** `lineAverage = mean(defence, midfield, attack)`
5. **Convert to percent** using the piecewise mapping that keeps 50 % as the neutral baseline regardless of the asymmetric internal scale:

   ```ts
   function confidenceToPercent(value: number): number {
     if (value >= 0) return 50 + (value / 5) * 50; // [0, +5] → [50%, 100%]
     return 50 + (value / 4) * 50; // [-4, 0) → [0%, 50%)
   }
   ```

   Key mappings: −4 → 0 %, −2 → 25 %, 0 → 50 %, +2.5 → 75 %, +5 → 100 %.

   Apply `confidenceToPercent` to both `lineAverage` (for `teamConfidencePercent`) and each positional line average (for the per-line breakdown rendered in the UI).

6. **Round** to two decimal places.

If a positional line has zero starters (malformed input), the line average is `0` (neutral). The calculator does **not** throw — it handles sparse squads gracefully.

### 11.3 Worked examples (canonical test cases — TEAM-EX series)

Each example maps to a required `it(...)` block in `src/lib/team-confidence/teamCalculator.test.ts`.

#### TEAM-EX-01 — Fully positive squad

All 11 starters at confidence +5:

```
defence: +5, midfield: +5, attack: +5
lineAverage: +5
confidenceToPercent(+5) = 50 + (5 / 5) × 50 = 100
expected: teamConfidencePercent = 100.00
```

#### TEAM-EX-02 — Fully negative squad

All 11 starters at confidence −4 (the new floor):

```
defence: −4, midfield: −4, attack: −4
lineAverage: −4
confidenceToPercent(−4) = 50 + (−4 / 4) × 50 = 0
expected: teamConfidencePercent = 0.00
```

#### TEAM-EX-03 — Neutral squad

All 11 starters at confidence 0:

```
defence: 0, midfield: 0, attack: 0
lineAverage: 0
confidenceToPercent(0) = 50
expected: teamConfidencePercent = 50.00
```

#### TEAM-EX-04 — Mixed positional lines

```
Defence starters (GK + 3 DEF): confidences [+3, +2, +2, −1] → mean = +1.50
Midfield starters (4 MID):     confidences [+4, +2, 0, −2]  → mean = +1.00
Attack starters (3 FWD):       confidences [+5, +3, +1]     → mean = +3.00
lineAverage: (+1.50 + 1.00 + 3.00) / 3 = +1.8333...
confidenceToPercent(+1.8333...) = 50 + (1.8333... / 5) × 50 = 68.33
expected: teamConfidencePercent = 68.33
```

Note: for positive lineAverage values the piecewise formula is algebraically identical to the
old symmetric formula — both reduce to `50 + 10 × value`. The visual difference only
materialises when `lineAverage < 0`.

#### TEAM-EX-05 — Bench players excluded

Squad has 15 picks (11 starters, 4 bench). All bench players at +5, all starters at 0:

```
lineAverage: 0
confidenceToPercent(0) = 50
expected: teamConfidencePercent = 50.00  (bench ignored)
```

#### TEAM-EX-06 — One positional line missing (malformed squad)

Only GK + DEF + MID starters present, no FWD picks at all:

```
defence:  computed normally
midfield: computed normally
attack:   0  (fallback — no FWD starters found)
lineAverage: mean(defence, midfield, 0)
```

### 11.4 Property tests (TEAM-PROP series)

#### TEAM-PROP-01 — Output is always in [0, 100]

For any valid `TeamCalculatorInput`, `teamConfidencePercent ∈ [0, 100]`.

#### TEAM-PROP-02 — Neutral squad always yields 50%

If every starter has `confidence = 0`, `teamConfidencePercent = 50.00`.

#### TEAM-PROP-03 — Bench picks do not affect output

For any squad, replacing all bench-pick confidences with arbitrary values produces identical output.

### 11.5 Module location

```
src/lib/team-confidence/
├── index.ts              # public barrel
├── types.ts
├── teamCalculator.ts
├── teamCalculator.test.ts
└── README.md
```
