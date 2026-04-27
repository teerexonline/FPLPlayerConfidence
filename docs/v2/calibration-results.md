# Probability Model Calibration Results

**Generated:** 2026-04-27T04:42:49.948Z
**Model version:** v1.3.1
**Season:** 2025/26 (single-season; multi-season validation deferred)
**GW range:** GW 5–33 (GW 1–4 excluded as warmup)
**Total predictions:** 8699

---

## Verdict: ❌ FAIL

One or more acceptance criteria failed — see details below.

**Goal model failures:**

- Overall MACE 28.7pp exceeds 5.0pp threshold
- Bucket 10–20%: error 10.9pp > 10.0pp
- Bucket 20–30%: error 20.2pp > 10.0pp
- Bucket 30–40%: error 29.5pp > 10.0pp
- Bucket 40–50%: error 37.7pp > 10.0pp
- Bucket 50–60%: error 47.5pp > 10.0pp
- Bucket 60–70%: error 52.6pp > 10.0pp
- DEF MACE 32.1pp exceeds threshold
- MID MACE 28.5pp exceeds threshold
- FWD MACE 19.7pp exceeds threshold
- Brier score 0.2269 ≥ baseline 0.0711

**Assist model failures:**

- Overall MACE 23.7pp exceeds 5.0pp threshold
- Brier score 0.2021 ≥ baseline 0.0722

---

## Overall Metrics

| Metric         | Goal model | Assist model |
| -------------- | ---------- | ------------ |
| MACE (overall) | 28.7pp     | 23.7pp       |
| Brier score    | 0.2269     | 0.2021       |
| Baseline Brier | 0.0711     | 0.0722       |
| Beats baseline | No ❌      | No ❌        |

---

## Calibration Buckets

### P(Goal) calibration

| Bucket  | N    | Events | Observed | Expected | Error        |
| ------- | ---- | ------ | -------- | -------- | ------------ |
| 0–10%   | 2027 | 55     | 2.7%     | 5.0%     | 2.3pp        |
| 10–20%  | 716  | 29     | 4.1%     | 15.0%    | 10.9pp       |
| 20–30%  | 567  | 27     | 4.8%     | 25.0%    | 20.2pp       |
| 30–40%  | 487  | 27     | 5.5%     | 35.0%    | 29.5pp       |
| 40–50%  | 438  | 32     | 7.3%     | 45.0%    | 37.7pp       |
| 50–60%  | 454  | 34     | 7.5%     | 55.0%    | 47.5pp       |
| 60–70%  | 4010 | 497    | 12.4%    | 65.0%    | 52.6pp       |
| 70–80%  | 0    | 0      | 0.0%     | 75.0%    | — _(sparse)_ |
| 80–90%  | 0    | 0      | 0.0%     | 85.0%    | — _(sparse)_ |
| 90–100% | 0    | 0      | 0.0%     | 95.0%    | — _(sparse)_ |

### P(Assist) calibration

| Bucket  | N    | Events | Observed | Expected | Error        |
| ------- | ---- | ------ | -------- | -------- | ------------ |
| 0–10%   | 1680 | 50     | 3.0%     | 5.0%     | 2.0pp        |
| 10–20%  | 551  | 30     | 5.4%     | 15.0%    | 9.6pp        |
| 20–30%  | 514  | 23     | 4.5%     | 25.0%    | 20.5pp       |
| 30–40%  | 447  | 29     | 6.5%     | 35.0%    | 28.5pp       |
| 40–50%  | 445  | 35     | 7.9%     | 45.0%    | 37.1pp       |
| 50–60%  | 5062 | 523    | 10.3%    | 55.0%    | 44.7pp       |
| 60–70%  | 0    | 0      | 0.0%     | 65.0%    | — _(sparse)_ |
| 70–80%  | 0    | 0      | 0.0%     | 75.0%    | — _(sparse)_ |
| 80–90%  | 0    | 0      | 0.0%     | 85.0%    | — _(sparse)_ |
| 90–100% | 0    | 0      | 0.0%     | 95.0%    | — _(sparse)_ |

---

## Position-Stratified Results

| Position | N    | Goal MACE | Goal Brier | Assist MACE | Assist Brier |
| -------- | ---- | --------- | ---------- | ----------- | ------------ |
| GK       | 576  | 5.0pp     | 0.0000     | 4.7pp       | 0.0049       |
| DEF      | 2986 | 32.1pp    | 0.2186     | 25.5pp      | 0.2262       |
| MID      | 4059 | 28.5pp    | 0.2609     | 22.0pp      | 0.2119       |
| FWD      | 1078 | 19.7pp    | 0.2434     | 24.5pp      | 0.2034       |

---

## Recommendation

The v1.3.1 model **does not** meet all Gap B acceptance criteria. Do not proceed to UI integration until the failures above are resolved.

### Root cause: cap saturation from `BASELINE_ATTACKING_EVENTS_PER_MATCH = 12`

**4,010 of 8,699 predictions (46%) are capped at MAX_GOAL_PROB = 0.65**, where the actual observed rate is only 12.4%. The model is predicting 65% goal probability for players who score roughly 1-in-8 appearances.

The cause is that raw percentile values (range 0–1) are used directly as per-event probabilities. For a median outfield player (50th percentile on all ICT):

```
p_goal_per_event = 0.5 × 0.5 = 0.25
team_events      = 12 × (1.4 / 1.4) = 12   # neutral match, BASELINE_EVENTS = 12
lambda_goal      = 12 × 0.25 × 1.0  = 3.0
p_goal           = 1 − exp(−3.0)    = 0.950 → capped at 0.65
```

Any player above roughly the 25th percentile on both influence and threat saturates the cap at 90 minutes. This was known in tests (which used `expectedMinutes: 20` to avoid it), but the backtest confirms the production impact.

### Fix

Reduce `BASELINE_ATTACKING_EVENTS_PER_MATCH` from 12 to approximately **1**. Back-of-envelope: for a median FWD scoring in ~20% of appearances at 90 min, the required lambda is −log(1 − 0.20) ≈ 0.22. With `p_goal_per_event = 0.25`, that implies `team_events ≈ 0.22 / 0.25 ≈ 0.89`. Setting `BASELINE_ATTACKING_EVENTS_PER_MATCH = 1` keeps 90th-percentile players near 0.5 goal probability (lambda ≈ 0.81, p ≈ 0.55) without hitting the cap, while 10th-percentile players get ~1% (lambda ≈ 0.01).

After reducing the constant, re-run this script. The cap thresholds (MAX_GOAL_PROB = 0.65, MAX_ASSIST_PROB = 0.55) can remain in place as safety rails but should stop dominating the output.

**Next steps:**

1. In `src/lib/probability/constants.ts`, change `BASELINE_ATTACKING_EVENTS_PER_MATCH` from `12` to `1`.
2. Run `npx tsx scripts/run-backtest.ts` and verify MACE drops below 5pp.
3. If MACE is still high, iterate — the exact value needs empirical calibration against this backtest data.

---

_Generated by `scripts/run-backtest.ts`. Multi-season validation (2023/24 + 2024/25 via history_past API) is deferred pending API access confirmation._
