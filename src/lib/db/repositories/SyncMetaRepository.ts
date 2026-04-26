export interface SyncMetaRepository {
  /**
   * Returns the stored string value for a key, or `undefined` if the key
   * has not been set.
   */
  get(key: string): string | undefined;

  /** Stores or overwrites a key–value pair with an explicit timestamp. */
  set(key: string, value: string, updatedAt: number): void;
}
