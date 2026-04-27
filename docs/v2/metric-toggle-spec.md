# v2.0 — Metric Toggle Integration Spec

## Overview

Introduce a global metric toggle that lets users switch between three player-level metrics:

- **C** — Confidence (existing v1 metric)
- **G** — P(Goal) for next fixture
- **A** — P(Assist) for next fixture

The toggle controls what numerical value displays for each player across multiple surfaces. Same player rows, same layouts, same visual rhythm — only the underlying number changes. This pattern extends naturally to future surfaces (pitch view, transfer suggester) and future metrics (P(Clean Sheet), expected points, etc.).

## Why this design

Confidence and probability metrics are conceptually different:

- Confidence is _relative to baseline_ (50% = neutral, above good, below bad)
- Probabilities are _absolute_ (30% = 1-in-3 chance, no baseline concept)

Showing both simultaneously creates mental model collision (a 30% Confidence is bad; a 30% P(Goal) is excellent — same number, opposite emotional valence). The toggle eliminates the collision: only one metric is visible at a time, so each number is interpreted unambiguously.

The pattern also matches user decision flow. A user picking a captain wants the goal probability lens (G mode). A user evaluating long-term form wants the confidence lens (C mode). The toggle makes the lens explicit.

## Scope: which surfaces respect the toggle

| Surface                         | Toggle behavior                                                                                                                                                                                                                                                                                                          |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Dashboard (`/`)                 | Stays Confidence-only. The Risers/Fallers cards are inherently delta-over-time which has no equivalent for probabilities. The leaderboard could theoretically respect the toggle but it would change the leaderboard's identity ("top 10 by what?"). For v2.0, leave Dashboard unchanged. Re-evaluate in v2.1 if needed. |
| Players list (`/players`)       | **Respects the toggle.** Player rows show the active metric. Sort defaults to the active metric, descending. Filter chips and search behavior unchanged.                                                                                                                                                                 |
| Player Detail (`/players/[id]`) | **Ignores the toggle — shows all three metrics together.** This is the deepest evaluation surface where users want comparison. The hero stays Confidence (preserves v1 hierarchy). A new "Match prediction" panel below the existing Performance Breakdown shows P(Goal) and P(Assist) for the next fixture.             |
| My Team (`/my-team`)            | **Respects the toggle.** Player rows in Starting XI and Bench show the active metric. The hero (Team Confidence percentage) and positional breakdown stay Confidence — those are aggregate metrics that don't have probability equivalents.                                                                              |
| Settings                        | N/A (no metrics displayed).                                                                                                                                                                                                                                                                                              |

## Toggle UI

**Visual pattern:** three small pill buttons in the top bar of each respecting page, labeled `C` `G` `A`. Selected pill has accent fill, unselected pills have muted treatment.

**Placement:** in the top bar, near where the gameweek pill currently sits. The toggle and gameweek pill are conceptually similar (both are "page state controls"), so grouping them visually makes sense.

**Mobile:** same three pills, tucked into the page header. Smaller touch targets are acceptable here since the toggle is occasional-use; default selection persists across sessions so users don't toggle constantly.

**Default state:** C (Confidence). Preserves v1 mental model on first load. Users who switch away will have their choice persisted.

**Persistence:** URL query parameter (`?metric=g`). Survives refresh, shareable, browser-back works as expected. No server-side state needed.

## Color treatment by mode

**C mode:** existing v1 color treatment unchanged. Green ≥50%, red <50%, neutral =50%. Threshold-based because Confidence is relative.

**G mode and A mode:** single accent color for all values. No green/red threshold logic. Probabilities are absolute and don't have a meaningful "good vs bad" cutoff that maps cleanly to all positions.

The visual contrast itself signals the mode: C mode renders as colored numbers; G/A modes render as accent-colored numbers. Users learn "the colored screen is Confidence; the monochrome screen is probability."

**Confidence number sign treatment in G/A modes:** drop the `+/-` sign treatment. Probabilities don't have signs; rendering "+30%" looks wrong. In G/A modes, just render the percentage value.

## Sort behavior

**Players list:** when the toggle changes, the sort criterion changes to match. C → sorted by Confidence desc. G → sorted by P(Goal) desc. A → sorted by P(Assist) desc.

If the user has manually changed the sort criterion (e.g., sorted by Price ascending), respect that and don't override. Only auto-sort when the user is on the default sort and toggles.

**My Team:** Starting XI rows are ordered by squad position (1-11), not by metric value. Toggle changes the displayed value but not the ordering. Same for bench (12-15).

**Player Detail:** N/A — no list to sort.

## Caveat communication for FWD calibration

The probability metric has a known calibration imperfection: FWD goal predictions have ~7.4pp position-stratified MACE vs the 5pp acceptance threshold. This needs to be honestly surfaced.

**Implementation:** small "?" icon next to probability values when in G mode for FWD players. Hover/tap opens a tooltip:

> Goal probability for forwards may run slightly higher than actual outcomes. Calibrated MACE: 7.4 percentage points. Use as directional signal rather than precise probability.

For all other position/metric combinations, no caveat icon needed — they pass acceptance criteria.

