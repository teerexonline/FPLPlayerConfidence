import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ok, err } from '@/lib/utils/result';
import type { BootstrapStatic, ElementSummary, Fixtures } from '@/lib/fpl/types';
import {
  IDLE_CRON_SYNC_STATE,
  PLAYERS_PER_BATCH,
  computeTotalBatches,
  executeSyncStep,
  isLastBatch,
  parseCronSyncState,
  serializeCronSyncState,
} from './cronSync';
import type { CronSyncDeps, CronSyncState } from './cronSync';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ELEMENT_DEFAULTS = {
  now_cost: 60,
  status: 'a',
  chance_of_playing_next_round: null,
  news: '',
  minutes: 1500,
  influence: 300,
  creativity: 200,
  threat: 400,
};

function makeBootstrap(opts?: { activePlayers?: number; currentGw?: number }): BootstrapStatic {
  const count = opts?.activePlayers ?? 2;
  const gw = opts?.currentGw ?? 3;

  const elements = Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    web_name: `Player${(i + 1).toString()}`,
    team: 1,
    element_type: 1 as const,
    total_points: 100,
    ...ELEMENT_DEFAULTS,
  }));

  return {
    teams: [{ id: 1, code: 3, name: 'Arsenal', short_name: 'ARS' }],
    elements,
    events: [
      {
        id: 1,
        deadline_time: '2025-08-15T17:30:00Z',
        finished: true,
        is_current: false,
        is_next: false,
      },
      {
        id: 2,
        deadline_time: '2025-08-22T17:30:00Z',
        finished: true,
        is_current: false,
        is_next: false,
      },
      {
        id: gw,
        deadline_time: '2025-08-30T10:00:00Z',
        finished: false,
        is_current: true,
        is_next: false,
      },
    ],
  };
}

