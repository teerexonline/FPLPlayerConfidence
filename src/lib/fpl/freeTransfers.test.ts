import { describe, expect, it } from 'vitest';
import { deriveFreeTransfers } from './freeTransfers';
import type { EntryHistory } from './types';

function ev(event: number, transfers: number, cost = 0) {
  return { event, event_transfers: transfers, event_transfers_cost: cost };
}

function chip(name: string, event: number) {
  return { name, event };
}

describe('deriveFreeTransfers', () => {
  it('returns 1 for a brand-new manager (no history yet)', () => {
    expect(deriveFreeTransfers({ current: [], chips: [] })).toBe(1);
  });

  it('uses 0 transfers in GW1 → 2 banked entering GW2', () => {
    const h: EntryHistory = { current: [ev(1, 0)], chips: [] };
    expect(deriveFreeTransfers(h)).toBe(2);
  });

  it('uses 1 transfer in GW1 → 1 banked entering GW2 (consumed + +1)', () => {
    const h: EntryHistory = { current: [ev(1, 1)], chips: [] };
    expect(deriveFreeTransfers(h)).toBe(1);
  });

  it('uses 0 transfers across GW1-3 → 4 banked entering GW4 (1+1+1+1)', () => {
    const h: EntryHistory = { current: [ev(1, 0), ev(2, 0), ev(3, 0)], chips: [] };
    expect(deriveFreeTransfers(h)).toBe(4);
  });

  it('caps banked free transfers at 5', () => {
    const events = Array.from({ length: 10 }, (_, i) => ev(i + 1, 0));
    const h: EntryHistory = { current: events, chips: [] };
    expect(deriveFreeTransfers(h)).toBe(5);
  });

  it('paid transfers (beyond free) do not push the count below 0', () => {
    // GW1 with 1 FT: makes 5 transfers (1 free + 4 paid). Free goes to 0,
    // then +1 grant = 1 entering GW2.
    const h: EntryHistory = { current: [ev(1, 5, 16)], chips: [] };
    expect(deriveFreeTransfers(h)).toBe(1);
  });

  it('preserves the free-transfer balance through a wildcard GW', () => {
    // GW1: no transfers → 2 going into GW2.
    // GW2: wildcard played, 13 transfers → balance preserved + weekly grant.
    const h: EntryHistory = {
      current: [ev(1, 0), ev(2, 13, 0)],
      chips: [chip('wildcard', 2)],
    };
    expect(deriveFreeTransfers(h)).toBe(3); // 2 preserved + 1 weekly
  });

  it('preserves the balance through a free-hit GW the same way', () => {
    const h: EntryHistory = {
      current: [ev(1, 0), ev(2, 13, 0)],
      chips: [chip('freehit', 2)],
    };
    expect(deriveFreeTransfers(h)).toBe(3);
  });

  it('triple-captain and bench-boost chips do NOT preserve balance (no transfers consumed but +1 still applies)', () => {
    // 3xc and bboost don't involve transfers — same end result as no chip.
    const h: EntryHistory = {
      current: [ev(1, 0), ev(2, 0)],
      chips: [chip('3xc', 2)],
    };
    expect(deriveFreeTransfers(h)).toBe(3);
  });

  it('handles unsorted event arrays correctly', () => {
    const h: EntryHistory = {
      current: [ev(3, 0), ev(1, 0), ev(2, 0)],
      chips: [],
    };
    expect(deriveFreeTransfers(h)).toBe(4);
  });

  it('floor at 1 — even an over-spent manager gets the next-GW grant', () => {
    // Just make sure the return value never undershoots the per-GW grant.
    const h: EntryHistory = { current: [ev(1, 99, 392)], chips: [] };
    expect(deriveFreeTransfers(h)).toBeGreaterThanOrEqual(1);
  });
});
