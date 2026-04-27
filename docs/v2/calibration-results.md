# Probability Model Calibration Results

**Season:** 2025/26 (single-season; multi-season validation deferred)
**GW range:** GW 5–33 (GW 1–4 excluded as warmup)
**Total predictions:** 8699

---

## Final Verdict: ❌ FAIL

**3-iteration cap exhausted.** FWD goal MACE did not reach the 5pp acceptance threshold.
Brier scores remain marginally above baseline across all iterations.

**Residual failures (iteration 3 final state):**

- FWD goal MACE 7.4pp (threshold ≤5pp)
- Goal Brier 0.0715 ≥ baseline 0.0711
- Assist Brier 0.0727 ≥ baseline 0.0722

**Do not proceed to UI integration.** Block remains in place pending v1.5 approval.

---

## v1.4 Calibration — Iteration History

### Iteration 1 — GK{goal:0.0,assist:0.05} DEF{goal:0.7,assist:1.0} MID{goal:1.0,assist:1.0} FWD{goal:1.5,assist:0.8}

**Generated:** 2026-04-27T18:42:53Z · Model: v1.3.3

| Metric         | Goal model | Assist model |
| -------------- | ---------- | ------------ |
| MACE (overall) | 3.4pp      | 1.2pp        |
| Brier score    | 0.0723     | 0.0727       |
| Baseline Brier | 0.0711     | 0.0722       |
| Beats baseline | No ❌      | No ❌        |

**Position-stratified:**

| Position | N    | Goal MACE | Goal Brier | Assist MACE | Assist Brier |
| -------- | ---- | --------- | ---------- | ----------- | ------------ |
| GK       | 576  | 5.0pp     | 0.0000     | 4.7pp       | 0.0035       |
| DEF      | 2986 | 1.4pp     | 0.0344     | 4.0pp       | 0.0577       |
| MID      | 4059 | 2.5pp     | 0.0841     | 3.0pp       | 0.0949       |
| FWD      | 1078 | 11.8pp    | 0.1711     | 1.8pp       | 0.0678       |

**Goal calibration buckets:**

| Bucket | N    | Events | Observed | Expected | Error        |
| ------ | ---- | ------ | -------- | -------- | ------------ |
| 0–10%  | 7653 | 470    | 6.1%     | 5.0%     | 1.1pp        |
| 10–20% | 838  | 170    | 20.3%    | 15.0%    | 5.3pp        |
| 20–30% | 188  | 54     | 28.7%    | 25.0%    | 3.7pp        |
| 30–40% | 17   | 5      | 29.4%    | 35.0%    | — _(sparse)_ |
| 40–50% | 3    | 2      | 66.7%    | 45.0%    | — _(sparse)_ |

**Assist calibration buckets:**

| Bucket | N    | Events | Observed | Expected | Error |
| ------ | ---- | ------ | -------- | -------- | ----- |
| 0–10%  | 7228 | 473    | 6.5%     | 5.0%     | 1.5pp |
| 10–20% | 1295 | 173    | 13.4%    | 15.0%    | 1.6pp |
| 20–30% | 173  | 44     | 25.4%    | 25.0%    | 0.4pp |

**Analysis:** FWD goal multiplier 1.5 improved FWD MACE from 15.4pp → 11.8pp but still under-predicting.
The 10-20% goal bucket observed 20.3% vs 15% expected (5.3pp error). DEF/MID/GK within threshold.
Assist multipliers stable. **Action for iteration 2:** FWD goal 1.5 → 2.0 (33%, within 50% cap).

---

### Iteration 2 — GK{goal:0.0,assist:0.05} DEF{goal:0.7,assist:1.0} MID{goal:1.0,assist:1.0} FWD{goal:2.0,assist:0.8}

**Generated:** 2026-04-27T18:59:56Z · Model: v1.3.3

| Metric         | Goal model | Assist model |
| -------------- | ---------- | ------------ |
| MACE (overall) | 2.7pp      | 1.2pp        |
| Brier score    | 0.0718     | 0.0727       |
| Baseline Brier | 0.0711     | 0.0722       |
| Beats baseline | No ❌      | No ❌        |

**Position-stratified:**

