import { describe, expect, it } from 'vitest';
import { MAX_SWAPS, parseSwaps } from './parseSwaps';

describe('parseSwaps', () => {
  it('returns empty list for null/empty/missing input', () => {
    expect(parseSwaps(null)).toEqual({ ok: true, value: [] });
    expect(parseSwaps('')).toEqual({ ok: true, value: [] });
  });

  it('parses a single swap', () => {
    expect(parseSwaps('100:200')).toEqual({
      ok: true,
      value: [{ outId: 100, inId: 200 }],
    });
  });

  it('parses multiple comma-separated swaps', () => {
    expect(parseSwaps('100:200,300:400,500:600')).toEqual({
      ok: true,
      value: [
        { outId: 100, inId: 200 },
        { outId: 300, inId: 400 },
        { outId: 500, inId: 600 },
      ],
    });
  });

  it('rejects malformed pair (missing colon)', () => {
    const r = parseSwaps('100200');
    expect(r.ok).toBe(false);
  });

  it('rejects non-numeric ids', () => {
    expect(parseSwaps('abc:200').ok).toBe(false);
    expect(parseSwaps('100:xyz').ok).toBe(false);
  });

  it('rejects negative or zero ids', () => {
    expect(parseSwaps('0:200').ok).toBe(false);
    expect(parseSwaps('100:-1').ok).toBe(false);
  });

  it('rejects swap-to-self (outId === inId)', () => {
    expect(parseSwaps('100:100').ok).toBe(false);
  });

  it('rejects duplicate outIds (same player out twice)', () => {
    expect(parseSwaps('100:200,100:300').ok).toBe(false);
  });

  it('rejects duplicate inIds (same player in twice)', () => {
    expect(parseSwaps('100:200,300:200').ok).toBe(false);
  });

  it(`enforces MAX_SWAPS (${MAX_SWAPS.toString()})`, () => {
    const tooMany = Array.from(
      { length: MAX_SWAPS + 1 },
      (_, i) => `${(i + 1).toString()}:${(i + 1001).toString()}`,
    ).join(',');
    expect(parseSwaps(tooMany).ok).toBe(false);
  });

  it('exposes MAX_SWAPS as a positive integer', () => {
    expect(MAX_SWAPS).toBeGreaterThan(0);
    expect(Number.isInteger(MAX_SWAPS)).toBe(true);
  });
});
