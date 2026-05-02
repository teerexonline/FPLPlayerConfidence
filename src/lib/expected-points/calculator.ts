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

/** Per-fixture flat baseline. Even at 0% confidence, every appearance starts here. */
const PER_FIXTURE_BASELINE = 0.1;

/** Used when a player has no current-season appearances in a given bucket. */
export const BUCKET_FALLBACK_AVG = 2.3;

/** Squad positions ≤ this are starters; > this are bench. */
const STARTER_THRESHOLD = 11;

// ── Helpers ───────────────────────────────────────────────────────────────────

export function bucketForFdr(fdr: number): FdrBucket {
  if (fdr <= 2) return 'LOW';
  if (fdr === 3) return 'MID';
  return 'HIGH';
}

function averageForBucket(averages: PlayerBucketAverages, bucket: FdrBucket): number {
  const value = bucket === 'LOW' ? averages.low : bucket === 'MID' ? averages.mid : averages.high;
  return value ?? BUCKET_FALLBACK_AVG;
}

function roundTo2dp(n: number): number {
  return Math.round(n * 100) / 100;
}

function fixtureXp(confidencePct: number, averages: PlayerBucketAverages, f: TeamFixture): number {
  const bucketAvg = averageForBucket(averages, bucketForFdr(f.fdr));
  return PER_FIXTURE_BASELINE + (confidencePct / 100) * bucketAvg;
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
