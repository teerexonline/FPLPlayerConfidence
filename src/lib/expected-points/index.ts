export { bucketForFdr, calculatePlayerXp, calculateTeamXp } from './calculator';
// Note: computeNextGwXpMap is server-only; import it directly from
// '@/lib/expected-points/nextGwXp' to avoid pulling 'server-only' into
// modules that also need the pure calculator (which runs in tests).
export type {
  FdrBucket,
  PlayerBucketAverages,
  PlayerXpInput,
  PlayerXpResult,
  StarterXpInput,
  TeamFixture,
  TeamXpInput,
  TeamXpResult,
} from './types';
