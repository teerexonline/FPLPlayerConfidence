# Autonomous Session Status — v1.4 Calibration

**Session completed:** 2026-04-27
**Item in scope:** v1.4 Probability calibration (position-specific INVOLVEMENT_MULTIPLIERS)

---

## Implementation — v1.3.3 (structure)

Replaced `MAX_INVOLVEMENT_RATIO` (single global constant) with:

- `BASE_INVOLVEMENT_RATIO = 0.15` — the v1.3.2 calibrated base, kept constant throughout
- `INVOLVEMENT_MULTIPLIERS` — `Record<Position, {goal: number; assist: number}>` applied on top, independently for goal and assist

MID `{goal:1.0, assist:1.0}` is the mathematical reference — MID predictions are identical to v1.3.2.
GK assist scaling moved from `GK_ASSIST_SCALE` (deprecated, Step 5) into `INVOLVEMENT_MULTIPLIERS['GK'].assist = 0.05` (Step 4).

Files changed:
| File | Change |
|------|--------|
| `src/lib/probability/constants.ts` | Added `BASE_INVOLVEMENT_RATIO`, `INVOLVEMENT_MULTIPLIERS`; deprecated `GK_ASSIST_SCALE` |
| `src/lib/probability/predictor.ts` | Step 4 uses `mults = INVOLVEMENT_MULTIPLIERS[seasonPos]`; Step 5 GK block only zeros pGoal |
| `src/lib/probability/predictor.test.ts` | 3 new tests (A position ordering, B MID baseline, C goal/assist independence); updated (1)(8)(9) comments/ranges |
| `docs/v2/fpl_probability_algorithm.md` | Bumped to v1.3.3; updated Step 4 pseudocode |

Tests: **640/640 passing.** Typecheck clean.

---

## Calibration Iterations

| Iteration | FWD goal mult | FWD MACE  | Overall goal MACE | Goal Brier | Verdict  |
| --------- | ------------- | --------- | ----------------- | ---------- | -------- |
| 1         | 1.5           | 11.8pp    | 3.4pp             | 0.0723     | FAIL     |
| 2         | 2.0           | 8.1pp     | 2.7pp             | 0.0718     | FAIL     |
| 3         | **2.5**       | **7.4pp** | **2.7pp**         | **0.0715** | **FAIL** |

All other multipliers stable throughout: DEF{goal:0.7,assist:1.0}, MID{1.0,1.0}, GK{0.0,0.05}.
Assist model solid: FWD assist MACE 1.8pp ✓, DEF 4.0pp ✓, MID 3.0pp ✓ across all iterations.

---

## Final Verdict: ❌ FAIL — 3-iteration cap exhausted

**Why the approach saturated:**
The improvement rate from iteration 2 → 3 collapsed from **3.7pp/step to 0.7pp/step**.
At iteration 3, the 40-50% goal bucket started over-predicting (32.4% observed vs 45% expected):
top-percentile FWDs in easy fixtures are pushed too high. Simultaneously, lower-percentile FWDs
in the 10-20% bucket still under-predict (19.3% observed vs 15% expected). A single scalar
multiplier cannot satisfy both. The crossed failure modes are structurally incompatible with the
position-multiplier approach.

**UI integration remains blocked.** Hard block, per user instruction.

---

## Recommended Next Step — v1.5

**Option 3: Isotonic regression calibration layer** (from the original option menu).

Learn a monotone mapping `raw_p_goal → calibrated_p_goal` per position, trained on the backtest data.
This captures the non-linear shape (the gap between Haaland tier and a 70th-percentile FWD is
non-linear in ICT percentile). Implementation sketch in `docs/v2/calibration-results.md` §Recommendation.

**Requires user approval before starting.**

---

## Commits This Session

| SHA     | Message                                                                          |
| ------- | -------------------------------------------------------------------------------- |
| e9f3b84 | feat(probability): v1.3.3 position-specific INVOLVEMENT_MULTIPLIERS              |
| 22027cc | fix(probability): calibration iteration 1 (goal:0/0.7/1/1.5 assist:0.05/1/1/0.8) |
| af486a1 | chore(probability): calibration complete after 3 iterations (v1.4 FAIL)          |
