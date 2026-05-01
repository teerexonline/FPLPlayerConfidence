'use server';

import { createLogger } from '@/lib/logger/logger';

const logger = createLogger('settings/actions');

export type ManualSyncResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: string };

/**
 * Kicks off a new chunked sync run by calling the cron endpoint server-side.
 * Returns immediately — the pipeline self-chains via fire-and-forget fetches.
 * The client polls /api/sync-status to track progress.
 */
export async function triggerManualSync(): Promise<ManualSyncResult> {
  const secret = process.env['CRON_SECRET'];
  if (!secret) {
    logger.error('triggerManualSync: CRON_SECRET not configured');
    return { ok: false, error: 'Sync not configured. Contact support.' };
  }

  const baseUrl = process.env['VERCEL_URL']
    ? `https://${process.env['VERCEL_URL']}`
    : 'http://localhost:3000';

  try {
    const response = await fetch(`${baseUrl}/api/cron/sync`, {
      headers: { authorization: `Bearer ${secret}` },
    });

    if (!response.ok) {
      const text = await response.text();
      logger.warn('triggerManualSync: cron endpoint returned non-200', {
        status: response.status,
        body: text,
      });
      return { ok: false, error: `Sync endpoint returned ${response.status.toString()}` };
    }

    logger.info('triggerManualSync: first batch triggered successfully');
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Network error';
    logger.error('triggerManualSync: fetch threw', { error: message });
    return { ok: false, error: message };
  }
}