| Position | N    | Goal MACE | Goal Brier | Assist MACE | Assist Brier |
| -------- | ---- | --------- | ---------- | ----------- | ------------ |
| GK       | 576  | 5.0pp     | 0.0000     | 4.7pp       | 0.0035       |
| DEF      | 2986 | 1.4pp     | 0.0344     | 4.0pp       | 0.0577       |
| MID      | 4059 | 2.5pp     | 0.0841     | 3.0pp       | 0.0949       |
| FWD      | 1078 | 8.1pp     | 0.1671     | 1.8pp       | 0.0678       |

**Goal calibration buckets:**

| Bucket | N    | Events | Observed | Expected | Error        |
| ------ | ---- | ------ | -------- | -------- | ------------ |
| 0–10%  | 7596 | 455    | 6.0%     | 5.0%     | 1.0pp        |
| 10–20% | 831  | 164    | 19.7%    | 15.0%    | 4.7pp        |
| 20–30% | 198  | 55     | 27.8%    | 25.0%    | 2.8pp        |
| 30–40% | 59   | 22     | 37.3%    | 35.0%    | 2.3pp        |
| 40–50% | 12   | 3      | 25.0%    | 45.0%    | — _(sparse)_ |
| 50–60% | 3    | 2      | 66.7%    | 55.0%    | — _(sparse)_ |

**Analysis:** FWD MACE 8.1pp (was 11.8pp, rate ~3.7pp per 0.5-unit). Upper buckets (30-40%) now calibrate well
(37.3% vs 35%). **Action for iteration 3:** FWD goal 2.0 → 2.5 (25%, within 50% cap).
Projected FWD MACE ~4.4pp based on linear extrapolation.

---

### Iteration 3 (FINAL) — GK{goal:0.0,assist:0.05} DEF{goal:0.7,assist:1.0} MID{goal:1.0,assist:1.0} FWD{goal:2.5,assist:0.8}

**Generated:** 2026-04-27T19:14:24Z · Model: v1.3.3

| Metric         | Goal model | Assist model |
| -------------- | ---------- | ------------ |
| MACE (overall) | 2.7pp      | 1.2pp        |
| Brier score    | 0.0715     | 0.0727       |
| Baseline Brier | 0.0711     | 0.0722       |
| Beats baseline | No ❌      | No ❌        |

**Position-stratified:**

| Position | N    | Goal MACE | Goal Brier | Assist MACE | Assist Brier |
| -------- | ---- | --------- | ---------- | ----------- | ------------ |
| GK       | 576  | 5.0pp     | 0.0000     | 4.7pp       | 0.0035       |
| DEF      | 2986 | 1.4pp     | 0.0344     | 4.0pp       | 0.0577       |
| MID      | 4059 | 2.5pp     | 0.0841     | 3.0pp       | 0.0949       |
| FWD      | 1078 | 7.4pp     | 0.1648     | 1.8pp       | 0.0678       |

**Goal calibration buckets:**

| Bucket | N    | Events | Observed | Expected | Error        |
| ------ | ---- | ------ | -------- | -------- | ------------ |
| 0–10%  | 7549 | 445    | 5.9%     | 5.0%     | 0.9pp        |
| 10–20% | 836  | 161    | 19.3%    | 15.0%    | 4.3pp        |
| 20–30% | 192  | 54     | 28.1%    | 25.0%    | 3.1pp        |
| 30–40% | 77   | 25     | 32.5%    | 35.0%    | 2.5pp        |
| 40–50% | 34   | 11     | 32.4%    | 45.0%    | — _(sparse)_ |
| 50–60% | 9    | 4      | 44.4%    | 55.0%    | — _(sparse)_ |
| 60–70% | 2    | 1      | 50.0%    | 65.0%    | — _(sparse)_ |

**Assist calibration buckets:**

| Bucket | N    | Events | Observed | Expected | Error |
| ------ | ---- | ------ | -------- | -------- | ----- |
| 0–10%  | 7228 | 473    | 6.5%     | 5.0%     | 1.5pp |
| 10–20% | 1295 | 173    | 13.4%    | 15.0%    | 1.6pp |
| 20–30% | 173  | 44     | 25.4%    | 25.0%    | 0.4pp |

**Failure analysis:**

