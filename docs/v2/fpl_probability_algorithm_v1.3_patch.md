# FPL Goal & Assist Probability Algorithm — v1.3 Patch

## Purpose

This patch addresses five gaps identified in the v1.3 spec during pre-v2 review. It does **not** rewrite the v1.3 algorithm — it amends specific sections. Apply alongside v1.3, not as a replacement.

The five gaps:

- **Gap A** — Poisson interpretation issue in Step 4 (`xg_player_team` conflated with attacking-event count)
- **Gap B** — Validation/calibration framework undefined
- **Gap C** — `effective_role` field (v1.3) is reserved but unused
- **Gap D** — Assist probability ignores team finishing efficiency
- **Gap E** — No exposure modeling for set pieces (filed for v2.x, no immediate change)

---

## Gap A — Poisson interpretation in Step 4

### The issue

The current Step 4 formula:

```
lambda_goal = xg_player_team * p_goal_per_event * minutes_factor
```

uses `xg_player_team` (≈1.4 for an average team) as if it were the count of attacking events in the match. It isn't — it's the team's expected number of _goals_. A team typically has 10–15 attacking events (shots, key passes, dangerous touches in the box) per match, and the chance of any one event becoming a goal is much lower than `p_goal_per_event` implies.

This produces probabilities that are systematically too low. Calibration would be off by a constant factor across the board, making the metric internally consistent but absolutely wrong (e.g., a top striker showing 8% goal probability when the real rate is 30%).

### Two implementation options

**Option A.1 — Introduce an attacking-event count constant.**

Add to `constants.py`:

```python
BASELINE_ATTACKING_EVENTS_PER_MATCH = 12   # league average per team
```

Then split the calculation into two steps in Step 4:

```python
# Number of attacking events the player's team is expected to generate
team_events = BASELINE_ATTACKING_EVENTS_PER_MATCH * (xg_player_team / BASELINE_TEAM_GOALS_PER_MATCH)

# Per-event goal/assist conversion probabilities for this player
lambda_goal   = team_events * p_goal_per_event   * minutes_factor
lambda_assist = team_events * p_assist_per_event * minutes_factor

# Poisson conversion as before
p_goal   = 1 - exp(-lambda_goal)
p_assist = 1 - exp(-lambda_assist)
```

Now `team_events` correctly represents "expected attacking events scaled by team strength," and `p_goal_per_event` represents "given an attacking event, this player's per-event scoring contribution." The product is a meaningful expected-goals-by-this-player.

**Pros:** Conceptually clean. `team_events` and `p_goal_per_event` have meaningful units.

**Cons:** Adds a constant that's hard to estimate without backtest data. Initial value (12) is a rough estimate.

**Option A.2 — Reinterpret `p_goal_per_event` as already-scaled.**

Keep the Step 4 formula as is, but rename `p_goal_per_event` to `p_goal_per_xg` and document that the value represents "per unit of team xG, this player's share." Calibrate the percentile-to-share mapping during validation rather than treating percentiles as raw probabilities.

**Pros:** Minimal code change. The existing percentile values can be retained, just reinterpreted.

**Cons:** The rename is subtle but real. The current code reads as if percentiles ARE probabilities, which they aren't. Future engineers will be confused.

### Recommendation

**Option A.1.** The conceptual cleanliness pays off in v2 implementation. Worth the cost of an extra constant. The constant becomes one of the calibration targets in Gap B's validation framework.

The naming should make the unit explicit:

