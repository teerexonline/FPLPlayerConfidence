import { calculateConfidence } from '@/lib/confidence';
import type { Repositories } from '@/lib/db';
import type { BootstrapStatic, FetchError, Fixtures } from '@/lib/fpl/types';
import type { Result } from '@/lib/utils/result';
import { collapseByGameweek } from './internal/collapseByGameweek';
import {
  buildFdrLookup,
  buildNextFdrByTeam,
  elementTypeToPosition,
  FALLBACK_FDR,
  mapMatchEvents,
} from './internal/matchEventMapper';

// ─── Constants ───────────────────────────────────────────────────────────────

/** Players processed per cron invocation. 30 × 150 ms throttle ≈ 4.4 s wait + overhead ≈ 7–8 s total. */
export const PLAYERS_PER_BATCH = 30;

/** Throttle between FPL element-summary requests (ms). */
export const CRON_THROTTLE_MS = 150;

/** sync_meta key that stores the JSON-serialised CronSyncState. */
export const SYNC_STATE_KEY = 'sync_state';

// ─── State types ─────────────────────────────────────────────────────────────

export type CronSyncPhase = 'idle' | 'player_history' | 'complete' | 'failed';

export interface CronSyncState {
  /** Current phase of the chunked sync pipeline. */
  readonly phase: CronSyncPhase;
  /** Index of the player_history batch currently being processed (0-based). */
  readonly batchIndex: number;
  /** Total number of player_history batches for this sync run. */
  readonly totalBatches: number;
  /** Ordered list of active player IDs to process (set after bootstrap). */
  readonly playerIds: readonly number[];
  /** FPL gameweek resolved during bootstrap, used for current_gameweek sync_meta key. */
  readonly currentGw: number;
  /** Unix ms timestamp when the current sync run started. */
  readonly startedAt: number | null;
  /** Unix ms timestamp of the last successfully completed sync run. */
  readonly completedAt: number | null;
  /** Failure message, populated when phase='failed'. */
  readonly error: string | null;
}

export const IDLE_CRON_SYNC_STATE: CronSyncState = {
  phase: 'idle',
  batchIndex: 0,
  totalBatches: 0,
  playerIds: [],
  currentGw: 1,
  startedAt: null,
  completedAt: null,
  error: null,
};

// ─── State serialisation ──────────────────────────────────────────────────────

function isCronSyncPhase(value: unknown): value is CronSyncPhase {
  return (
    value === 'idle' || value === 'player_history' || value === 'complete' || value === 'failed'
  );
}

/** Parses the raw string stored in sync_meta. Falls back to IDLE_CRON_SYNC_STATE on any error. */
export function parseCronSyncState(raw: string | undefined): CronSyncState {
  if (raw === undefined) return IDLE_CRON_SYNC_STATE;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return IDLE_CRON_SYNC_STATE;
    }
    const obj = parsed as Record<string, unknown>;
    const phase = obj['phase'];
    if (!isCronSyncPhase(phase)) return IDLE_CRON_SYNC_STATE;
    return {
      phase,
      batchIndex: typeof obj['batchIndex'] === 'number' ? obj['batchIndex'] : 0,
      totalBatches: typeof obj['totalBatches'] === 'number' ? obj['totalBatches'] : 0,
      playerIds: Array.isArray(obj['playerIds'])
        ? (obj['playerIds'] as number[]).filter((x) => typeof x === 'number')
        : [],
      currentGw: typeof obj['currentGw'] === 'number' ? obj['currentGw'] : 1,
      startedAt: typeof obj['startedAt'] === 'number' ? obj['startedAt'] : null,
      completedAt: typeof obj['completedAt'] === 'number' ? obj['completedAt'] : null,
      error: typeof obj['error'] === 'string' ? obj['error'] : null,
    };
  } catch {
    return IDLE_CRON_SYNC_STATE;
  }
}

export function serializeCronSyncState(state: CronSyncState): string {
  return JSON.stringify(state);
}

