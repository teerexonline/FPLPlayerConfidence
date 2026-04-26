import { describe, it, expect } from 'vitest';
import { resolveFreeHit } from './freehit';

describe('resolveFreeHit', () => {
  it('returns the target GW unchanged when no chip is active', () => {
    const result = resolveFreeHit(null, 30);
    expect(result).toEqual({
      gameweek: 30,
      freeHitBypassed: false,
      freeHitGameweek: null,
      isGw1FreeHit: false,
    });
  });

  it('returns the target GW unchanged for non-freehit chips', () => {
    const result = resolveFreeHit('bboost', 30);
    expect(result).toEqual({
      gameweek: 30,
      freeHitBypassed: false,
      freeHitGameweek: null,
      isGw1FreeHit: false,
    });
  });

  it('steps back one GW when Free Hit is active on GW > 1', () => {
    const result = resolveFreeHit('freehit', 30);
    expect(result).toEqual({
      gameweek: 29,
      freeHitBypassed: true,
      freeHitGameweek: 30,
      isGw1FreeHit: false,
    });
  });

  it('records the correct freeHitGameweek when bypassing', () => {
    const result = resolveFreeHit('freehit', 15);
    expect(result.freeHitGameweek).toBe(15);
    expect(result.gameweek).toBe(14);
  });

  it('does not step back on GW1 — sets isGw1FreeHit instead', () => {
    const result = resolveFreeHit('freehit', 1);
    expect(result).toEqual({
      gameweek: 1,
      freeHitBypassed: false,
      freeHitGameweek: null,
      isGw1FreeHit: true,
    });
  });

  it('handles GW2 Free Hit — steps back to GW1', () => {
    const result = resolveFreeHit('freehit', 2);
    expect(result).toEqual({
      gameweek: 1,
      freeHitBypassed: true,
      freeHitGameweek: 2,
      isGw1FreeHit: false,
    });
  });

  // Property: freeHitBypassed and isGw1FreeHit are mutually exclusive
  it('never sets both freeHitBypassed and isGw1FreeHit simultaneously', () => {
    const cases = [null, 'freehit', 'bboost', '3xc', 'wildcard'];
    const gws = [1, 2, 10, 38];
    for (const chip of cases) {
      for (const gw of gws) {
        const r = resolveFreeHit(chip, gw);
        expect(r.freeHitBypassed && r.isGw1FreeHit).toBe(false);
      }
    }
  });

  // Property: when not bypassed, gameweek equals targetGw
  it('returns the original targetGw whenever freeHitBypassed is false', () => {
    expect(resolveFreeHit(null, 20).gameweek).toBe(20);
    expect(resolveFreeHit('bboost', 20).gameweek).toBe(20);
    expect(resolveFreeHit('freehit', 1).gameweek).toBe(1);
  });

  // Property: when bypassed, gameweek is always targetGw - 1
  it('returns targetGw - 1 whenever freeHitBypassed is true', () => {
    [2, 5, 20, 38].forEach((gw) => {
      const r = resolveFreeHit('freehit', gw);
      expect(r.gameweek).toBe(gw - 1);
    });
  });
});
