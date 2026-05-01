import { getRepositories } from '@/lib/db/server';
import { fetchBootstrapStatic, fetchElementSummary, fetchFixtures } from '@/lib/fpl/api';
import { createLogger } from '@/lib/logger/logger';
import {
  STALE_LOCK_MS,
  SYNC_STATE_KEY,
  executeSyncStep,
  parseCronSyncState,
  serializeCronSyncState,
} from '@/lib/sync/cronSync';

const logger = createLogger('api/cron/sync');

// Fluid Compute default is 300 s on all plans — sufficient for a full sync
// (~35 batches × ~2 s each from Next.js Data Cache ≈ 70 s total).
// No explicit maxDuration needed; do NOT cap at 10 s (previous approach used
// self-chaining to work around the 10 s limit, but Vercel Hobby burst-limits
// rapid self-invocations to ~5 consecutive calls, causing the chain to stall).

/**
 * Verifies that the request carries the expected bearer token.
 *
 * Vercel automatically sends `Authorization: Bearer ${CRON_SECRET}` when
 * invoking cron endpoints. We use the same header for manual triggers from
 * the Settings page Server Action.
 *
 * Fails closed: if CRON_SECRET is not configured, all requests are rejected.
 */
function isAuthorized(request: Request): boolean {
  const secret = process.env['CRON_SECRET'];
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

/**
 * Drives the full sync pipeline to completion in a single invocation.
 *
 * Each loop iteration advances one step (bootstrap, player-history batch, or
 * finalize). State is persisted to sync_meta after every step so the
 * /api/sync-status polling endpoint can show live progress in the UI.
 *
 * If a step returns phase=failed the loop stops early and the error is
 * recorded in sync_meta for display. Any thrown exception is caught, written
 * as a failed state, and returned as HTTP 500.
 *
 * On Hobby the Fluid Compute default (300 s) is enough for the full pipeline.
 * On Pro/Enterprise the limit is 800 s.
 */
export async function GET(request: Request): Promise<Response> {
  if (!isAuthorized(request)) {
    logger.warn('Unauthorized cron request rejected');
    return new Response('Unauthorized', { status: 401 });
  }

  const repos = getRepositories();
  const rawState = await repos.syncMeta.get(SYNC_STATE_KEY);
  let state = parseCronSyncState(rawState);
  const now = Date.now();

  // Atomically claim the sync lock. The DB is updated from 'idle'/'failed' (or
  // a stale lock) to 'bootstrap' in a single conditional UPSERT. If another
  // invocation is already in flight the claim returns false and we 409 fast.
  const claimedState = { ...state, phase: 'bootstrap' as const, startedAt: now };
  const claimed = await repos.syncMeta.tryClaimSync(
    SYNC_STATE_KEY,
    serializeCronSyncState(claimedState),
    now,
    STALE_LOCK_MS,
  );
  if (!claimed) {
    logger.warn('Sync already in progress — rejecting concurrent request', {
      phase: state.phase,
      startedAt: state.startedAt,
    });
    return new Response('Sync already in progress', { status: 409 });
  }

  logger.info('Cron sync starting', {
    phase: state.phase,
    batchIndex: state.batchIndex,
    totalBatches: state.totalBatches,
  });

  const deps = {
    api: { fetchBootstrapStatic, fetchElementSummary, fetchFixtures },
    repos,
    clock: () => Date.now(),
  };

  let lastMessage = 'Sync complete.';

  try {
    for (;;) {
      const { nextState, done, message } = await executeSyncStep(state, deps);

      await repos.syncMeta.set(SYNC_STATE_KEY, serializeCronSyncState(nextState), Date.now());
      lastMessage = message;

      if (nextState.phase === 'failed') {
        logger.error('Cron sync failed', { phase: state.phase, error: nextState.error });
        return new Response(message, { status: 200 });
      }

      logger.info('Cron sync step complete', { nextPhase: nextState.phase, message });

      if (done) break;
      state = nextState;
    }
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : 'Unknown error';
    logger.error('Cron sync threw unexpectedly', { phase: state.phase, error: errMsg });
    const failedState = { ...state, phase: 'failed' as const, error: errMsg };
    await repos.syncMeta.set(SYNC_STATE_KEY, serializeCronSyncState(failedState), Date.now());
    return new Response(`Sync threw: ${errMsg}`, { status: 500 });
  }

  return new Response(lastMessage, { status: 200 });
}
