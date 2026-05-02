import { describe, expect, it, vi } from 'vitest';
import { ok, err } from '@/lib/utils/result';
import type { ManagerSquadRepository } from '@/lib/db/repositories/ManagerSquadRepository';
import type { DbManagerSquadPick } from '@/lib/db/types';
import type { EntryPick, EntryPicks } from '@/lib/fpl/types';
import { backfillManagerSquads } from './backfillManagerSquads';

// ── Test helpers ──────────────────────────────────────────────────────────────

function makeEntryPick(position: number): EntryPick {
  return {
    element: position * 100,
    position,
    is_captain: position === 1,
    is_vice_captain: position === 2,
  };
}

function makeEntryPicks(activeChip: string | null = null): EntryPicks {
  return {
    picks: Array.from({ length: 15 }, (_, i) => makeEntryPick(i + 1)),
    active_chip: activeChip,
  };
}

/** Minimal fake repository — records upsert calls, exposes existing GW list. */
function makeFakeRepo(existingGws: number[] = []): {
  repo: ManagerSquadRepository;
  upsertCalls: DbManagerSquadPick[][];
} {
  const upsertCalls: DbManagerSquadPick[][] = [];
  const repo: ManagerSquadRepository = {
    upsertMany: (picks) => {
      upsertCalls.push([...picks]);
      return Promise.resolve();
    },
    listByTeamAndGameweek: () => Promise.resolve([]),
    latestGameweekForTeam: () =>
      Promise.resolve(existingGws.length > 0 ? Math.max(...existingGws) : null),
    listGameweeksForTeam: () => Promise.resolve(existingGws),
  };
  return { repo, upsertCalls };
}

// ── backfillManagerSquads ─────────────────────────────────────────────────────

