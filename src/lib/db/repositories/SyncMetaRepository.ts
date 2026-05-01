export interface SyncMetaRepository {
  /**
   * Returns the stored string value for a key, or `undefined` if the key
   * has not been set.
   */
  get(key: string): Promise<string | undefined>;

  /** Stores or overwrites a key–value pair with an explicit timestamp. */
  set(key: string, value: string, updatedAt: number): Promise<void>;

  /**
   * Atomically claims the sync lock by writing `claimedValue` under `key`.
   *
   * The write succeeds (returns `true`) only when the current stored value
   * satisfies one of:
   *  - the key does not exist yet, OR
   *  - `$.phase` is `'idle'` or `'failed'`, OR
   *  - `$.startedAt` is older than `updatedAt - staleMs` (stale lock override).
   *
   * Returns `false` without writing if an active sync is in flight.
   * This collapses the read-then-decide pattern into a single atomic statement,
   * preventing the race where two callers both observe `phase='idle'`.
   */
  tryClaimSync(
    key: string,
    claimedValue: string,
    updatedAt: number,
    staleMs: number,
  ): Promise<boolean>;
}
