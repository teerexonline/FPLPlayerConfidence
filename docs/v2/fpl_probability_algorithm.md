# FPL Goal & Assist Probability Algorithm — Implementation Spec (v1.3.2)

## Changelog

- **v1.3.2**: Introduced `MAX_INVOLVEMENT_RATIO = 0.15` constant applied to all three per-event probability components (`p_involved`, `p_goal_given_involved`, `p_assist_given_involved`) in Step 4. Raw percentile ranks (0..1) used directly as probabilities caused cap saturation for ~46% of predictions (backtest GW5–33); median players hit lambda≈3 at 90 min → p_goal≈0.95, capped at MAX_GOAL_PROB=0.65. With the ratio applied, the median outfield player produces p_goal≈6.5% (neutral fixture, 90 min) and the top striker in an easy fixture reaches ~34%, while caps remain as safety rails.
- **v1.3.1**: Corrected transcription error in Step 4 — `xg_player_team` replaced with `team_event_strength` (= `xg_player_team * openness_factor`) so that opponent FDR (computed in Step 3) actually feeds into the lambda calculation. Using raw `xg_player_team` made Step 3's openness calculation a dead computation. See patch document Gap A.
- **v1.3**: Added `effective_position` and `effective_role` overrides to handle tactical deployments that differ from a player's season-default (e.g., Havertz starting as a striker, a midfielder pushed into a #10 role for one match)
- **v1.2**: Added `expected_minutes` parameter to scale lambda before Poisson conversion (handles subs, rotation risks, injury doubts)
- **v1.1**: Added position-relative Threat for defenders (fixes structural zero for attacking fullbacks); added optional form-weighted FDR adjustment to address season-average FDR missing current team form
- **v1.0**: Initial spec

## Purpose

Build a function that, given a fixture between two teams and a player on one of those teams, outputs:

- `p_goal` — probability (0–1) the player scores at least one goal
- `p_assist` — probability (0–1) the player gets at least one assist

The algorithm must use **both teams' fixture context** (not just the player's own team in isolation), and it uses the player's FPL ICT stats (Influence, Threat, Creativity) plus FDR (Fixture Difficulty Rating, 1=easiest to 5=hardest).

---

## Core Model

The probability is a chained conditional:

```
P(goal)   = P(goal-scoring event in match)
          × P(player involved | event)
          × P(event becomes a goal | player involved)

P(assist) = P(goal-scoring event in match)
          × P(player involved | event)
          × P(event has an assist credited to this player | player involved)
```

Mapped onto the available data:

- **P(goal-scoring event in match)** — derived from BOTH teams' FDR (a "match openness" factor)
- **P(player involved | event)** — derived from normalized **Influence**
- **P(goal | involved)** — derived from normalized **Threat**
- **P(assist | involved)** — derived from normalized **Creativity**

---

## Inputs

### Per-player (from FPL bootstrap-static API or equivalent)

- `player_id`
- `team_id`
- `position` — one of `GK`, `DEF`, `MID`, `FWD`
- `minutes` — total minutes played this season
- `influence` — season total (string in FPL API, parse to float)
- `threat` — season total
- `creativity` — season total

### Per-fixture

- `home_team_id`
- `away_team_id`
- `player_team_fdr` — FDR for the player's team in this fixture (1–5)
- `opponent_team_fdr` — FDR for the opposing team in this fixture (1–5)
- `expected_minutes` — projected minutes for this player in this fixture (0–90); v1.2. If unknown, default to 90 for confirmed starters, ~25 for known sub-only players, and use FPL's `chance_of_playing_next_round` to discount injury doubts. A simple heuristic: average of last 5 GW minutes is a decent baseline.
- `effective_position` _(optional)_ — override the player's season-default position when a confirmed lineup shows a tactical change for this match (e.g., a midfielder deployed as a striker). One of `GK`, `DEF`, `MID`, `FWD`. Defaults to the player's season-default position if not provided. v1.3.
- `effective_role` _(optional, advanced)_ — a finer-grained tag like `target_man`, `inverted_winger`, `attacking_fullback`, `false_nine`. Reserved for future calibration; v1.3 only uses it to lightly boost Threat percentile when role is more attacking than season-default position would suggest. **Note: removed entirely per v1.3 patch Gap C — do not implement.**

### Constants (tunable)