describe('backfillManagerSquads', () => {
  it('upserts picks for each GW in the range with no existing data', async () => {
    const { repo, upsertCalls } = makeFakeRepo([]);
    const fetchPicks = vi.fn().mockResolvedValue(ok(makeEntryPicks()));

    const summary = await backfillManagerSquads({
      teamId: 12345,

      fromGw: 1,
      toGw: 3,
      fetchPicks,
      repo,
      delayMs: 0,
    });

    expect(summary.gwsUpserted).toBe(3);
    expect(summary.gwsAlreadyPresent).toBe(0);
    expect(summary.gwsSkipped).toBe(0);
    expect(summary.gwsErrored).toBe(0);
    expect(upsertCalls).toHaveLength(3);
    // Each upsert receives 15 picks.
    expect(upsertCalls[0]).toHaveLength(15);
  });

  it('stores picks with correct team_id, gameweek, and pick fields', async () => {
    const { repo, upsertCalls } = makeFakeRepo([]);
    const fetchPicks = vi.fn().mockResolvedValue(ok(makeEntryPicks()));

    await backfillManagerSquads({
      teamId: 99999,
      fromGw: 5,
      toGw: 5,
      fetchPicks,
      repo,
      delayMs: 0,
    });

    const firstPick = upsertCalls[0]?.[0];
    expect(firstPick).toMatchObject({
      team_id: 99999,
      gameweek: 5,
      player_id: 100,
      squad_position: 1,
      is_captain: true,
      is_vice_captain: false,
    });
  });

  it('skips GWs already present in the database without fetching', async () => {
    const { repo, upsertCalls } = makeFakeRepo([1, 2, 3]);
    const fetchPicks = vi.fn().mockResolvedValue(ok(makeEntryPicks()));

    const summary = await backfillManagerSquads({
      teamId: 12345,

      fromGw: 1,
      toGw: 5,
      fetchPicks,
      repo,
      delayMs: 0,
    });

    expect(summary.gwsAlreadyPresent).toBe(3);
    expect(summary.gwsUpserted).toBe(2); // GW4 and GW5
    expect(fetchPicks).toHaveBeenCalledTimes(2); // only GW4 and GW5 fetched
    expect(upsertCalls).toHaveLength(2);
  });

  it('skips 404 responses without erroring', async () => {
    const { repo } = makeFakeRepo([]);
    const fetchPicks = vi
      .fn()
      .mockResolvedValueOnce(ok(makeEntryPicks())) // GW1 ok
      .mockResolvedValueOnce(err({ type: 'not_found' })) // GW2 404
      .mockResolvedValueOnce(ok(makeEntryPicks())); // GW3 ok

    const summary = await backfillManagerSquads({
      teamId: 12345,

      fromGw: 1,
      toGw: 3,
      fetchPicks,
      repo,
      delayMs: 0,
    });

    expect(summary.gwsUpserted).toBe(2);
    expect(summary.gwsSkipped).toBe(1);
    expect(summary.gwsErrored).toBe(0);

    const skippedResult = summary.results.find((r) => r.gameweek === 2);
    expect(skippedResult?.status).toBe('skipped_404');
  });

  it('records non-404 errors without halting the loop', async () => {
    const { repo, upsertCalls } = makeFakeRepo([]);
    const fetchPicks = vi
      .fn()
      .mockResolvedValueOnce(ok(makeEntryPicks())) // GW1 ok
      .mockResolvedValueOnce(
        err({ type: 'http_error', status: 500, message: 'Internal Server Error' }),
      ) // GW2 500
      .mockResolvedValueOnce(ok(makeEntryPicks())); // GW3 ok

    const summary = await backfillManagerSquads({
      teamId: 12345,

      fromGw: 1,
      toGw: 3,
      fetchPicks,
      repo,
      delayMs: 0,
    });

    expect(summary.gwsUpserted).toBe(2);
    expect(summary.gwsErrored).toBe(1);
    expect(upsertCalls).toHaveLength(2); // GW2 not written

    const errResult = summary.results.find((r) => r.gameweek === 2);
    expect(errResult?.status).toBe('error');
    expect(errResult?.error).toContain('500');
  });

  it('in dry-run mode fetches but does not call upsertMany', async () => {
    const { repo, upsertCalls } = makeFakeRepo([]);
    const fetchPicks = vi.fn().mockResolvedValue(ok(makeEntryPicks()));

    const summary = await backfillManagerSquads({
      teamId: 12345,

      fromGw: 1,
      toGw: 3,
      fetchPicks,
      repo,
      dryRun: true,
      delayMs: 0,
    });

    expect(fetchPicks).toHaveBeenCalledTimes(3);
    expect(upsertCalls).toHaveLength(0);
    expect(summary.results.every((r) => r.status === 'dry_run')).toBe(true);
  });

  it('calls onProgress once per GW with correct status', async () => {
    const { repo } = makeFakeRepo([]);
    const fetchPicks = vi
      .fn()
      .mockResolvedValueOnce(ok(makeEntryPicks()))
      .mockResolvedValueOnce(err({ type: 'not_found' }))
      .mockResolvedValueOnce(ok(makeEntryPicks()));

    const progressLog: string[] = [];

    await backfillManagerSquads({
      teamId: 12345,

      fromGw: 1,
      toGw: 3,
      fetchPicks,
      repo,
      delayMs: 0,
      onProgress: (r) => {
        progressLog.push(`${r.gameweek.toString()}:${r.status}`);
      },
    });

    expect(progressLog).toEqual(['1:upserted', '2:skipped_404', '3:upserted']);
  });

  it('stores Free Hit GW picks as-is — no fallback applied during backfill', async () => {
    const { repo, upsertCalls } = makeFakeRepo([]);
    const fhPicks = makeEntryPicks('freehit');
    const fetchPicks = vi.fn().mockResolvedValue(ok(fhPicks));

    await backfillManagerSquads({
      teamId: 12345,

      fromGw: 5,
      toGw: 5,
      fetchPicks,
      repo,
      delayMs: 0,
    });

    // Backfill stores the actual GW5 squad regardless of chip played.
    expect(upsertCalls[0]).toHaveLength(15);
    // Gameweek field is exactly 5, not GW4.
    expect(upsertCalls[0]?.[0]?.gameweek).toBe(5);
  });

  it('GW1 Free Hit — stores GW1 picks unchanged (no prior GW to fall back to)', async () => {
    const { repo, upsertCalls } = makeFakeRepo([]);
    const gw1FhPicks = makeEntryPicks('freehit');
    const fetchPicks = vi.fn().mockResolvedValue(ok(gw1FhPicks));

    await backfillManagerSquads({
      teamId: 12345,

      fromGw: 1,
      toGw: 1,
      fetchPicks,
      repo,
      delayMs: 0,
    });

    expect(upsertCalls[0]?.[0]?.gameweek).toBe(1);
    expect(upsertCalls[0]).toHaveLength(15);
  });

  it('returns correct results array in GW order', async () => {
    const { repo } = makeFakeRepo([2]);
    const fetchPicks = vi
      .fn()
      .mockResolvedValueOnce(ok(makeEntryPicks()))
      .mockResolvedValueOnce(err({ type: 'not_found' }));

    const summary = await backfillManagerSquads({
      teamId: 12345,

      fromGw: 1,
      toGw: 3,
      fetchPicks,
      repo,
      delayMs: 0,
    });

    expect(summary.results.map((r) => r.gameweek)).toEqual([1, 2, 3]);
    expect(summary.results[0]?.status).toBe('upserted');
    expect(summary.results[1]?.status).toBe('already_present');
    expect(summary.results[2]?.status).toBe('skipped_404');
  });

  it('handles empty range (fromGw > toGw) gracefully', async () => {
    const { repo } = makeFakeRepo([]);
    const fetchPicks = vi.fn();

    const summary = await backfillManagerSquads({
      teamId: 12345,

      fromGw: 10,
      toGw: 5,
      fetchPicks,
      repo,
      delayMs: 0,
    });

    expect(fetchPicks).not.toHaveBeenCalled();
    expect(summary.results).toHaveLength(0);
    expect(summary.gwsUpserted).toBe(0);
  });
});