// ─── Pure helpers (exported for testing) ─────────────────────────────────────

/** True when batchIndex is the final batch in the run. */
export function isLastBatch(batchIndex: number, totalBatches: number): boolean {
  return totalBatches > 0 && batchIndex >= totalBatches - 1;
}

/** Number of batches needed to cover all players at PLAYERS_PER_BATCH each. */
export function computeTotalBatches(playerCount: number): number {
  if (playerCount === 0) return 1;
  return Math.ceil(playerCount / PLAYERS_PER_BATCH);
}

// ─── Deps ─────────────────────────────────────────────────────────────────────

export interface CronSyncDeps {
  readonly api: {
    readonly fetchBootstrapStatic: () => Promise<Result<BootstrapStatic, FetchError>>;
    readonly fetchElementSummary: (
      playerId: number,
    ) => Promise<Result<import('@/lib/fpl/types').ElementSummary, FetchError>>;
    readonly fetchFixtures: () => Promise<Result<Fixtures, FetchError>>;
  };
  readonly repos: Pick<Repositories, 'teams' | 'players' | 'confidenceSnapshots' | 'syncMeta'>;
  readonly clock: () => number;
  /** Milliseconds to wait between element-summary fetches. Defaults to CRON_THROTTLE_MS. */
  readonly throttleMs?: number;
}

// ─── Phase execution ──────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function fetchErrorMessage(error: FetchError): string {
  switch (error.type) {
    case 'not_found':
      return 'not_found';
    case 'network_error':
      return `network_error: ${error.message}`;
    case 'http_error':
      return `http_error: ${error.status.toString()}`;
    case 'invalid_response':
      return `invalid_response: ${error.message}`;
  }
}

/**
 * Resolves the current gameweek from the FPL events list.
 * is_current is the active GW; fall back to is_next − 1 if between GWs;
 * then fall back to the last finished GW.
 */
function resolveCurrentGw(events: BootstrapStatic['events']): number {
  const currentEvent =
    events.find((e) => e.is_current) ??
    events.find((e) => e.is_next && e.id > 1) ??
    [...events].filter((e) => e.finished).pop();
  return currentEvent?.id ?? 1;
}

/** Fetches bootstrap-static + fixtures. Used at the start of bootstrap and player-history phases. */
async function fetchBootstrapAndFixtures(
  api: CronSyncDeps['api'],
): Promise<
  { ok: true; bootstrap: BootstrapStatic; fixtures: Fixtures } | { ok: false; error: string }
> {
  const [bsResult, fixResult] = await Promise.all([
    api.fetchBootstrapStatic(),
    api.fetchFixtures(),
  ]);
  if (!bsResult.ok) return { ok: false, error: fetchErrorMessage(bsResult.error) };
  if (!fixResult.ok) return { ok: false, error: fetchErrorMessage(fixResult.error) };
  return { ok: true, bootstrap: bsResult.value, fixtures: fixResult.value };
}

/**
 * Executes one step of the chunked sync pipeline based on the current phase.
 *
 * - `idle | failed`  → bootstrap: fetch + upsert teams/players, schedule player batches
 * - `player_history` → fetch element-summaries for one batch, compute + persist confidence
 * - `complete`       → write sync_meta timestamps, transition back to idle
 *
 * Returns the state to persist after this step and whether the pipeline is finished.
 */