- `BASELINE_TEAM_GOALS_PER_MATCH = 1.4` — Premier League long-run average
- `FDR_MULTIPLIERS = {1: 1.40, 2: 1.20, 3: 1.00, 4: 0.80, 5: 0.60}` — scales expected goals up/down based on opponent strength
- `MAX_GOAL_PROB = 0.65` — sanity cap
- `MAX_ASSIST_PROB = 0.55` — sanity cap
- `MIN_MINUTES_FOR_RANKING = 270` — players below this get a regression-to-mean adjustment
- `DEFENDER_THREAT_SCALE = 0.35` — when comparing a defender's goal probability against the cohort, scale their already-position-adjusted Threat to reflect that defenders score ~5–10% of league goals; prevents zeroing out attacking fullbacks (v1.1)
- `FORM_WEIGHT = 0.0` — optional 0..1 weight blending recent form-based xG against FDR baseline; default 0 keeps v1.0 behavior, set to ~0.4 to lean into form data when available (v1.1)

---

## Step 1 — Per-90 Conversion

Convert raw season ICT totals to per-90-minute rates so subs aren't unfairly penalized vs. starters:

```
influence_p90  = (influence  / minutes) * 90  if minutes > 0 else 0
threat_p90     = (threat     / minutes) * 90  if minutes > 0 else 0
creativity_p90 = (creativity / minutes) * 90  if minutes > 0 else 0
```

For players below `MIN_MINUTES_FOR_RANKING`, shrink their per-90 toward the position median:

```
shrinkage = minutes / MIN_MINUTES_FOR_RANKING            # 0..1
adjusted  = shrinkage * raw_p90 + (1 - shrinkage) * position_median_p90
```

This prevents a player with one hot 30-minute cameo from dominating the rankings.

---

## Step 2 — Position-Adjusted Percentile Normalization

For each of the three ICT components, compute the player's **percentile rank within their own position group** across the league. This is fairer than a global max because midfielders naturally have higher Creativity than forwards, defenders dominate Influence in some metrics, etc.

```
For each position in [GK, DEF, MID, FWD]:
    cohort = all players in this position with minutes > 0
    For each player in cohort:
        influence_pct  = percentile_rank(player.influence_p90,  cohort.influence_p90)
        threat_pct     = percentile_rank(player.threat_p90,     cohort.threat_p90)
        creativity_pct = percentile_rank(player.creativity_p90, cohort.creativity_p90)
```

Each `*_pct` value is now in `[0, 1]` and represents "how good is this player at this attribute relative to peers in the same position."

Use a standard percentile rank (fraction of cohort with a strictly lower value, with ties getting the average rank). NumPy's `scipy.stats.rankdata(method='average') / n` works, or implement manually.

### Defender Threat Adjustment (v1.1)

Position-relative percentile alone produces a perverse outcome: a top-percentile attacking fullback ends up with `threat_pct = 1.0` and gets the same per-event goal probability as a top-percentile striker. That's wrong — defenders score far fewer goals overall, regardless of how attacking they are within their cohort.

After computing position-relative percentiles, scale defender Threat by `DEFENDER_THREAT_SCALE`:

```
if player.position == "DEF":
    threat_pct = threat_pct * DEFENDER_THREAT_SCALE
```

This preserves the relative ranking among defenders (Robertson > a centre-half who never goes forward) while keeping their absolute goal probabilities below those of midfielders and forwards. The scaling factor (~0.35) reflects that defenders contribute roughly one-third the goal share of forwards on a per-event basis. Do **not** apply this to Creativity — defenders assist at rates comparable to midfielders, especially attacking fullbacks.

### Effective Position Override (v1.3)

A player's season-default position from the FPL API doesn't always match how they're deployed in a given match. Examples this matters for:

- A midfielder/AM deployed as a #9 for one match (e.g., Havertz starting up top vs City) — should not get DEFENDER_THREAT_SCALE-style penalty, and Threat ceiling should reflect striker deployment
- A forward dropped to bench (handled via `expected_minutes`, not effective_position)
- A fullback pushed forward to wing-back or even winger in an asymmetric setup

When `effective_position` is provided, use it for:

1. **DEFENDER_THREAT_SCALE application** — only apply if `effective_position == "DEF"`, regardless of season-default
2. **Cohort selection for percentiles** — keep using season-default for percentile calculation (a midfielder played as a striker is still a midfielder by Threat-per-90 history); but allow effective_position to inform whether the defender threat scale applies

Pseudocode:

```
season_pos = player.position
effective_pos = fixture.get("effective_position", season_pos)

# Percentiles use season_pos cohort - that's where the player's history lives
infl_pct, thr_pct, crea_pct = percentiles(player, cohorts[season_pos])

# But the defender threat scaling uses effective position
# (a MID deployed as FWD shouldn't be scaled down; a MID played as a deep CB should be)
if effective_pos == "DEF":
    thr_pct = thr_pct * DEFENDER_THREAT_SCALE

# Lightweight Threat boost when a player is deployed more attackingly than their default
if effective_pos == "FWD" and season_pos in ("MID", "DEF"):
    thr_pct = min(thr_pct * 1.25, 1.0)
```

