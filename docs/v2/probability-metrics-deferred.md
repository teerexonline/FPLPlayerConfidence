# Probability Metrics — Deferred to v2.x or v3

## Status

Probability calculator and backtest harness exist in code. UI surfaces hidden.

## Decision rationale

The rate-based model (with all its calibration work) has a structural ceiling
that ICT-derived signals cannot break. Real probability prediction requires
xG/xA data per match, which the FPL API does not expose. Free scraped sources
(Understat, FBref) have legal/maintenance concerns that aren't justified for
a personal-use tool. Paid sources (Opta) are not currently affordable.

Confidence metric (v1) remains the primary player evaluation signal and is
validated against real captain decisions.

## Reactivation triggers

Reopen probability metrics work when one of these is true:

1. A reliable, sustainable xG/xA data source becomes available (paid or free)
2. Project monetization justifies paying for Opta or equivalent
3. The free landscape changes such that Understat/FBref become formally permissioned

## What was learned

- Position-aware shrinkage and proportional cap-scaling are sound concepts
- The Threat/Creativity ratio captures player identity well as a goal/assist split
- Season-anchored rates blended with recent rates handle small-sample noise correctly
- Confidence multipliers may double-count form signal (untested)
- Position caps are necessary safety nets for any rate-based approach
- FWD goal multiplier at 2.5 runs ~5–10pp hot; reducing to 2.0 would bring Haaland into range
- Multiplicative compounding collapses the lower distribution: median MID shows ~1.8% P(Goal) vs expected ~5%
- teamEventStrength squares the FDR effect (3.5× swing FDR1→5 vs expected 2.3×)

## What's preserved in code

- Calculator at `src/lib/probability/`
- Backtest harness at `scripts/run-backtest.ts`
- All UI components hidden but not deleted:
  - `src/components/metric/MetricToggle.tsx`
  - `src/components/metric/useMetricMode.ts`
  - `src/components/confidence/CalibrationCaveat.tsx`
  - `src/app/players/[id]/_components/MatchPredictionPanel.tsx`
- All component tests kept green (test in isolation)
- Calibration documents at `docs/v2/calibration-results.md` and `docs/v2/fpl_probability_algorithm*.md`
