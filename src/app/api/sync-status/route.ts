import { getRepositories } from '@/lib/db/server';
import { SYNC_STATE_KEY, parseCronSyncState } from '@/lib/sync/cronSync';
import type { CronSyncPhase } from '@/lib/sync/cronSync';

export interface SyncStatusResponse {
  readonly phase: CronSyncPhase;
  readonly batchIndex: number;
  readonly totalBatches: number;
  /** Unix ms timestamp of the last successful sync completion, or null if never synced. */
  readonly completedAt: number | null;
  /** Failure message, populated when phase='failed'. */
  readonly error: string | null;
}

/** Returns the current sync pipeline state. No authentication required — read-only status. */
export async function GET(): Promise<Response> {
  const repos = getRepositories();
  const raw = await repos.syncMeta.get(SYNC_STATE_KEY);
  const state = parseCronSyncState(raw);

  const body: SyncStatusResponse = {
    phase: state.phase,
    batchIndex: state.batchIndex,
    totalBatches: state.totalBatches,
    completedAt: state.completedAt,
    error: state.error,
  };

  return Response.json(body);
}