The 1.25 boost is conservative — for a one-off positional change, the player's Threat-per-90 still mostly reflects their normal deployment, but giving them a striker's central position should bump expected goal involvement modestly. Calibration of this constant is a TODO once historical data is available.

---

## Step 3 — Match Openness Factor (combining BOTH teams)

This is the part that makes the algorithm care about the opponent, not just the player's team.

For the player's team's attacking output, what matters is the **opponent's defensive weakness**, which is reflected in `player_team_fdr` (low FDR = weak opponent = more goals expected).

For overall **match openness** (does this game look like a 4–3 or a 0–0?), we combine both teams' expected attacking output:

```
player_team_attack_mult   = FDR_MULTIPLIERS[player_team_fdr]
opponent_team_attack_mult = FDR_MULTIPLIERS[opponent_team_fdr]

# Expected goals for each side
xg_player_team   = BASELINE_TEAM_GOALS_PER_MATCH * player_team_attack_mult
xg_opponent_team = BASELINE_TEAM_GOALS_PER_MATCH * opponent_team_attack_mult

# Match openness = average expected total goals, normalized
match_total_xg     = xg_player_team + xg_opponent_team
baseline_total_xg  = 2 * BASELINE_TEAM_GOALS_PER_MATCH    # = 2.8
openness_factor    = match_total_xg / baseline_total_xg   # ~1.0 for average match
```

Why this works: two attacking teams with weak defenses → high `openness_factor` → both teams' players get a boost. Two strong defenses → low factor → both suppressed. A mismatch (one strong attack vs one strong defense) sits near 1.0.

The **player's team-specific event probability** uses the team's own xG, then is scaled by openness:

```
team_event_strength = xg_player_team * (openness_factor / 1.0)
```

### Form-Weighted FDR Adjustment (v1.1, optional)

FDR is a season-long opponent rating and lags real form by weeks. A team in a slump or hot streak isn't reflected. If recent xG-for and xG-against data is available (last 5–6 matches per team), blend a form-based xG into the team xG:

```
# Per-team form xG (rolling 6-match average xG-for and xG-against)
form_xg_player_team = recent_xg_for_player_team * 0.6 + recent_xg_against_opponent * 0.4
form_xg_opponent    = recent_xg_for_opponent    * 0.6 + recent_xg_against_player_team * 0.4

# Blend with FDR baseline
xg_player_team   = (1 - FORM_WEIGHT) * (BASELINE * fdr_mult_player) + FORM_WEIGHT * form_xg_player_team
xg_opponent_team = (1 - FORM_WEIGHT) * (BASELINE * fdr_mult_opp)    + FORM_WEIGHT * form_xg_opponent
```

With `FORM_WEIGHT = 0` (default), behavior is identical to v1.0. Recommended starting value when form data is available: `0.4`. This is optional because most consumers won't have rolling xG data; FPL's bootstrap-static doesn't expose it.

---

## Step 4 — Per-Player Goal & Assist Probabilities

> **NOTE:** This step is amended by `fpl_probability_algorithm_v1.3_patch.md` Gap A (Poisson interpretation fix, `BASELINE_ATTACKING_EVENTS_PER_MATCH = 12`) and further updated in v1.3.2 (cap saturation fix, `MAX_INVOLVEMENT_RATIO = 0.15`). **Use the patched + v1.3.2-updated version of Step 4, not the version below.** The version below is preserved for reference and changelog continuity.

Combine the chain. The team's expected goals already represents the "probability mass" of scoring events in the match for that team. We allocate that mass across players using their normalized ICT.

```
# v1.3.2: Scale all three probability components by MAX_INVOLVEMENT_RATIO (0.15)
# to convert raw percentile ranks (0..1) into realistic per-event involvement shares.
# Without this, median players generate lambdas >> 3 at 90 min → p_goal ≈ 1.0,
# saturating the caps and producing systematically overconfident predictions.
p_involved              = influence_pct * MAX_INVOLVEMENT_RATIO
p_goal_given_involved   = threat_pct    * MAX_INVOLVEMENT_RATIO   # DEFENDER_THREAT_SCALE applied first
p_assist_given_involved = creativity_pct * MAX_INVOLVEMENT_RATIO

# Per-attacking-event probabilities for THIS player
p_goal_per_event   = p_involved * p_goal_given_involved
p_assist_per_event = p_involved * p_assist_given_involved

# v1.2: Scale by expected minutes — a 25-minute sub gets ~28% of a starter's exposure
minutes_factor = expected_minutes / 90.0

# Convert "events" to "match probability" using Poisson
# Use team_event_strength (= xg_player_team * openness_factor from Step 3) so that
# opponent FDR contributes. Using raw xg_player_team here was the v1.3 transcription
# error fixed in v1.3.1.
lambda_goal   = team_event_strength * p_goal_per_event   * minutes_factor
lambda_assist = team_event_strength * p_assist_per_event * minutes_factor

# P(at least one) = 1 - P(zero) under Poisson
p_goal   = 1 - exp(-lambda_goal)
p_assist = 1 - exp(-lambda_assist)
```

