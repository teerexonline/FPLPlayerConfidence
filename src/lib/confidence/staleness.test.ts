import { describe, it, expect } from 'vitest';
import { computeIsStale, STALE_GW_THRESHOLD } from './staleness';

describe('computeIsStale', () => {
  it('returns true when lastAppearanceGw is null (no snapshots in window)', () => {
    expect(computeIsStale(35, null)).toBe(true);
  });

  it('returns false when lastAppearanceGw equals currentGw', () => {
    expect(computeIsStale(35, 35)).toBe(false);
  });

  it('returns false when gap equals STALE_GW_THRESHOLD (boundary — not stale)', () => {
    // 35 - 33 = 2, which is NOT > 2 → fresh
    expect(computeIsStale(35, 33)).toBe(false);
    expect(STALE_GW_THRESHOLD).toBe(2);
  });

  it('DGW regression: player with single DGW row at GW33 is NOT stale at GW35', () => {
    // Haaland played a DGW at GW33 stored as one compound snapshot row.
    // MAX(gameweek)=33, currentGw=35 → gap=2, NOT > 2 → isStale=false.
    expect(computeIsStale(35, 33)).toBe(false);
  });

  it('returns true when gap exceeds threshold (genuinely stale)', () => {
    // 35 - 32 = 3, which IS > 2 → stale
    expect(computeIsStale(35, 32)).toBe(true);
  });

  it('returns true for a player who has not played in many GWs', () => {
    expect(computeIsStale(35, 28)).toBe(true);
  });

  it('returns false at GW 1 with lastAppearanceGw 1 (season start edge case)', () => {
    expect(computeIsStale(1, 1)).toBe(false);
  });
});
