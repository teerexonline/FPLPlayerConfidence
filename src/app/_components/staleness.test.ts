import { describe, expect, it } from 'vitest';
import { isStale } from './staleness';

describe('isStale', () => {
  // ── Boundary cases ─────────────────────────────────────────────────────────

  it('returns false when currentGW is 0 (no GW established yet)', () => {
    // First sync — can't determine staleness; never filter on unknown current GW.
    expect(isStale(1, 0)).toBe(false);
    expect(isStale(5, 0)).toBe(false);
  });

  it('returns false when player snapshot is at the current GW', () => {
    expect(isStale(34, 34)).toBe(false);
  });

  // ── Within-threshold (not stale) ──────────────────────────────────────────

  it('returns false when player is 1 GW behind', () => {
    expect(isStale(33, 34)).toBe(false);
  });

  it('returns false when player is exactly 2 GWs behind', () => {
    expect(isStale(32, 34)).toBe(false);
  });

  it('returns false when player is exactly 3 GWs behind (inclusive boundary)', () => {
    // Threshold is > 3, so 3 behind is NOT stale.
    expect(isStale(31, 34)).toBe(false);
  });

  // ── Over threshold (stale) ────────────────────────────────────────────────

  it('returns true when player is exactly 4 GWs behind (exclusive boundary)', () => {
    // 34 - 30 = 4 > 3 → stale
    expect(isStale(30, 34)).toBe(true);
  });

  it('returns true when player is 5 GWs behind', () => {
    expect(isStale(29, 34)).toBe(true);
  });

  // ── Real-world case: Leeds Salah (GW5 snapshot, GW34 current) ─────────────

  it('returns true for the Salah-at-Leeds case (GW5 snapshot, currentGW 34)', () => {
    // 34 - 5 = 29 > 3 → stale
    expect(isStale(5, 34)).toBe(true);
  });

  it('returns true when snapshot is at GW1 and currentGW is 38 (end of season)', () => {
    expect(isStale(1, 38)).toBe(true);
  });

  // ── Edge: current GW equals snapshot GW at start of season ───────────────

  it('returns false when both are GW1 (season start)', () => {
    expect(isStale(1, 1)).toBe(false);
  });

  it('returns false when both are the same mid-season GW', () => {
    expect(isStale(20, 20)).toBe(false);
  });
});
