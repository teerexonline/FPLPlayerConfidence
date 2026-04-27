# Autonomous Session Status

**Session completed:** 2026-04-27
**Items in scope:** Item 0 (GW scrubber bugs 0.A/0.B/0.C) · Item D (probability calibration v1.3.2)

---

## Item 0 — My Team GW Scrubber Bugs

All three bugs fixed and committed.

| Bug | Root cause                                                                                                                                                                                                            | Fix                                                                                                                  | Status   |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | -------- |
| 0.A | `doFetch` error handler unconditionally removed localStorage and reset to idle on any non-PRE_SEASON API error — even during historical GW navigation — because it never checked whether `existingState` was provided | Gate the disconnect logic on `existingState === undefined`; restore `existingState` on historical navigation failure | ✅ Fixed |
| 0.B | Fixed in prior session                                                                                                                                                                                                | —                                                                                                                    | ✅ Fixed |
| 0.C | Fixed in prior session                                                                                                                                                                                                | —                                                                                                                    | ✅ Fixed |

**Affected file:** `src/app/my-team/_components/MyTeamPageClient.tsx`

---

## Item D — Probability Model Calibration (v1.3.2)

**Outcome: Two attempts exhausted. FAIL documented. Hard block on UI integration remains.**

### What changed

Introduced `MAX_INVOLVEMENT_RATIO = 0.15` in `src/lib/probability/constants.ts`.

This scales all three per-event probability components (p_involved, p_goal_given_involved, p_assist_given_involved) from raw percentile ranks (0..1) into realistic involvement shares. Without it, v1.3.1 had 46% of predictions capped at MAX_GOAL_PROB=0.65 due to lambda saturation (median player → p_goal ≈ 0.95 at 90 min). With 0.15, median outfield player → p_goal ≈ 6.5%; top striker in FDR1 → p_goal ≈ 34%.

### Calibration results

| Attempt           | Constant | Goal MACE | Assist MACE | Goal Brier vs baseline | Verdict                                      |
| ----------------- | -------- | --------- | ----------- | ---------------------- | -------------------------------------------- |
| v1.3.1 (baseline) | —        | 28.7pp    | 23.7pp      | —                      | FAIL — cap saturation                        |
| v1.3.2 attempt 1  | 0.15     | 2.9pp ✓   | 1.3pp ✓     | 0.0729 vs 0.0711 ✗     | FAIL — FWD MACE 15.4pp, Brier above baseline |
| v1.3.2 attempt 2  | 0.20     | 4.5pp ✓   | 10.4pp ✗    | —                      | FAIL — assist model overshot; kept 0.15      |

**Kept at 0.15** (attempt 1). Two-attempt rule exhausted.

### Residual failures at 0.15

- **FWD position-specific goal MACE 15.4pp:** FWDs score ~21% of the time in the 10–20% prediction bucket versus 15% expected. The ICT-based ranking within the FWD cohort does not differentiate top strikers from squad attackers.
- **Brier marginally above baseline:** Goal 0.0729 vs 0.0711; assist 0.0726 vs 0.0722. Both driven by the same 10–20% bucket miscalibration.

### Root cause

A single global constant cannot simultaneously calibrate goal and assist probabilities across all four positions. FWDs have genuinely higher scoring rates than the global model produces, and adjusting the constant up to correct FWDs overshoots the assist model.

### Blocked

**UI integration of probabilities is blocked** until these failures are resolved. See `docs/v2/calibration-results.md` §Next steps for the three v1.4 options (position-specific constants, position-specific scaling, or isotonic regression calibration layer).

### Files changed this session for Item D

| File                                    | Change                                                                                        |
| --------------------------------------- | --------------------------------------------------------------------------------------------- |
| `src/lib/probability/constants.ts`      | Added `MAX_INVOLVEMENT_RATIO = 0.15` with full calibration rationale                          |
| `src/lib/probability/predictor.ts`      | Step 4: scale pInvolved / pGoalGivenInvolved / pAssistGivenInvolved by MAX_INVOLVEMENT_RATIO  |
| `src/lib/probability/predictor.test.ts` | Updated thresholds for 0.15 regime; added tests (8) and (9) for median and top-striker ranges |
| `docs/v2/fpl_probability_algorithm.md`  | Bumped to v1.3.2; updated Step 4 pseudocode and NOTE                                          |
| `docs/v2/calibration-results.md`        | Full calibration report: metrics, buckets, position table, history, root cause                |

---

## Test suite

**637/637 passing.** Typecheck clean.

---

## Open work for next session

1. **v1.4 calibration (requires approval):** Choose from the three options in `calibration-results.md` §Next steps before writing any code.
2. **UI integration of probabilities:** Blocked on calibration PASS. Do not start until calibration-results.md verdict is ✅ PASS.
