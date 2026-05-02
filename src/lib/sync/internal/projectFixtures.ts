import { bucketForFdr } from '@/lib/expected-points';
import type { FdrBucket } from '@/lib/expected-points';
import type { DbFixture, FdrBucketName } from '@/lib/db/types';
import type { Fixtures, HistoryItem } from '@/lib/fpl/types';
import { FALLBACK_FDR, type FdrLookup } from './matchEventMapper';

/**
 * Projects FPL's per-fixture rows (each carrying both teams) into per-team
 * rows for the `fixtures` table. Each scheduled fixture yields exactly two
 * rows — one keyed by team_h and one by team_a — so each row stores the FDR
 * that team's players actually face.
 *
 * Unscheduled fixtures (event === null) are skipped.
 */
export function projectFixturesToTeamRows(fixtures: Fixtures): readonly DbFixture[] {
  const rows: DbFixture[] = [];
  for (const f of fixtures) {
    if (f.event === null) continue;

    rows.push({
      fixture_id: f.id,
      gameweek: f.event,
      team_id: f.team_h,
      opponent_team_id: f.team_a,
      is_home: true,
      fdr: f.team_h_difficulty,
      finished: f.finished,
      kickoff_time: f.kickoff_time,
    });
    rows.push({
      fixture_id: f.id,
      gameweek: f.event,
      team_id: f.team_a,
      opponent_team_id: f.team_h,
      is_home: false,
      fdr: f.team_a_difficulty,
      finished: f.finished,
      kickoff_time: f.kickoff_time,
    });
  }
  return rows;
}

// ── Per-player FDR bucket aggregator ─────────────────────────────────────────

/** Subset of HistoryItem we depend on — keeps the test fixture builder small. */
type HistorySubset = Pick<
  HistoryItem,
  'round' | 'opponent_team' | 'was_home' | 'minutes' | 'total_points'
>;

interface BucketAccumulator {
  total: number;
  count: number;
}

const BUCKETS: readonly FdrBucket[] = ['LOW', 'MID', 'HIGH'];

function lookupHistoryFdr(item: HistorySubset, playerTeamId: number, fdrLookup: FdrLookup): number {
  const key = item.was_home
    ? `${item.round.toString()}:${playerTeamId.toString()}:${item.opponent_team.toString()}`
    : `${item.round.toString()}:${item.opponent_team.toString()}:${playerTeamId.toString()}`;
  const entry = fdrLookup.get(key);
  if (entry === undefined) return FALLBACK_FDR;
  return item.was_home ? entry.homeFdr : entry.awayFdr;
}

function roundTo4dp(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

export interface PlayerFdrAggregate {
  readonly bucket: FdrBucketName;
  readonly avg: number;
  readonly count: number;
}

/**
 * Buckets a player's history items by the FDR they faced and returns the
 * mean FPL `total_points` per bucket. Buckets with no appearances are
 * omitted from the result so the caller can persist exactly what's known.
 *
 * Items with `minutes === 0` are skipped — a player who didn't appear
 * shouldn't influence the average.
 */
export function aggregatePlayerFdrAverages(
  history: readonly HistorySubset[],
  playerTeamId: number,
  fdrLookup: FdrLookup,
): readonly PlayerFdrAggregate[] {
  const accumulators = new Map<FdrBucket, BucketAccumulator>();
  for (const bucket of BUCKETS) {
    accumulators.set(bucket, { total: 0, count: 0 });
  }

  for (const item of history) {
    if (item.minutes <= 0) continue;
    const fdr = lookupHistoryFdr(item, playerTeamId, fdrLookup);
    const bucket = bucketForFdr(fdr);
    const acc = accumulators.get(bucket);
    if (acc !== undefined) {
      acc.total += item.total_points;
      acc.count += 1;
    }
  }

  const result: PlayerFdrAggregate[] = [];
  for (const bucket of BUCKETS) {
    const acc = accumulators.get(bucket);
    if (acc !== undefined && acc.count > 0) {
      result.push({
        bucket,
        avg: roundTo4dp(acc.total / acc.count),
        count: acc.count,
      });
    }
  }
  return result;
}
