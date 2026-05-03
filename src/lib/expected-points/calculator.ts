/**
 * Expected-points (xP) calculator. See `docs/ALGORITHM.md` §12 for the spec.
 *
 * xP is a forward-looking projection of FPL points for a (player, gameweek)
 * pair. Inputs:
 *  - the player's current Confidence %, supplied by the caller (not recomputed
 *    here — this module is decoupled from the Confidence calculator).
 *  - per-bucket historical averages for the player.
 *  - the team's fixtures in the gameweek being projected.
 *
 * Output is rounded to two decimal places. The module is pure.
 */

import type {
  FdrBucket,
  PlayerBucketAverages,
  PlayerXpInput,
  PlayerXpResult,
  TeamFixture,
  TeamXpInput,
  TeamXpResult,
} from './types';

// ── Constants ─────────────────────────────────────────────────────────────────

/**
 * Confidence-independent multiplier added inside the formula. At 0% confidence
 * a player still projects 10% of their typical bucket output — never zero
 * (unless their bucket average is zero, which is itself a meaningful signal).
 */
const CONFIDENCE_BASELINE = 0.1;

/** Squad positions ≤ this are starters; > this are bench. */
const STARTER_THRESHOLD = 11;

// ── Helpers ───────────────────────────────────────────────────────────────────

export function bucketForFdr(fdr: number): FdrBucket {
  if (fdr <= 2) return 'LOW';
  if (fdr === 3) return 'MID';
  return 'HIGH';
}

/**
 * Resolves the average FPL return for the requested bucket. If the player has
 * no current-season appearances in that bucket but does have data in others,
 * fall back to the mean across all known buckets — better than guessing.
 * If they have no data at all, return 0 (the projection becomes 0 → "no data").
 */
function averageForBucket(averages: PlayerBucketAverages, bucket: FdrBucket): number {
  const direct = bucket === 'LOW' ? averages.low : bucket === 'MID' ? averages.mid : averages.high;
  if (direct !== null) return direct;
  const known: number[] = [];
  if (averages.low !== null) known.push(averages.low);
  if (averages.mid !== null) known.push(averages.mid);
  if (averages.high !== null) known.push(averages.high);
  if (known.length === 0) return 0;
  return known.reduce((a, b) => a + b, 0) / known.length;
}

function roundTo2dp(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Per-fixture xP using the spec'd formula:
 *   (0.1 + Confidence) × Avg points vs FDR bucket
 * where Confidence is the player's confidence percentage expressed as a
 * fraction (0.00 – 1.00).
 */
function fixtureXp(confidencePct: number, averages: PlayerBucketAverages, f: TeamFixture): number {
  const bucketAvg = averageForBucket(averages, bucketForFdr(f.fdr));
  return (CONFIDENCE_BASELINE + confidencePct / 100) * bucketAvg;
}

// ── Public API ────────────────────────────────────────────────────────────────

export function calculatePlayerXp(input: PlayerXpInput): PlayerXpResult {
  const { playerId, confidencePct, averages, fixtures } = input;

  if (fixtures.length === 0) {
    return { playerId, xp: 0, fixtureCount: 0 };
  }

  const total = fixtures.reduce((sum, f) => sum + fixtureXp(confidencePct, averages, f), 0);

  return {
    playerId,
    xp: roundTo2dp(total),
    fixtureCount: fixtures.length,
  };
}

export function calculateTeamXp(input: TeamXpInput): TeamXpResult {
  const starters = input.picks.filter((p) => p.squadPosition <= STARTER_THRESHOLD);
  const perPlayer = starters.map((s) => calculatePlayerXp(s));
  const teamXp = roundTo2dp(perPlayer.reduce((sum, r) => sum + r.xp, 0));
  return { teamXp, perPlayer };
}
