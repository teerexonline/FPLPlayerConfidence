'use server';

import { getRepositories } from '@/lib/db/server';
import { fetchBootstrapStatic, fetchElementSummary, fetchFixtures } from '@/lib/fpl/api';
import { syncConfidence } from '@/lib/sync';
import type { SyncResult } from '@/lib/sync/types';

export type SyncActionResult =
  | { ok: true; result: SyncResult; syncedAt: number }
  | { ok: false; error: string };

export async function triggerSync(): Promise<SyncActionResult> {
  try {
    const repos = getRepositories();
    const now = Date.now();

    const outcome = await syncConfidence({
      api: { fetchBootstrapStatic, fetchElementSummary, fetchFixtures },
      repos,
      clock: () => Date.now(),
      throttleMs: 200,
    });

    if (!outcome.ok) {
      const e = outcome.error;
      const errMsg =
        e.type === 'not_found'
          ? 'not_found'
          : e.type === 'http_error'
            ? `http_error: ${e.status.toString()}`
            : `${e.type}: ${e.message}`;
      return { ok: false, error: errMsg };
    }

    return { ok: true, result: outcome.value, syncedAt: now };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unknown sync error' };
  }
}