- FWD MACE improved only 0.7pp (8.1pp → 7.4pp) at this step — improvement rate collapsed from 3.7pp/step to 0.7pp/step.
- The 40-50% bucket now **over-predicts** (32.4% observed vs 45% expected): top-percentile FWDs in easy fixtures are being pushed too high.
- Lower-percentile FWDs remain in the 10-20% bucket, still under-predicting (19.3% vs 15%).
- Opposite failure modes within the same position cannot be fixed by a single scalar multiplier. **The approach is structurally exhausted.**

---

## Progress Summary

| Attempt          | FWD goal mult | FWD MACE  | Goal MACE | Goal Brier | Verdict  |
| ---------------- | ------------- | --------- | --------- | ---------- | -------- |
| v1.3.2 (no mult) | 1.0           | 15.4pp    | 2.9pp     | 0.0729     | FAIL     |
| v1.4 iter 1      | 1.5           | 11.8pp    | 3.4pp     | 0.0723     | FAIL     |
| v1.4 iter 2      | 2.0           | 8.1pp     | 2.7pp     | 0.0718     | FAIL     |
| **v1.4 iter 3**  | **2.5**       | **7.4pp** | **2.7pp** | **0.0715** | **FAIL** |

FWD MACE improved 8.0pp total (15.4 → 7.4). Overall goal MACE improved. Goal Brier steadily
improved (0.0729 → 0.0715) but never crossed the 0.0711 baseline. 3-iteration cap exhausted.

---

## Root Cause — Why Position Multipliers Are Insufficient

A per-position scalar applies identically to all percentile tiers within a position. For FWDs:

- **Low-percentile FWDs** remain in the 10-20% bucket, still under-predicting (observed ~19% vs predicted 15%).
- **High-percentile FWDs** in easy fixtures have been pushed into the 40-50% bucket where they over-predict (observed only 32% vs predicted 45%).

These two failure modes require opposite adjustments and cannot both be satisfied by a single scalar multiplier. The improvement deceleration from 3.7pp/step to 0.7pp/step across iterations confirms the approach is saturating against this structural limit.

The underlying issue: **FPL goal events for FWDs are non-uniformly distributed across the ICT percentile spectrum.** A top-tier striker (Haaland tier) scores at a rate far above the linear projection from their ICT percentile. The percentile → probability mapping is inherently non-linear, and a scalar cannot capture that shape.

---

## Recommendation for v1.5 — Isotonic Regression Calibration Layer

**Option 3 (isotonic regression)** is the appropriate next step. Requires user approval before starting.

**Why isotonic regression:**

- Learns a monotone mapping from raw predicted probability to empirically observed probability, per position.
- Captures the non-linear shape: the gap between "likely starter" and "elite striker" is steeper than a linear multiplier can express.
- Trained on this exact backtest dataset (GW 5–33), which we now have in full.
- Preserves monotonicity (higher predicted → higher calibrated), which is necessary for correct ranking.

**Implementation sketch (for user review):**

1. Run the existing predictor to get raw `p_goal` and `p_assist` per player-fixture.
2. For each position, fit isotonic regression: `actual_goal_rate ~ p_goal_raw` using the backtest labels.
3. Store the fitted isotonic mapping as a piecewise constant lookup table in `src/lib/probability/calibration/`.
4. Apply in Step 5 after caps: `p_goal_calibrated = isotonic_map_goal[position](p_goal_raw)`.

---

## v1.3.2 History (pre-v1.4, single global constant)

| Attempt           | Constant | Goal MACE | Assist MACE | Verdict                                      |
| ----------------- | -------- | --------- | ----------- | -------------------------------------------- |
| v1.3.1 (baseline) | —        | 28.7pp    | 23.7pp      | FAIL — cap saturation (46% at MAX_GOAL_PROB) |
| v1.3.2 attempt 1  | 0.15     | 2.9pp ✓   | 1.3pp ✓     | FAIL — FWD MACE 15.4pp, Brier above baseline |
| v1.3.2 attempt 2  | 0.20     | 4.5pp ✓   | 10.4pp ✗    | FAIL — assist overshot, kept 0.15            |

---

_Generated by `scripts/run-backtest.ts`. Multi-season validation (2023/24 + 2024/25 via history_past API) is deferred pending API access confirmation._
