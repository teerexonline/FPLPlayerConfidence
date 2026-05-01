import { after } from 'next/server';
import { getRepositories } from '@/lib/db/server';
import { fetchBootstrapStatic, fetchElementSummary, fetchFixtures } from '@/lib/fpl/api';
import { createLogger } from '@/lib/logger/logger';
import {
  SYNC_STATE_KEY,
  executeSyncStep,
  parseCronSyncState,
  serializeCronSyncState,
} from '@/lib/sync/cronSync';

const logger = createLogger('api/cron/sync');

// Vercel Hobby: 10-second hard limit. Each invocation handles one phase/batch,
// then fires the next via self-fetch so the pipeline chains without a long-running function.
export const maxDuration = 10;

/**
 * Verifies that the request carries the expected bearer token.
 *
 * Vercel automatically sends `Authorization: Bearer ${CRON_SECRET}` when
 * invoking cron endpoints. We use the same header for self-recursive calls
 * and manual triggers from the Settings page Server Action.
 *
 * Fails closed: if CRON_SECRET is not configured, all requests are rejected.
 */
function isAuthorized(request: Request): boolean {
  const secret = process.env['CRON_SECRET'];
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

/**
 * Fires the next batch invocation as a background fetch guaranteed to be
 * delivered before Vercel tears down the function context.
 *
 * `after` (next/server) is the Next.js-native post-response lifecycle hook
 * for Route Handlers. It keeps the function instance alive until the given
 * promise resolves, guaranteeing the self-trigger fetch is dispatched even
 * after the Response has been sent. `waitUntil` from @vercel/functions is
 * designed for Edge/Middleware and does not integrate with the Next.js Route
 * Handler lifecycle — it dropped triggers after ~4 consecutive rapid hops.
 */
function triggerNextBatch(baseUrl: string, secret: string): void {
  after(
    fetch(`${baseUrl}/api/cron/sync`, {
      headers: { authorization: `Bearer ${secret}` },
    }).catch(() => undefined),
  );
}

export async function GET(request: Request): Promise<Response> {
  if (!isAuthorized(request)) {
    logger.warn('Unauthorized cron request rejected');
    return new Response('Unauthorized', { status: 401 });
  }

  const repos = getRepositories();
  const rawState = await repos.syncMeta.get(SYNC_STATE_KEY);
  const state = parseCronSyncState(rawState);

  logger.info('Cron sync step starting', {
    phase: state.phase,
    batchIndex: state.batchIndex,
    totalBatches: state.totalBatches,
  });

  let nextState;
  let done: boolean;
  let message: string;

  try {
    ({ nextState, done, message } = await executeSyncStep(state, {
      api: { fetchBootstrapStatic, fetchElementSummary, fetchFixtures },
      repos,
      clock: () => Date.now(),
    }));
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : 'Unknown error';
    logger.error('Cron sync step threw unexpectedly', { phase: state.phase, error: errMsg });
    const failedState = { ...state, phase: 'failed' as const, error: errMsg };
    await repos.syncMeta.set(SYNC_STATE_KEY, serializeCronSyncState(failedState), Date.now());
    return new Response(`Sync step threw: ${errMsg}`, { status: 500 });
  }

  await repos.syncMeta.set(SYNC_STATE_KEY, serializeCronSyncState(nextState), Date.now());

  if (nextState.phase === 'failed') {
    logger.error('Cron sync step failed', { phase: state.phase, error: nextState.error });
  } else {
    logger.info('Cron sync step complete', { nextPhase: nextState.phase, message });
  }

  if (!done) {
    const secret = process.env['CRON_SECRET'] ?? '';
    const baseUrl = process.env['VERCEL_URL']
      ? `https://${process.env['VERCEL_URL']}`
      : 'http://localhost:3000';
    triggerNextBatch(baseUrl, secret);
  }

  return new Response(message, { status: 200 });
}