## Player Detail page — new "Match prediction" panel

Add a new panel below the existing Performance Breakdown panel. Title: "Next match prediction." Content:

- The next fixture (opponent name, home/away, FDR, kickoff date)
- P(Goal) percentage in `ConfidenceNumber md` style, accent color
- P(Assist) percentage in same style, side by side
- Small caveat icon next to P(Goal) for FWD players (per Caveat Communication above)
- Subtitle: "Probabilities are derived from FPL's ICT framework against the next fixture's difficulty. Not a guarantee — use as directional signal."

This panel exists regardless of the global toggle's state — Player Detail is the "see everything" surface.

If no upcoming fixture is available (end of season, mid-pause), show: "Next fixture not yet scheduled."

## Architecture

**State management:**

- URL query param `metric=c|g|a` is the source of truth
- Default value: `c` (when param is absent)
- Read on every page that respects the toggle
- Toggle pills update the URL via Next.js router

**Data fetching:**

- Players list page already fetches all player data. Add P(Goal) and P(Assist) to the `PlayerWithConfidence` type (rename to `PlayerWithMetrics` or similar)
- My Team page already fetches squad pick data. Same type extension applies
- Player Detail page already fetches per-player data. Same extension
- Probabilities are computed via the existing `src/lib/probability/` calculator at request time, using the player's most recent ICT stats and the next fixture's FDR

**Component changes:**

- New `MetricToggle` component (3 pills, URL-aware)
- Existing `ConfidenceNumber` component gains a `mode` prop (`'c' | 'g' | 'a'`) that controls color treatment and sign rendering. When mode is 'g' or 'a', renders without sign and in accent color
- Existing `PlayerRow` and `PlayerCard` components read the active metric from URL and render the appropriate value
- New `MatchPredictionPanel` component for Player Detail
- New `CalibrationCaveat` component (the small "?" with tooltip)

## Implementation phases

**Phase 1: Toggle infrastructure (~3-4h)**

- `MetricToggle` component
- URL state management hook
- Default value handling
- Tests for toggle behavior

**Phase 2: ConfidenceNumber mode prop (~2-3h)**

- Add `mode` prop to existing ConfidenceNumber
- Color treatment branches based on mode
- Sign rendering branches based on mode
- Update existing call sites to pass `mode='c'` (preserves v1 behavior)
- Update tests

**Phase 3: Players list integration (~3-4h)**

- Wire toggle to players page
- Update PlayerRow and PlayerCard to read active metric
- Auto-sort on toggle change (when on default sort)
- Tests for filter/sort/toggle interaction

**Phase 4: My Team integration (~2-3h)**

- Wire toggle to my-team page
- Update Starting XI and Bench row rendering
- Tests for toggle behavior on this surface

**Phase 5: Player Detail panel (~3-4h)**

- New `MatchPredictionPanel` component
- Wire to next-fixture data
- Caveat icon for FWD goal predictions
- Tests

**Phase 6: Caveat tooltip component (~2h)**

- Reusable `CalibrationCaveat` component
- Used in MatchPredictionPanel and Players list/My Team rows when applicable
- Tooltip styling per existing tooltip patterns

**Total estimate: 15-20 hours.**

## What's NOT in this v2.0 release

- Pitch view (item #2 in v2 backlog) — uses same toggle pattern when built, but is its own substantial work
- Dashboard probability surfaces — re-evaluate in v2.1 if needed
- Transfer suggester (item #3) — depends on probability metrics being shipped first; future work
- Multi-fixture aggregation — current probabilities are single-next-fixture only

## Tests

Standard TDD discipline per v1:

- `MetricToggle.test.tsx` — pills render, URL updates on click, default value handling
- `ConfidenceNumber.test.tsx` — mode prop changes color and sign treatment
- `PlayerRow.test.tsx` — reads active metric from URL, renders correct value
- `PlayerCard.test.tsx` — same on mobile
- `MatchPredictionPanel.test.tsx` — renders P(G) and P(A), shows caveat for FWD
- `CalibrationCaveat.test.tsx` — tooltip opens on hover/click
- E2E: navigate Players list, toggle C → G → A, verify values change and sort updates

axe clean throughout. Coverage maintained at ≥70% on `src/components/` and ≥90% on `src/lib/`.

## Use of frontend-design skill

Per CLAUDE.md, the frontend-design skill is required for all UI work. This spec defines the _what_ and _where_; the skill handles the _how it looks_. Specifically the skill should inform:

- Exact pill button styling (size, padding, hover state, selected state)
- Toggle switching animation (probably none — instant snap is more responsive)
- Color treatment specifics for G/A modes (which exact accent shade, weight)
- Match Prediction panel layout (proportions, divider lines, hierarchy)
- Caveat tooltip styling (positioning, dismissal, mobile tap behavior)

## Out-of-scope refinements (filed for v2.x or later)

- Multi-fixture probability rollup ("P(Goal) over next 3 GWs")
- Confidence delta display in G/A modes (e.g., "+5% goal probability vs last week")
- Composite scoring (combining Confidence and probability into single ranking)
- Custom thresholds per user (let users define their own "good probability" cutoff)
