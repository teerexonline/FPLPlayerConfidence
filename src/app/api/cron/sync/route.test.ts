import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ok, err } from '@/lib/utils/result';
import { SYNC_STATE_KEY, parseCronSyncState } from '@/lib/sync/cronSync';
import type { CronSyncState } from '@/lib/sync/cronSync';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('@/lib/db/server', () => ({
  getRepositories: vi.fn(),
}));

vi.mock('@/lib/fpl/api', () => ({
  fetchBootstrapStatic: vi.fn(),
  fetchElementSummary: vi.fn(),
  fetchFixtures: vi.fn(),
}));

// Stub logger so tests stay silent
vi.mock('@/lib/logger/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { getRepositories } from '@/lib/db/server';
import { fetchBootstrapStatic, fetchFixtures, fetchElementSummary } from '@/lib/fpl/api';

const mockGetRepositories = vi.mocked(getRepositories);
const mockFetchBootstrapStatic = vi.mocked(fetchBootstrapStatic);
const mockFetchFixtures = vi.mocked(fetchFixtures);
const mockFetchElementSummary = vi.mocked(fetchElementSummary);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VALID_SECRET = 'test-secret-32chars-xxxxxxxxxxxx';

function makeRequest(secret?: string): Request {
  const headers: Record<string, string> = {};
  if (secret !== undefined) headers['authorization'] = `Bearer ${secret}`;
  return new Request('http://localhost:3000/api/cron/sync', { headers });
}

// Minimal bootstrap with ONE active player — keeps the full-pipeline tests fast.
const BOOTSTRAP = {
  teams: [{ id: 1, code: 3, name: 'Arsenal', short_name: 'ARS' }],
  elements: [
    {
      id: 1,
      web_name: 'Raya',
      team: 1,
      element_type: 1 as const,
      now_cost: 60,
      total_points: 141,
      status: 'a',
      chance_of_playing_next_round: null,
      news: '',
      minutes: 2700,
      influence: 300,
      creativity: 150,
      threat: 200,
    },
  ],
  events: [
    {
      id: 33,
      deadline_time: '2026-04-26T10:00:00Z',
      finished: false,
      is_current: true,
      is_next: false,
    },
  ],
};

const FIXTURES = [
  {
    id: 1,
    event: 1,
    team_h: 1,
    team_a: 2,
    team_h_difficulty: 3,
    team_a_difficulty: 4,
    finished: true,
    kickoff_time: null,
  },
];

const ELEMENT_SUMMARY = {
  history: [
    {
      round: 1,
      opponent_team: 2,
      was_home: true,
      minutes: 90,
      goals_scored: 0,
      assists: 0,
      clean_sheets: 1 as const,
      saves: 3,
      defensive_contribution: 7,
      total_points: 6,
      influence: 0,
      creativity: 0,
      threat: 0,
    },
  ],
};

// Minimal test double — stubs only the subset of repository methods the cron
// sync route actually calls. `as unknown as ReturnType<typeof getRepositories>`
// acknowledges that intentional gap; the remaining interfaces (managerSquads,
// users, watchlist) are present only to satisfy the structural type but are
// never invoked during a sync run.
function makeRepos(syncStateRaw?: string, claimResult = true) {
  return {
    teams: { upsertMany: vi.fn().mockResolvedValue(undefined) },
    players: { upsertMany: vi.fn().mockResolvedValue(undefined) },
    confidenceSnapshots: { upsertMany: vi.fn().mockResolvedValue(undefined) },
    fixtures: {
      deleteAll: vi.fn().mockResolvedValue(undefined),
      upsertMany: vi.fn().mockResolvedValue(undefined),
    },
    playerFdrAverages: {
      deleteAll: vi.fn().mockResolvedValue(undefined),
      upsertMany: vi.fn().mockResolvedValue(undefined),
    },
    syncMeta: {
      get: vi.fn().mockResolvedValue(syncStateRaw),
      set: vi.fn().mockResolvedValue(undefined),
      tryClaimSync: vi.fn().mockResolvedValue(claimResult),
    },
    managerSquads: {
      upsertMany: vi.fn().mockResolvedValue(undefined),
      listByTeamAndGameweek: vi.fn().mockResolvedValue([]),
      latestGameweekForTeam: vi.fn().mockResolvedValue(null),
      listGameweeksForTeam: vi.fn().mockResolvedValue([]),
    },
    users: {
      findById: vi.fn().mockResolvedValue(null),
      listAll: vi.fn().mockResolvedValue([]),
    },
    watchlist: {
      findByUser: vi.fn().mockResolvedValue([]),
      add: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
      contains: vi.fn().mockResolvedValue(false),
      findByAuthUser: vi.fn().mockResolvedValue([]),
      addForAuthUser: vi.fn().mockResolvedValue(undefined),
      removeForAuthUser: vi.fn().mockResolvedValue(undefined),
    },
  };
}

// ─── Auth tests ───────────────────────────────────────────────────────────────

describe('GET /api/cron/sync — auth', () => {
  beforeEach(() => {
    vi.stubEnv('CRON_SECRET', VALID_SECRET);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns 401 when Authorization header is missing', async () => {
    const { GET } = await import('./route');
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it('returns 401 when Authorization header has wrong secret', async () => {
    const { GET } = await import('./route');
    const res = await GET(makeRequest('wrong-secret'));
    expect(res.status).toBe(401);
  });

  it('returns 401 when CRON_SECRET env var is not set', async () => {
    vi.stubEnv('CRON_SECRET', '');
    const { GET } = await import('./route');
    const res = await GET(makeRequest(VALID_SECRET));
    expect(res.status).toBe(401);
  });

  it('returns 200 when Authorization header matches CRON_SECRET', async () => {
    const repos = makeRepos();
    mockGetRepositories.mockReturnValue(repos as unknown as ReturnType<typeof getRepositories>);
    mockFetchBootstrapStatic.mockResolvedValue(ok(BOOTSTRAP));
    mockFetchFixtures.mockResolvedValue(ok(FIXTURES));
    mockFetchElementSummary.mockResolvedValue(ok(ELEMENT_SUMMARY));

    const { GET } = await import('./route');
    const res = await GET(makeRequest(VALID_SECRET));
    expect(res.status).toBe(200);
  });
});

// ─── Concurrency guard tests ──────────────────────────────────────────────────

describe('GET /api/cron/sync — concurrency guard', () => {
  beforeEach(() => {
    vi.stubEnv('CRON_SECRET', VALID_SECRET);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns 409 immediately when tryClaimSync returns false (active sync in flight)', async () => {
    // Simulate a sync already in progress: claim returns false.
    const repos = makeRepos(undefined, false);
    mockGetRepositories.mockReturnValue(repos as unknown as ReturnType<typeof getRepositories>);

    const { GET } = await import('./route');
    const res = await GET(makeRequest(VALID_SECRET));

    expect(res.status).toBe(409);
    expect(await res.text()).toBe('Sync already in progress');
    // Must not start the pipeline — no DB writes beyond the claim attempt.
    expect(repos.syncMeta.set).not.toHaveBeenCalled();
  });

  it('proceeds when tryClaimSync returns true and completes with 200', async () => {
    const repos = makeRepos(undefined, true);
    mockGetRepositories.mockReturnValue(repos as unknown as ReturnType<typeof getRepositories>);
    mockFetchBootstrapStatic.mockResolvedValue(ok(BOOTSTRAP));
    mockFetchFixtures.mockResolvedValue(ok(FIXTURES));
    mockFetchElementSummary.mockResolvedValue(ok(ELEMENT_SUMMARY));

    const { GET } = await import('./route');
    const res = await GET(makeRequest(VALID_SECRET));

    expect(res.status).toBe(200);
    // Claim was called exactly once with the sync_state key.
    expect(repos.syncMeta.tryClaimSync).toHaveBeenCalledOnce();
    expect(repos.syncMeta.tryClaimSync).toHaveBeenCalledWith(
      'sync_state',
      expect.stringContaining('"phase":"bootstrap"'),
      expect.any(Number),
      expect.any(Number),
    );
  });
});

// ─── Full pipeline tests ───────────────────────────────────────────────────────
//
// The route now drives the entire sync pipeline in a single invocation (loop).
// Individual phase-transition logic is unit-tested in cronSync.test.ts.
// These tests verify the route's loop, error handling, and final state.

describe('GET /api/cron/sync — full pipeline', () => {
  beforeEach(() => {
    vi.stubEnv('CRON_SECRET', VALID_SECRET);
    vi.stubEnv('VERCEL_URL', '');
    mockFetchBootstrapStatic.mockResolvedValue(ok(BOOTSTRAP));
    mockFetchFixtures.mockResolvedValue(ok(FIXTURES));
    mockFetchElementSummary.mockResolvedValue(ok(ELEMENT_SUMMARY));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('runs idle → complete → idle in a single invocation and returns 200', async () => {
    // BOOTSTRAP has 1 active player → 1 batch → pipeline completes in:
    //   bootstrap step + player_history step + complete step = 3 loop iterations
    const repos = makeRepos(undefined); // undefined → parseCronSyncState returns idle
    mockGetRepositories.mockReturnValue(repos as unknown as ReturnType<typeof getRepositories>);

    const { GET } = await import('./route');
    const res = await GET(makeRequest(VALID_SECRET));
    expect(res.status).toBe(200);

    // Final persisted state must be idle with completedAt set
    type SetCall = [key: string, value: string, ts: number];
    const setCalls = (repos.syncMeta.set as unknown as { mock: { calls: SetCall[] } }).mock.calls;
    const allSyncStateWrites = setCalls.filter(([k]) => k === SYNC_STATE_KEY);
    // Must have written state at least 3 times (bootstrap, batch, complete)
    expect(allSyncStateWrites.length).toBeGreaterThanOrEqual(3);

    const lastWrite = allSyncStateWrites[allSyncStateWrites.length - 1];
    if (lastWrite === undefined) throw new Error('No sync_state writes found');
    const finalState = parseCronSyncState(lastWrite[1]);
    expect(finalState.phase).toBe('idle');
    expect(finalState.completedAt).toBeTypeOf('number');
    expect(finalState.error).toBeNull();
  });

  it('writes last_sync to sync_meta on completion', async () => {
    const repos = makeRepos(undefined);
    mockGetRepositories.mockReturnValue(repos as unknown as ReturnType<typeof getRepositories>);

    const { GET } = await import('./route');
    await GET(makeRequest(VALID_SECRET));

    const allSets = (repos.syncMeta.set as ReturnType<typeof vi.fn>).mock.calls as [
      string,
      string,
      number,
    ][];
    const lastSyncCall = allSets.find(([k]) => k === 'last_sync');
    expect(lastSyncCall).toBeDefined();
    expect(lastSyncCall?.[0]).toBe('last_sync');
  });

  it('resumes from player_history state and completes without re-bootstrapping', async () => {
    const playerHistoryState: CronSyncState = {
      phase: 'player_history',
      batchIndex: 0,
      totalBatches: 1,
      playerIds: [1],
      currentGw: 33,
      startedAt: 1_000_000,
      completedAt: null,
      error: null,
    };
    const repos = makeRepos(JSON.stringify(playerHistoryState));
    mockGetRepositories.mockReturnValue(repos as unknown as ReturnType<typeof getRepositories>);

    const { GET } = await import('./route');
    const res = await GET(makeRequest(VALID_SECRET));
    expect(res.status).toBe(200);

    type SetCall = [key: string, value: string, ts: number];
    const setCalls = (repos.syncMeta.set as unknown as { mock: { calls: SetCall[] } }).mock.calls;
    const syncStateCalls = setCalls.filter(([k]) => k === SYNC_STATE_KEY);
    const lastWrite = syncStateCalls[syncStateCalls.length - 1];
    if (lastWrite === undefined) throw new Error('No sync_state writes');
    const finalState = parseCronSyncState(lastWrite[1]);
    expect(finalState.phase).toBe('idle');
  });

  it('stops at failed phase and returns 200 (pipeline records error, not HTTP 5xx)', async () => {
    mockFetchBootstrapStatic.mockResolvedValue(
      err({ type: 'network_error' as const, message: 'FPL down' }),
    );
    const repos = makeRepos(undefined);
    mockGetRepositories.mockReturnValue(repos as unknown as ReturnType<typeof getRepositories>);

    const { GET } = await import('./route');
    const res = await GET(makeRequest(VALID_SECRET));

    // Route returns 200 even on failed state — done=true, pipeline stops cleanly
    expect(res.status).toBe(200);
    type SetCall = [key: string, value: string, ts: number];
    const setCalls = (repos.syncMeta.set as unknown as { mock: { calls: SetCall[] } }).mock.calls;
    const found = setCalls.find(([k]) => k === SYNC_STATE_KEY);
    if (found === undefined) throw new Error('sync_state write not found');
    const written = parseCronSyncState(found[1]);
    expect(written.phase).toBe('failed');
  });
});