const FIXTURES: Fixtures = [
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

const ELEMENT_SUMMARY: ElementSummary = {
  history: [
    {
      round: 1,
      opponent_team: 2,
      was_home: true,
      minutes: 90,
      goals_scored: 0,
      assists: 0,
      clean_sheets: 1,
      saves: 3,
      defensive_contribution: 7,
      total_points: 6,
      influence: 0,
      creativity: 0,
      threat: 0,
    },
  ],
};

// ─── Fake deps factory ────────────────────────────────────────────────────────

interface TestMocks {
  readonly teamsUpsertMany: ReturnType<typeof vi.fn>;
  readonly playersUpsertMany: ReturnType<typeof vi.fn>;
  readonly snapshotsUpsertMany: ReturnType<typeof vi.fn>;
  readonly syncMetaGet: ReturnType<typeof vi.fn>;
  readonly syncMetaSet: ReturnType<typeof vi.fn>;
}

function makeDeps(overrides?: Partial<CronSyncDeps['api']>): {
  deps: CronSyncDeps;
  mocks: TestMocks;
} {
  const teamsUpsertMany = vi.fn().mockResolvedValue(undefined);
  const playersUpsertMany = vi.fn().mockResolvedValue(undefined);
  const snapshotsUpsertMany = vi.fn().mockResolvedValue(undefined);
  const syncMetaGet = vi.fn();
  const syncMetaSet = vi.fn().mockResolvedValue(undefined);

  const deps: CronSyncDeps = {
    api: {
      fetchBootstrapStatic: vi.fn().mockResolvedValue(ok(makeBootstrap())),
      fetchElementSummary: vi.fn().mockResolvedValue(ok(ELEMENT_SUMMARY)),
      fetchFixtures: vi.fn().mockResolvedValue(ok(FIXTURES)),
      ...overrides,
    },
    repos: {
      teams: { upsertMany: teamsUpsertMany },
      players: { upsertMany: playersUpsertMany },
      confidenceSnapshots: { upsertMany: snapshotsUpsertMany },
      syncMeta: { get: syncMetaGet, set: syncMetaSet },
    } as unknown as CronSyncDeps['repos'],
    clock: () => 1_000_000,
    throttleMs: 0,
  };

  return {
    deps,
    mocks: { teamsUpsertMany, playersUpsertMany, snapshotsUpsertMany, syncMetaGet, syncMetaSet },
  };
}

// ─── parseCronSyncState ────────────────────────────────────────────────────────

describe('parseCronSyncState', () => {
  it('returns idle default when raw is undefined', () => {
    expect(parseCronSyncState(undefined)).toEqual(IDLE_CRON_SYNC_STATE);
  });

  it('returns idle default for empty string', () => {
    expect(parseCronSyncState('')).toEqual(IDLE_CRON_SYNC_STATE);
  });

  it('returns idle default for invalid JSON', () => {
    expect(parseCronSyncState('{bad json')).toEqual(IDLE_CRON_SYNC_STATE);
  });

  it('returns idle default when phase field is unrecognised', () => {
    const raw = JSON.stringify({ phase: 'unknown_phase' });
    expect(parseCronSyncState(raw)).toEqual(IDLE_CRON_SYNC_STATE);
  });

  it('parses a valid player_history state', () => {
    const state: CronSyncState = {
      phase: 'player_history',
      batchIndex: 4,
      totalBatches: 28,
      playerIds: [1, 2, 3],
      currentGw: 33,
      startedAt: 1_000_000,
      completedAt: 900_000,
      error: null,
    };
    expect(parseCronSyncState(JSON.stringify(state))).toEqual(state);
  });

  it('parses a failed state', () => {
    const state: CronSyncState = {
      ...IDLE_CRON_SYNC_STATE,
      phase: 'failed',
      error: 'network_error: timeout',
    };
    expect(parseCronSyncState(JSON.stringify(state))).toEqual(state);
  });

  it('filters non-number entries from playerIds', () => {
    const raw = JSON.stringify({ phase: 'idle', playerIds: [1, 'bad', 2, null] });
    const parsed = parseCronSyncState(raw);
    expect(parsed.playerIds).toEqual([1, 2]);
  });

  it('returns idle for JSON null', () => {
    expect(parseCronSyncState('null')).toEqual(IDLE_CRON_SYNC_STATE);
  });

  it('returns idle for JSON array', () => {
    expect(parseCronSyncState('[]')).toEqual(IDLE_CRON_SYNC_STATE);
  });
});

// ─── serializeCronSyncState ───────────────────────────────────────────────────

describe('serializeCronSyncState', () => {
  it('produces a roundtrip-stable value', () => {
    const state: CronSyncState = {
      phase: 'player_history',
      batchIndex: 7,
      totalBatches: 28,
      playerIds: [10, 20, 30],
      currentGw: 33,
      startedAt: 1_000_000,
      completedAt: null,
      error: null,
    };
    expect(parseCronSyncState(serializeCronSyncState(state))).toEqual(state);
  });
});

// ─── isLastBatch ──────────────────────────────────────────────────────────────

describe('isLastBatch', () => {
  it('returns true when batchIndex equals totalBatches - 1', () => {
    expect(isLastBatch(4, 5)).toBe(true);
  });

  it('returns true when batchIndex exceeds totalBatches - 1', () => {
    expect(isLastBatch(5, 5)).toBe(true);
  });

  it('returns false for non-final batches', () => {
    expect(isLastBatch(0, 5)).toBe(false);
    expect(isLastBatch(3, 5)).toBe(false);
  });

  it('returns false for zero totalBatches', () => {
    expect(isLastBatch(0, 0)).toBe(false);
  });
});

// ─── computeTotalBatches ──────────────────────────────────────────────────────

describe('computeTotalBatches', () => {
  it('returns 1 for zero players', () => {
    expect(computeTotalBatches(0)).toBe(1);
  });

  it('returns 1 for exactly PLAYERS_PER_BATCH players', () => {
    expect(computeTotalBatches(PLAYERS_PER_BATCH)).toBe(1);
  });

  it('returns 2 for PLAYERS_PER_BATCH + 1 players', () => {
    expect(computeTotalBatches(PLAYERS_PER_BATCH + 1)).toBe(2);
  });

  it('computes correct batches for 830 players', () => {
    // 830 players / 15 per batch = ceil(55.33) = 56
    expect(computeTotalBatches(830)).toBe(Math.ceil(830 / PLAYERS_PER_BATCH));
  });
});

// ─── executeSyncStep — bootstrap (idle → player_history) ─────────────────────

describe('executeSyncStep — bootstrap from idle', () => {
  let deps: CronSyncDeps;
  let mocks: TestMocks;

  beforeEach(() => {
    ({ deps, mocks } = makeDeps());
  });

  it('returns player_history phase with correct batch metadata', async () => {
    const { nextState, done } = await executeSyncStep(IDLE_CRON_SYNC_STATE, deps);

    expect(done).toBe(false);
    expect(nextState.phase).toBe('player_history');
    expect(nextState.batchIndex).toBe(0);
    expect(nextState.totalBatches).toBe(1); // 2 active players ÷ 15 = 1 batch
    expect(nextState.playerIds).toHaveLength(2);
    expect(nextState.startedAt).toBe(1_000_000);
    expect(nextState.error).toBeNull();
  });

  it('upserts teams and players', async () => {
    await executeSyncStep(IDLE_CRON_SYNC_STATE, deps);

    expect(mocks.teamsUpsertMany).toHaveBeenCalledOnce();
    expect(mocks.playersUpsertMany).toHaveBeenCalledOnce();
  });

  it('excludes zero-points players from playerIds', async () => {
    const bootstrapWithInactive: BootstrapStatic = {
      ...makeBootstrap({ activePlayers: 0 }),
      elements: [
        {
          id: 99,
          web_name: 'Bench',
          team: 1,
          element_type: 1,
          total_points: 0,
          ...ELEMENT_DEFAULTS,
        },
        {
          id: 1,
          web_name: 'Active',
          team: 1,
          element_type: 1,
          total_points: 50,
          ...ELEMENT_DEFAULTS,
        },
      ],
    };
    const { deps: depsOverride } = makeDeps({
      fetchBootstrapStatic: vi.fn().mockResolvedValue(ok(bootstrapWithInactive)),
    });

    const { nextState } = await executeSyncStep(IDLE_CRON_SYNC_STATE, depsOverride);
    expect(nextState.playerIds).toEqual([1]);
  });

  it('captures currentGw from bootstrap events', async () => {
    const { deps: depsWithGw } = makeDeps({
      fetchBootstrapStatic: vi.fn().mockResolvedValue(ok(makeBootstrap({ currentGw: 33 }))),
    });

    const { nextState } = await executeSyncStep(IDLE_CRON_SYNC_STATE, depsWithGw);
    expect(nextState.currentGw).toBe(33);
  });

  it('preserves completedAt from prior state', async () => {
    const prior: CronSyncState = { ...IDLE_CRON_SYNC_STATE, completedAt: 500_000 };
    const { nextState } = await executeSyncStep(prior, deps);
    expect(nextState.completedAt).toBe(500_000);
  });

  it('transitions failed → player_history (retry)', async () => {
    const failedState: CronSyncState = { ...IDLE_CRON_SYNC_STATE, phase: 'failed', error: 'boom' };
    const { nextState, done } = await executeSyncStep(failedState, deps);
    expect(done).toBe(false);
    expect(nextState.phase).toBe('player_history');
    expect(nextState.error).toBeNull();
  });

  it('returns failed state when bootstrap-static fetch errors', async () => {
    const { deps: depsWithError } = makeDeps({
      fetchBootstrapStatic: vi
        .fn()
        .mockResolvedValue(err({ type: 'network_error' as const, message: 'timeout' })),
    });

    const { nextState, done } = await executeSyncStep(IDLE_CRON_SYNC_STATE, depsWithError);
    expect(done).toBe(true);
    expect(nextState.phase).toBe('failed');
    expect(nextState.error).toContain('network_error');
  });

  it('returns failed state when fixtures fetch errors', async () => {
    const { deps: depsWithError } = makeDeps({
      fetchFixtures: vi
        .fn()
        .mockResolvedValue(
          err({ type: 'http_error' as const, status: 503, message: 'unavailable' }),
        ),
    });

    const { nextState, done } = await executeSyncStep(IDLE_CRON_SYNC_STATE, depsWithError);
    expect(done).toBe(true);
    expect(nextState.phase).toBe('failed');
    expect(nextState.error).toContain('http_error');
  });
});

// ─── executeSyncStep — player_history batch ───────────────────────────────────

describe('executeSyncStep — player_history batch', () => {
  function makePlayerHistoryState(opts?: {
    batchIndex?: number;
    totalBatches?: number;
    playerIds?: number[];
  }): CronSyncState {
    return {
      phase: 'player_history',
      batchIndex: opts?.batchIndex ?? 0,
      totalBatches: opts?.totalBatches ?? 3,
      playerIds: opts?.playerIds ?? [1, 2],
      currentGw: 33,
      startedAt: 900_000,
      completedAt: 800_000,
      error: null,
    };
  }

  it('increments batchIndex after a non-final batch', async () => {
    const state = makePlayerHistoryState({ batchIndex: 0, totalBatches: 3 });
    const { deps: batchDeps } = makeDeps();
    const { nextState, done } = await executeSyncStep(state, batchDeps);

    expect(done).toBe(false);
    expect(nextState.phase).toBe('player_history');
    expect(nextState.batchIndex).toBe(1);
  });

  it('transitions to complete after the final batch', async () => {
    const state = makePlayerHistoryState({ batchIndex: 2, totalBatches: 3 });
    const { deps: batchDeps } = makeDeps();
    const { nextState, done } = await executeSyncStep(state, batchDeps);

    expect(done).toBe(false);
    expect(nextState.phase).toBe('complete');
  });

  it('calls fetchElementSummary for each player in the batch', async () => {
    const state = makePlayerHistoryState({ playerIds: [1, 2], batchIndex: 0, totalBatches: 1 });
    const { deps } = makeDeps();

    await executeSyncStep(state, deps);

    expect(deps.api.fetchElementSummary).toHaveBeenCalledTimes(2);
    expect(deps.api.fetchElementSummary).toHaveBeenCalledWith(1);
    expect(deps.api.fetchElementSummary).toHaveBeenCalledWith(2);
  });

  it('writes snapshots for players with match history', async () => {
    const state = makePlayerHistoryState({ playerIds: [1], batchIndex: 0, totalBatches: 1 });
    const { deps, mocks } = makeDeps();

    await executeSyncStep(state, deps);

    expect(mocks.snapshotsUpsertMany).toHaveBeenCalled();
  });

  it('skips players not present in the bootstrap element map', async () => {
    // playerIds contains ID 999 which isn't in the bootstrap
    const state = makePlayerHistoryState({ playerIds: [999], batchIndex: 0, totalBatches: 1 });
    const { deps } = makeDeps();

    await executeSyncStep(state, deps);

    expect(deps.api.fetchElementSummary).not.toHaveBeenCalled();
  });

  it('skips a player whose element-summary fetch fails without aborting the batch', async () => {
    const state = makePlayerHistoryState({ playerIds: [1, 2], batchIndex: 0, totalBatches: 1 });
    const { deps } = makeDeps({
      fetchElementSummary: vi
        .fn()
        .mockResolvedValueOnce(err({ type: 'not_found' as const }))
        .mockResolvedValue(ok(ELEMENT_SUMMARY)),
    });

    const { nextState } = await executeSyncStep(state, deps);

    // Batch completes (transitions to complete since totalBatches=1)
    expect(nextState.phase).toBe('complete');
    // Both were attempted
    expect(deps.api.fetchElementSummary).toHaveBeenCalledTimes(2);
  });

  it('returns failed state when bootstrap re-fetch fails during batch', async () => {
    const state = makePlayerHistoryState({ batchIndex: 0, totalBatches: 3 });
    const { deps } = makeDeps({
      fetchBootstrapStatic: vi
        .fn()
        .mockResolvedValue(err({ type: 'network_error' as const, message: 'down' })),
    });

    const { nextState, done } = await executeSyncStep(state, deps);

    expect(done).toBe(true);
    expect(nextState.phase).toBe('failed');
  });

  it('only processes players in the current batch slice', async () => {
    // batch size 15, but we're on batch index 0 with totalBatches=2
    // playerIds = [1..16] where only the first PLAYERS_PER_BATCH are processed
    const ids = Array.from({ length: PLAYERS_PER_BATCH + 1 }, (_, i) => i + 1);
    // Make all elements available in bootstrap
    const bigBootstrap: BootstrapStatic = {
      teams: [{ id: 1, code: 3, name: 'Arsenal', short_name: 'ARS' }],
      elements: ids.map((id) => ({
        id,
        web_name: `P${id.toString()}`,
        team: 1,
        element_type: 1 as const,
        total_points: 100,
        ...ELEMENT_DEFAULTS,
      })),
      events: [
        {
          id: 1,
          deadline_time: '2025-08-15T17:30:00Z',
          finished: true,
          is_current: true,
          is_next: false,
        },
      ],
    };
    const state: CronSyncState = {
      phase: 'player_history',
      batchIndex: 0,
      totalBatches: 2,
      playerIds: ids,
      currentGw: 1,
      startedAt: 1_000_000,
      completedAt: null,
      error: null,
    };
    const { deps } = makeDeps({
      fetchBootstrapStatic: vi.fn().mockResolvedValue(ok(bigBootstrap)),
    });

    await executeSyncStep(state, deps);

    // Batch 0 should only process first PLAYERS_PER_BATCH players
    expect(deps.api.fetchElementSummary).toHaveBeenCalledTimes(PLAYERS_PER_BATCH);
    expect(deps.api.fetchElementSummary).toHaveBeenCalledWith(1);
    expect(deps.api.fetchElementSummary).not.toHaveBeenCalledWith(PLAYERS_PER_BATCH + 1);
  });
});

// ─── executeSyncStep — complete phase ─────────────────────────────────────────

describe('executeSyncStep — complete', () => {
  const completeState: CronSyncState = {
    phase: 'complete',
    batchIndex: 27,
    totalBatches: 28,
    playerIds: [1, 2],
    currentGw: 33,
    startedAt: 900_000,
    completedAt: null,
    error: null,
  };

  it('transitions to idle with completedAt set', async () => {
    const { deps: completeDeps } = makeDeps();
    const { nextState, done } = await executeSyncStep(completeState, completeDeps);

    expect(done).toBe(true);
    expect(nextState.phase).toBe('idle');
    expect(nextState.completedAt).toBe(1_000_000);
    expect(nextState.error).toBeNull();
  });

  it('writes last_sync and current_gameweek to sync_meta', async () => {
    const { deps, mocks } = makeDeps();
    await executeSyncStep(completeState, deps);

    expect(mocks.syncMetaSet).toHaveBeenCalledWith('last_sync', '1000000', 1_000_000);
    expect(mocks.syncMetaSet).toHaveBeenCalledWith('current_gameweek', '33', 1_000_000);
  });
});

// ─── executeSyncStep — full mock flow end-to-end ──────────────────────────────

describe('executeSyncStep — full pipeline simulation', () => {
  it('runs idle → player_history → complete → idle with correct state transitions', async () => {
    const { deps } = makeDeps(); // 2 active players → 1 batch

    // Step 1: idle → player_history
    const { nextState: s1, done: d1 } = await executeSyncStep(IDLE_CRON_SYNC_STATE, deps);
    expect(d1).toBe(false);
    expect(s1.phase).toBe('player_history');
    expect(s1.batchIndex).toBe(0);
    expect(s1.totalBatches).toBe(1);

    // Step 2: player_history (final batch) → complete
    const { nextState: s2, done: d2 } = await executeSyncStep(s1, deps);
    expect(d2).toBe(false);
    expect(s2.phase).toBe('complete');

    // Step 3: complete → idle
    const { nextState: s3, done: d3 } = await executeSyncStep(s2, deps);
    expect(d3).toBe(true);
    expect(s3.phase).toBe('idle');
    expect(s3.completedAt).toBe(1_000_000);
  });
});
