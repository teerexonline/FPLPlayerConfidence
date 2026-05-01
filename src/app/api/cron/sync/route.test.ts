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

function makeRepos(syncStateRaw?: string) {
  return {
    teams: { upsertMany: vi.fn().mockResolvedValue(undefined) },
    players: { upsertMany: vi.fn().mockResolvedValue(undefined) },
    confidenceSnapshots: { upsertMany: vi.fn().mockResolvedValue(undefined) },
    syncMeta: {
      get: vi.fn().mockResolvedValue(syncStateRaw),
      set: vi.fn().mockResolvedValue(undefined),
    },
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

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
    mockGetRepositories.mockReturnValue(repos as ReturnType<typeof getRepositories>);
    mockFetchBootstrapStatic.mockResolvedValue(ok(BOOTSTRAP));
    mockFetchFixtures.mockResolvedValue(ok(FIXTURES));
    mockFetchElementSummary.mockResolvedValue(ok(ELEMENT_SUMMARY));

    const { GET } = await import('./route');
    const res = await GET(makeRequest(VALID_SECRET));
    expect(res.status).toBe(200);
  });
});

describe('GET /api/cron/sync — state transitions', () => {
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

  it('transitions idle → player_history and persists new state', async () => {
    const repos = makeRepos(undefined); // undefined → parseCronSyncState returns idle
    mockGetRepositories.mockReturnValue(repos as ReturnType<typeof getRepositories>);

    const { GET } = await import('./route');
    await GET(makeRequest(VALID_SECRET));

    // Verify sync_state was written with player_history phase
    type SetCall = [key: string, value: string, ts: number];
    const setCalls = (repos.syncMeta.set as unknown as { mock: { calls: SetCall[] } }).mock.calls;
    const found = setCalls.find(([k]) => k === SYNC_STATE_KEY);
    if (found === undefined) throw new Error('sync_state write not found');
    const [key, raw] = found;
    expect(key).toBe(SYNC_STATE_KEY);
    const written = parseCronSyncState(raw);
    expect(written.phase).toBe('player_history');
    expect(written.batchIndex).toBe(0);
    expect(written.playerIds).toHaveLength(1); // one active player in BOOTSTRAP
  });

  it('transitions player_history (final batch) → complete and persists state', async () => {
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
    mockGetRepositories.mockReturnValue(repos as ReturnType<typeof getRepositories>);

    const { GET } = await import('./route');
    await GET(makeRequest(VALID_SECRET));

    type SetCall = [key: string, value: string, ts: number];
    const setCalls = (repos.syncMeta.set as unknown as { mock: { calls: SetCall[] } }).mock.calls;
    const found = setCalls.find(([k]) => k === SYNC_STATE_KEY);
    if (found === undefined) throw new Error('sync_state write not found');
    const written = parseCronSyncState(found[1]);
    expect(written.phase).toBe('complete');
  });

  it('transitions complete → idle and writes last_sync to sync_meta', async () => {
    const completeState: CronSyncState = {
      phase: 'complete',
      batchIndex: 0,
      totalBatches: 1,
      playerIds: [1],
      currentGw: 33,
      startedAt: 1_000_000,
      completedAt: null,
      error: null,
    };
    const repos = makeRepos(JSON.stringify(completeState));
    mockGetRepositories.mockReturnValue(repos as ReturnType<typeof getRepositories>);

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

    const syncStateCall = allSets.find(([k]) => k === SYNC_STATE_KEY);
    const written = parseCronSyncState(syncStateCall?.[1]);
    expect(written.phase).toBe('idle');
    expect(written.completedAt).toBeTypeOf('number');
  });

  it('returns failed state when FPL API errors during bootstrap', async () => {
    mockFetchBootstrapStatic.mockResolvedValue(
      err({ type: 'network_error' as const, message: 'FPL down' }),
    );
    const repos = makeRepos(undefined);
    mockGetRepositories.mockReturnValue(repos as ReturnType<typeof getRepositories>);

    const { GET } = await import('./route');
    const res = await GET(makeRequest(VALID_SECRET));

    // Route returns 200 even on failed state — done=true, sync pipeline stops
    expect(res.status).toBe(200);
    type SetCall = [key: string, value: string, ts: number];
    const setCalls = (repos.syncMeta.set as unknown as { mock: { calls: SetCall[] } }).mock.calls;
    const found = setCalls.find(([k]) => k === SYNC_STATE_KEY);
    if (found === undefined) throw new Error('sync_state write not found');
    const written = parseCronSyncState(found[1]);
    expect(written.phase).toBe('failed');
  });
});