export async function executeSyncStep(
  state: CronSyncState,
  deps: CronSyncDeps,
): Promise<{ nextState: CronSyncState; done: boolean; message: string }> {
  const { api, repos, clock } = deps;
  const throttleMs = deps.throttleMs ?? CRON_THROTTLE_MS;
  const now = clock();

  // ── Bootstrap phase (idle or failed → player_history) ──────────────────────
  if (state.phase === 'idle' || state.phase === 'failed') {
    const fetched = await fetchBootstrapAndFixtures(api);
    if (!fetched.ok) {
      return {
        nextState: { ...state, phase: 'failed', error: fetched.error },
        done: true,
        message: `Bootstrap failed: ${fetched.error}`,
      };
    }

    const { bootstrap, fixtures } = fetched;
    const { teams, elements, events } = bootstrap;
    const currentGw = resolveCurrentGw(events);
    const nextFdrByTeam = buildNextFdrByTeam(fixtures, currentGw);

    await repos.teams.upsertMany(teams);
    await repos.players.upsertMany(
      elements.map((e) => ({
        id: e.id,
        web_name: e.web_name,
        team_id: e.team,
        position: elementTypeToPosition(e.element_type),
        now_cost: e.now_cost,
        total_points: e.total_points,
        updated_at: now,
        status: e.status,
        chance_of_playing_next_round: e.chance_of_playing_next_round,
        news: e.news,
        influence: e.influence,
        creativity: e.creativity,
        threat: e.threat,
        minutes: e.minutes,
        next_fixture_fdr: nextFdrByTeam.get(e.team) ?? FALLBACK_FDR,
      })),
    );

    const activePlayers = elements.filter((e) => e.total_points > 0);
    const playerIds = activePlayers.map((e) => e.id);
    const totalBatches = computeTotalBatches(playerIds.length);

    const nextState: CronSyncState = {
      phase: 'player_history',
      batchIndex: 0,
      totalBatches,
      playerIds,
      currentGw,
      startedAt: now,
      completedAt: state.completedAt,
      error: null,
    };
    return {
      nextState,
      done: false,
      message: `Bootstrap complete. ${playerIds.length.toString()} active players, ${totalBatches.toString()} batches queued.`,
    };
  }

  // ── Player-history batch phase ──────────────────────────────────────────────
  if (state.phase === 'player_history') {
    const fetched = await fetchBootstrapAndFixtures(api);
    if (!fetched.ok) {
      return {
        nextState: { ...state, phase: 'failed', error: fetched.error },
        done: true,
        message: `Player batch failed (fetch): ${fetched.error}`,
      };
    }

    const { bootstrap, fixtures } = fetched;
    const fdrLookup = buildFdrLookup(fixtures);

    // Build element lookup for team + position resolution
    const elementMap = new Map(bootstrap.elements.map((e) => [e.id, e]));

    const { batchIndex, totalBatches, playerIds } = state;
    const start = batchIndex * PLAYERS_PER_BATCH;
    const batchIds = playerIds.slice(start, start + PLAYERS_PER_BATCH);

    for (const [i, playerId] of batchIds.entries()) {
      if (i > 0) await delay(throttleMs);

      const element = elementMap.get(playerId);
      if (element === undefined) continue;

      const summaryResult = await api.fetchElementSummary(playerId);
      if (!summaryResult.ok) continue; // isolated failure — skip player, don't abort batch

      const position = elementTypeToPosition(element.element_type);
      const matchEvents = mapMatchEvents(summaryResult.value.history, element.team, fdrLookup);
      if (matchEvents.length === 0) continue;

      const { history } = calculateConfidence({ position, matches: matchEvents });
      const snapshots = collapseByGameweek(playerId, history);
      await repos.confidenceSnapshots.upsertMany(snapshots);
    }

    const last = isLastBatch(batchIndex, totalBatches);
    const nextState: CronSyncState = last
      ? { ...state, phase: 'complete' }
      : { ...state, batchIndex: batchIndex + 1 };

    return {
      nextState,
      done: false,
      message: `Batch ${(batchIndex + 1).toString()}/${totalBatches.toString()} complete.`,
    };
  }

  // ── Complete phase ──────────────────────────────────────────────────────────
  // TypeScript has narrowed state.phase to 'complete' at this point.
  await repos.syncMeta.set('last_sync', String(now), now);
  await repos.syncMeta.set('current_gameweek', String(state.currentGw), now);

  const nextState: CronSyncState = {
    ...state,
    phase: 'idle',
    completedAt: now,
    error: null,
  };
  return { nextState, done: true, message: 'Sync complete.' };
}