The Poisson step is what converts a per-event rate into a "chance it happens at least once in the match" — which is what FPL managers actually care about.

The minutes factor is critical for honest probabilities: a player with elite per-90 ICT but who only plays 25 minutes off the bench shouldn't be ranked alongside a 90-minute starter with similar per-90 numbers. Their expected exposure is roughly a third.

---

## Step 5 — Caps and Sanity

Apply the configured ceilings:

```
p_goal   = min(p_goal,   MAX_GOAL_PROB)
p_assist = min(p_assist, MAX_ASSIST_PROB)
```

Goalkeepers get `p_goal = 0` and `p_assist` heavily suppressed (e.g., × 0.05) since the ICT model isn't designed for them.

Players with `minutes == 0` or who are flagged unavailable should return `(0.0, 0.0)`.

---

## Function Signature

```python
def predict_player_probabilities(
    player: dict,              # {id, team_id, position, minutes, influence, threat, creativity}
    fixture: dict,             # {home_team_id, away_team_id, player_team_fdr, opponent_team_fdr, expected_minutes}
    league_data: dict          # precomputed position cohorts with per-90 stats
) -> dict:
    """
    Returns:
        {
            "player_id": int,
            "p_goal": float,    # 0..1
            "p_assist": float,  # 0..1
        }
    """
```

A helper should precompute `league_data` once per gameweek rather than recomputing percentiles for every call:

```python
def build_league_data(all_players: list[dict]) -> dict:
    """
    Returns a dict keyed by position, each containing:
        - cohort player_ids
        - per-90 arrays for influence, threat, creativity
        - precomputed percentile lookup
        - position medians (for shrinkage)
    """
```

---

## Suggested File Structure

```
fpl_predictor/
├── __init__.py
├── constants.py          # tunable constants from this spec
├── normalize.py          # per-90 conversion, shrinkage, percentile ranks
├── fixture.py            # match openness factor calculation
├── predictor.py          # predict_player_probabilities + build_league_data
├── data_loader.py        # fetch from FPL API or load from cached JSON
└── tests/
    ├── test_normalize.py
    ├── test_fixture.py
    └── test_predictor.py
```

> For TypeScript implementation in the FPL Confidence project, mirror this structure in `src/lib/probability/` matching the existing `src/lib/confidence/` module shape.

---

## Test Cases to Implement

1. **Sanity**: Star striker (top-percentile Threat) vs FDR 1 opponent → high `p_goal` (>0.4)
2. **Sanity**: Same striker vs FDR 5 opponent → significantly lower `p_goal`
3. **Both-teams effect**: Two FDR 2 teams playing → both teams' players boosted vs the same teams playing FDR 4 opponents
4. **Position fairness**: A top-percentile creative midfielder should have `p_assist` higher than a top-percentile forward when Creativity is the only differing input
5. **Low-minutes regression**: Player with 60 minutes and freakish stats does not appear in top 10
6. **Goalkeeper**: Returns `p_goal = 0`
7. **Caps**: Synthetic perfect-score input cannot exceed `MAX_GOAL_PROB`

---

## Notes for Implementation

- All ICT values from the FPL API arrive as **strings** — parse to float defensively
- FDR is per-fixture per-team and is available in the FPL `fixtures` endpoint as `team_h_difficulty` / `team_a_difficulty`
- Cache `build_league_data()` output per gameweek; it doesn't need to recompute on every player query
- The constants in this spec are starting points — once historical data is available, fit `BASELINE_TEAM_GOALS_PER_MATCH`, `FDR_MULTIPLIERS`, and the caps against actual outcomes (log-loss or Brier score against per-gameweek goal/assist binary labels)
- Consider adding an optional `form_weight` later that blends last-5-gameweek ICT with season ICT — but this is **out of scope for v1**

---

## Cross-references

- **Patch document:** `fpl_probability_algorithm_v1.3_patch.md` (in the same directory). The patch amends Step 4's Poisson math (Gap A), removes the `effective_role` field (Gap C), adds team conversion factor for assists (Gap D), specifies the validation/calibration framework (Gap B), and notes set piece exposure as v2.x deferred work (Gap E). **Read the patch alongside this spec — both are required for correct v2 implementation.**
