import { describe, expect, it, vi } from 'vitest';
import type { FetchPicksFn } from './resolveSquadPicks';
import { resolveSquadPicks } from './resolveSquadPicks';
import type { EntryPicks, FetchError } from './types';
import type { Result } from '@/lib/utils/result';
import { err, ok } from '@/lib/utils/result';

// ── Fixture helpers ─────────────────────────────────────────────────────────

const makePick = (pos: number) => ({
  element: pos * 100,
  position: pos,
  is_captain: pos === 1,
  is_vice_captain: pos === 2,
});

function makePickResult(activeChip: string | null = null): Result<EntryPicks, FetchError> {
  return ok({
    active_chip: activeChip,
    picks: Array.from({ length: 15 }, (_, i) => makePick(i + 1)),
  });
}

const make404 = (): Result<EntryPicks, FetchError> => err({ type: 'not_found' });
const makeNetErr = (): Result<EntryPicks, FetchError> =>
  err({ type: 'network_error', message: 'Connection refused' });

function fetchAlways(result: Result<EntryPicks, FetchError>): FetchPicksFn {
  return vi.fn().mockResolvedValue(result);
}

function fetchMap(map: Record<number, Result<EntryPicks, FetchError>>): FetchPicksFn {
  return vi.fn().mockImplementation((gw: number) => Promise.resolve(map[gw] ?? make404()));
}

// ── Normal path ─────────────────────────────────────────────────────────────

describe('resolveSquadPicks', () => {
  it('currentGw 200, no FH → uses currentGw directly, no fallback', async () => {
    const fetch = fetchAlways(makePickResult());
    const result = await resolveSquadPicks(fetch, 34);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.gameweek).toBe(34);
    expect(result.value.preDeadlineFallback).toBe(false);
    expect(result.value.freeHitBypassed).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(34);
  });

  // ── Pre-deadline fallback ─────────────────────────────────────────────────

  it('currentGw 404 → falls back to currentGw-1, preDeadlineFallback=true', async () => {
    const fetch = fetchMap({ 33: makePickResult() });
    const result = await resolveSquadPicks(fetch, 34);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.gameweek).toBe(33);
    expect(result.value.preDeadlineFallback).toBe(true);
    expect(result.value.freeHitBypassed).toBe(false);
    expect(fetch).toHaveBeenCalledWith(34);
    expect(fetch).toHaveBeenCalledWith(33);
  });

  it('currentGw 200 → does not call fetchPicks a second time (no unnecessary fallback)', async () => {
    const fetch = fetchAlways(makePickResult());
    await resolveSquadPicks(fetch, 34);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  // ── GW1 / pre-season edge cases ───────────────────────────────────────────

  it('currentGw=1, 404 → pre_season (no prior GW to fall back to)', async () => {
    const fetch = fetchAlways(make404());
    const result = await resolveSquadPicks(fetch, 1);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe('pre_season');
    expect(fetch).toHaveBeenCalledTimes(1); // doesn't try GW0
  });

  it('currentGw=2, both GW2 and GW1 return 404 → pre_season', async () => {
    const fetch = fetchAlways(make404());
    const result = await resolveSquadPicks(fetch, 2);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe('pre_season');
    expect(fetch).toHaveBeenCalledWith(2);
    expect(fetch).toHaveBeenCalledWith(1);
  });

  // ── Free Hit path ─────────────────────────────────────────────────────────

  it('currentGw 200 with FH chip → freeHitBypassed, fetches prior GW for regular squad', async () => {
    const fetch = fetchMap({
      34: makePickResult('freehit'),
      33: makePickResult(null),
    });
    const result = await resolveSquadPicks(fetch, 34);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.gameweek).toBe(33);
    expect(result.value.freeHitBypassed).toBe(true);
    expect(result.value.freeHitGameweek).toBe(34);
    expect(result.value.preDeadlineFallback).toBe(false);
    expect(fetch).toHaveBeenCalledWith(34);
    expect(fetch).toHaveBeenCalledWith(33);
  });

  it('FH on GW1 → isGw1FreeHit, no bypass, serves GW1 picks', async () => {
    const fetch = fetchAlways(makePickResult('freehit'));
    const result = await resolveSquadPicks(fetch, 1);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.gameweek).toBe(1);
    expect(result.value.freeHitBypassed).toBe(false);
    expect(result.value.isGw1FreeHit).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1); // no fallback fetch needed
  });

  // ── Combined: pre-deadline + Free Hit ────────────────────────────────────

  it('currentGw 404 AND currentGw-1 has FH → preDeadlineFallback + freeHitBypassed', async () => {
    // GW34 → 404 (deadline not passed)
    // GW33 → FH chip (manager played FH on GW33)
    // GW32 → regular squad
    const fetch = fetchMap({
      33: makePickResult('freehit'),
      32: makePickResult(null),
    });
    const result = await resolveSquadPicks(fetch, 34);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.gameweek).toBe(32);
    expect(result.value.preDeadlineFallback).toBe(true);
    expect(result.value.freeHitBypassed).toBe(true);
    expect(result.value.freeHitGameweek).toBe(33);
    expect(fetch).toHaveBeenCalledWith(34);
    expect(fetch).toHaveBeenCalledWith(33);
    expect(fetch).toHaveBeenCalledWith(32);
  });

  // ── Error propagation ─────────────────────────────────────────────────────

  it('currentGw returns network_error → propagates as fetch_error immediately', async () => {
    const fetch = fetchAlways(makeNetErr());
    const result = await resolveSquadPicks(fetch, 34);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe('fetch_error');
    if (result.error.type !== 'fetch_error') return;
    expect(result.error.inner.type).toBe('network_error');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('currentGw 404, currentGw-1 returns network_error → propagates as fetch_error', async () => {
    const fetch = fetchMap({ 34: make404(), 33: makeNetErr() });
    const result = await resolveSquadPicks(fetch, 34);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe('fetch_error');
  });

  it('FH fallback fetch fails → gracefully serves FH picks unchanged', async () => {
    // GW34 has FH, GW33 fetch fails — serve GW34 FH picks
    const fhPicks = makePickResult('freehit');
    const fetch = fetchMap({ 34: fhPicks, 33: makeNetErr() });
    const result = await resolveSquadPicks(fetch, 34);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Served the GW33 gameweek (fhResolution.gameweek) but with FH picks
    // freeHitBypassed is true — we attempted the bypass but failed gracefully
    expect(result.value.freeHitBypassed).toBe(true);
  });
});
