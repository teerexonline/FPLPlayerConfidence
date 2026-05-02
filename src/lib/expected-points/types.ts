/**
 * Type contract for the expected-points (xP) module.
 * See `docs/ALGORITHM.md` §12 for the full spec.
 */

export type FdrBucket = 'LOW' | 'MID' | 'HIGH';

/**
 * Per-player average FPL `total_points` per appearance, broken down by FDR bucket.
 * `null` for a bucket means the player has no current-season appearances in it —
 * the calculator falls back to `BUCKET_FALLBACK_AVG`.
 */
export interface PlayerBucketAverages {
  readonly low: number | null;
  readonly mid: number | null;
  readonly high: number | null;
}

/** A scheduled (or completed) fixture for a single team. */
export interface TeamFixture {
  readonly gameweek: number;
  readonly opponentTeamId: number;
  readonly isHome: boolean;
  /** 1–5 from the perspective of `teamId` (the player's team). */
  readonly fdr: number;
}

/** Input to {@link calculatePlayerXp}. */
export interface PlayerXpInput {
  readonly playerId: number;
  /** Team Confidence-style percentage in [0, 100]. */
  readonly confidencePct: number;
  readonly averages: PlayerBucketAverages;
  /** All fixtures for the player's team in the gameweek being projected. */
  readonly fixtures: readonly TeamFixture[];
}

export interface PlayerXpResult {
  readonly playerId: number;
  /** Two-decimal-place expected points. */
  readonly xp: number;
  readonly fixtureCount: number;
}

/** A single starter for {@link calculateTeamXp}. */
export interface StarterXpInput extends PlayerXpInput {
  readonly squadPosition: number; // 1..11 only
}

export interface TeamXpInput {
  /** All 15 picks; bench (squadPosition > 11) is ignored. */
  readonly picks: readonly StarterXpInput[];
}

export interface TeamXpResult {
  /** Sum of starters' xP, rounded to 2 dp. */
  readonly teamXp: number;
  readonly perPlayer: readonly PlayerXpResult[];
}
