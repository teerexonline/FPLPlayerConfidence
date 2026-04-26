import type { BootstrapStatic, ElementSummary, FetchError, Fixtures } from '@/lib/fpl/types';
import type { Result } from '@/lib/utils/result';
import type { Repositories } from '@/lib/db';
import type { Logger } from '@/lib/logger';

export interface SyncConfidenceDeps {
  readonly api: {
    readonly fetchBootstrapStatic: () => Promise<Result<BootstrapStatic, FetchError>>;
    readonly fetchElementSummary: (playerId: number) => Promise<Result<ElementSummary, FetchError>>;
    readonly fetchFixtures: () => Promise<Result<Fixtures, FetchError>>;
  };
  readonly repos: Repositories;
  /** Returns the current Unix timestamp in milliseconds. Injected for determinism. */
  readonly clock: () => number;
  /** Milliseconds to wait between element-summary fetches. Defaults to 200. */
  readonly throttleMs?: number;
  /**
   * Logger for diagnostics. Defaults to a module-scoped logger when omitted.
   * Inject a spy in tests to assert on warning output.
   */
  readonly logger?: Logger;
}

export interface SyncResult {
  /** Players whose element-summary was fetched and whose snapshots were written. */
  readonly playersProcessed: number;
  /** Players with total_points=0 or with all minutes=0 (no snapshots to write). */
  readonly playersSkipped: number;
  /** Total confidence snapshot rows written (one per player per gameweek appearance). */
  readonly snapshotsWritten: number;
  /** Per-player failures that were isolated and did not abort the sync. */
  readonly errors: readonly { readonly playerId: number; readonly reason: string }[];
}