- `p_involved_per_event` instead of `p_involved` (it's per-event, not per-match)
- `p_goal_given_event_and_involvement` instead of `p_goal_given_involved` (more precise)

These are documentation improvements; behavior is unchanged.

---

## Gap B — Validation & calibration framework

### The need

The v1.3 spec's "Notes for Implementation" mentions log-loss / Brier score but doesn't specify how to set up the backtest, what acceptance criteria to use, or how to detect miscalibration. Without this, "is the model good?" is unanswerable.

### Specification

**Backtest data source:**

- **Seasons:** 2023/24 and 2024/25 (most recent two completed seasons available via FPL `history_past`)
- **Granularity:** every (player, gameweek) pair where the player appeared (minutes > 0)
- **Excluded:** GW1-3 of each season (insufficient prior-season data for warm-up)

**Per-prediction record:**

For each backtested (player, gameweek):

```python
{
  "player_id": int,
  "gameweek": int,
  "season": str,
  "predicted_p_goal": float,     # 0..1
  "predicted_p_assist": float,   # 0..1
  "actual_goal": bool,           # did they score 1+?
  "actual_assist": bool,         # did they get 1+ assist?
  "minutes_played": int,
  "position": str,
}
```

Predictions use only data available _before_ that gameweek's deadline. No future leakage.

**Calibration analysis:**

Bin all predictions into 10% probability buckets:

| Predicted bucket | # predictions | # actual events | Observed rate | Calibration error   |
| ---------------- | ------------- | --------------- | ------------- | ------------------- |
| 0–10%            | N₀            | E₀              | E₀/N₀         | observed - midpoint |
| 10–20%           | N₁            | E₁              | E₁/N₁         | …                   |
| …                | …             | …               | …             | …                   |
| 90–100%          | N₉            | E₉              | E₉/N₉         | …                   |

A perfectly calibrated model has observed rate ≈ bucket midpoint.

**Acceptance criteria for v2 ship:**

- **Mean absolute calibration error (MACE)** across buckets: **< 5 percentage points**
- **No single bucket** more than **10pp** off (excluding buckets with N < 50, which are too sparse to evaluate)
- **Brier score** below the baseline of "predict every player at season-average for their position" (proves the model adds value over the trivial baseline)
- **Position-stratified MACE**: the above thresholds must also hold within each position group separately. If GK is fine but FWD is 15pp off, ship is blocked even if overall MACE passes.

**Implementation:**

```python
def backtest_calibration(
    predictions: list[dict],   # the per-prediction records above
) -> dict:
    """
    Returns:
      {
        "n_predictions": int,
        "mace_overall_goal": float,
        "mace_overall_assist": float,
        "mace_by_position_goal": dict[Position, float],
        "mace_by_position_assist": dict[Position, float],
        "brier_score_goal": float,
        "brier_score_assist": float,
        "baseline_brier_goal": float,
        "baseline_brier_assist": float,
        "calibration_buckets": list[CalibrationBucket],
        "passes": bool,
        "failures": list[str],   # human-readable reasons
      }
    """
```

**Calibration plot output:**

Generate an SVG plot per metric (P(Goal) and P(Assist)):

- X-axis: predicted probability (bucket midpoint)
- Y-axis: observed rate
- Diagonal reference line (perfect calibration)
- Bucket points sized by N
- Confidence intervals via Wilson score
- Color-coded by position

This plot is the single most useful diagnostic for the metric. It belongs in the v2 sign-off package the same way Lighthouse scores were in v1.

### When to run the backtest

- Before any v2 UI work begins (validates the metric is producible)
- Whenever a constant changes (new BASELINE_TEAM_GOALS_PER_MATCH, new FDR_MULTIPLIERS, etc.)
- As a pre-commit check on the calculator module (lighter version: smoke test against ~100 fixed predictions, full backtest in CI)

### Hard rule

**No P(Goal) or P(Assist) value displays in the UI until calibration acceptance criteria pass.** The metric existing in code but failing calibration is worse than not having the metric at all — users would trust a wrong number.

---

## Gap C — `effective_role` field decision

### Current state

v1.3 defines `effective_role` as an optional field with values like `target_man`, `inverted_winger`, `attacking_fullback`, `false_nine`. The only actual usage is the conditional Threat boost when `effective_pos == "FWD" and season_pos in ("MID", "DEF")`, which doesn't reference `effective_role` at all — it uses `effective_pos`.

So `effective_role` is effectively a phantom field: documented, parameterized, but unused.

### Decision

**Remove `effective_role` from v1.3 / v2.0 spec entirely.** Document it in a `## Future Work` section of the spec as a v2.x consideration, separated from the current implementation surface.

Reasoning:

- Phantom fields confuse implementers ("what should I pass here? does it matter?")
- The values listed (`target_man`, etc.) imply a richer role taxonomy that isn't actually defined or calibrated
- Removing it doesn't lose any current functionality — `effective_position` handles the cases that matter
- If role-based Threat tuning becomes important post-v2, it can be added with proper definition + calibration

**Action:** delete the `effective_role` parameter from `Inputs` section and the comment block in `Effective Position Override`. Add to a new `Future Work` section:

> **Role-based Threat refinement (deferred from v1.3):** A finer-grained `effective_role` parameter could improve predictions for tactical anomalies — `target_man` deployments, `inverted_winger` setups, `attacking_fullback` overlaps, `false_nine` patterns. This requires a defined role taxonomy with calibrated multipliers per role-position combination, which in turn requires lineup-level historical data not currently available via the FPL API. Filed for v2.x evaluation.

---

## Gap D — Team conversion rate for assists

### The issue

Current v1.3 treats assist probability as a function of player Creativity alone. Real assist probability depends on **teammate finishing efficiency**: a great chance creator at a poor finishing team gets fewer assists than they "deserve" relative to their xA generation.

Example: De Bruyne's creativity at Man City (clinical finishers) produces more realized assists than the same creativity at Brentford (less clinical). Current model would predict equal P(Assist) for equivalent Creativity percentile.

### Specification

Add a `team_conversion_factor` to the assist calculation:

```python
# Team conversion = how clinical is this team at finishing chances
# Computed from rolling 5-match window (or season if < 5 matches available)
team_conversion = team_goals_scored / team_shots_on_target

# Normalize against league average
LEAGUE_AVG_CONVERSION = 0.33   # ~33% goals per shot on target, league-typical

team_conversion_factor = team_conversion / LEAGUE_AVG_CONVERSION

# Apply only to assist lambda, NOT goal lambda
lambda_assist = team_events * p_assist_per_event * minutes_factor * team_conversion_factor
```

The factor:

- Equals 1.0 for league-average teams (no effect)
- ~1.20 for clinical teams (Man City, Liverpool in good form)
- ~0.80 for profligate teams (Wolves, Sheffield United-style)

### Why goals are NOT scaled

The team's own scoring depends on the player's own finishing (already captured in Threat), not on teammate finishing. Goal probability is independent of team conversion factor.

### Implementation considerations

- `team_conversion` requires rolling shot-on-target data per team. FPL's bootstrap-static doesn't directly expose this, but the `fixtures` endpoint includes match-level stats after games complete.
- For v2.0 ship, can use season-cumulative rather than rolling-5 — simpler and less data-intensive.
- Caps: `team_conversion_factor` should be bounded to `[0.5, 1.5]` to prevent extreme values from dominating. A team with 1 shot on target and 1 goal would otherwise produce a 3.0x factor.

### Calibration interaction

This factor is one of the things validated by Gap B's framework. If the factor consistently makes predictions worse rather than better (per backtest), drop it. The current spec is best-guess; data wins.

---

## Gap E — Set piece exposure (filed for v2.x, no immediate change)

### The issue

ICT components (Influence, Threat, Creativity) capture aggregate involvement but don't differentiate between open-play and set-piece contributions. A player who takes 90% of his team's penalties has dramatically higher P(Goal) than ICT alone suggests. Same for designated free-kick takers and corner takers (for assists).

Examples:

- Pascal Groß (Brighton) — corner taker, his Creativity reflects this but the assist mechanism is more deterministic than ICT implies
- Bruno Fernandes (Man Utd) — penalty taker, his Threat is partly inflated by penalty conversions
- James Maddison — free-kick taker, Threat boost vs typical midfielders

### What v1.3 does today

Nothing explicit. The set piece exposure is implicit in the player's ICT history, but the model can't predict that "Bruno is on penalties" produces different probabilities than "Bruno is in attacking form" — they look the same to the algorithm.

### Filed for v2.x

Adding set piece modeling requires:

1. Set-piece taker designation per player per team — not exposed via FPL API, requires manual maintenance or third-party data source
2. Set-piece-specific scoring rates (penalty conversion ~78%, free-kick conversion ~5%, header from corner ~3%)
3. Probability adjustment that incorporates these rates additively for designated takers

This is meaningful work and deserves its own focused refinement post-v2.0 ship. Don't attempt in initial v2 implementation. Note the gap exists; ship without it.

---

## Summary of changes from v1.3

| Section                            | Change                                                                                   | Reason                                       |
| ---------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------- |
| Step 4 — Per-Player Probabilities  | Introduce `BASELINE_ATTACKING_EVENTS_PER_MATCH` constant; restructure lambda computation | Gap A — fix Poisson interpretation           |
| New section — Validation Framework | Add full backtest specification + acceptance criteria                                    | Gap B — make "is model good?" answerable     |
| Inputs section                     | Remove `effective_role` parameter                                                        | Gap C — phantom field                        |
| New "Future Work" section          | Document `effective_role` as v2.x consideration                                          | Gap C — preserve idea for later              |
| Step 4 — Assist calculation        | Add `team_conversion_factor` to lambda_assist only                                       | Gap D — assists depend on teammate finishing |
| Constants                          | Add `LEAGUE_AVG_CONVERSION = 0.33`, bounds [0.5, 1.5]                                    | Gap D — calibration starting point           |
| New "Future Work" section          | Document set-piece exposure as v2.x consideration                                        | Gap E — meaningful but out of scope          |

---

## Recommended v2 implementation order

When v2 builds the probability metrics, follow this sequence:

1. **First:** implement v1.3 with patches A and C applied (fix Poisson, drop phantom field). Generate predictions but DON'T display them yet.
2. **Second:** implement patch B (backtest harness). Run against 2 seasons of historical data. Generate calibration plots. Confirm acceptance criteria pass.
3. **Third (only if step 2 passes):** add patch D (team conversion factor). Re-run backtest. Confirm calibration improves or stays neutral.
4. **Fourth (UI):** integrate predictions into the player surfaces only after backtest passes.
5. **Filed for v2.x:** patch E (set pieces).

If at any point the backtest fails acceptance criteria, the metric stays in code but doesn't display. Diagnose, recalibrate constants, retry. Don't ship a metric users will rightly distrust.

---

_End of patch document. Apply alongside `fpl_probability_algorithm.md` v1.3._
