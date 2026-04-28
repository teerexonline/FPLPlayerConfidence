import type { ManagerSquadRepository } from '@/lib/db/repositories/ManagerSquadRepository';
import type { EntryPicks, FetchError } from '@/lib/fpl/types';
import type { Result } from '@/lib/utils/result';

export interface GwResult {
  readonly gameweek: number;
  readonly status: 'upserted' | 'skipped_404' | 'already_present' | 'error' | 'dry_run';
  /** Number of picks stored/would-store. Undefined for skipped/error rows. */
  readonly picks?: number;
  readonly error?: string;
}

export interface BackfillParams {
  readonly teamId: number;
  readonly userId: number;
  readonly fromGw: number;
  readonly toGw: number;
  readonly fetchPicks: (gameweek: number) => Promise<Result<EntryPicks, FetchError>>;
  readonly repo: ManagerSquadRepository;
  /** When true, fetches data but does not write to the database. */
  readonly dryRun?: boolean;
  /** Milliseconds to wait between GW fetches. Defaults to 150. */
  readonly delayMs?: number;
  /** Called after each GW is processed — use for progress logging. */
  readonly onProgress?: (result: GwResult) => void;
}

export interface BackfillSummary {
  readonly gwsUpserted: number;
  readonly gwsAlreadyPresent: number;
  readonly gwsSkipped: number;
  readonly gwsErrored: number;
  readonly results: readonly GwResult[];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatFetchError(error: FetchError): string {
  if (error.type === 'http_error') return `http_error ${error.status.toString()}`;
  if (error.type === 'network_error') return `network_error: ${error.message}`;
  if (error.type === 'invalid_response') return `invalid_response: ${error.message}`;
  return error.type;
}

/**
 * Backfills manager_squads rows for a manager team from fromGw to toGw (inclusive).
 *
 * When to run: once, when the local DB is missing historical squad data because
 * the app's sync job first ran mid-season. The FPL API exposes historical picks
 * for all past gameweeks via entry/{teamId}/event/{gw}/picks/, so data that
 * predates local sync is still recoverable.
 *
 * Idempotent: GWs already present in manager_squads are detected up-front via
 * listGameweeksForTeam and skipped without touching the API. Re-running after a
 * partial failure is safe — completed GWs are not re-fetched.
 *
 * Free Hit handling: this function stores the actual squad the manager registered
 * for each GW, including Free Hit weeks. The Free Hit resolution logic in
 * resolveSquadPicks (for "current team" display) is not applicable here because
 * historical browsing shows the raw squad per GW.
 */
export async function backfillManagerSquads(params: BackfillParams): Promise<BackfillSummary> {
  const {
    teamId,
    userId,
    fromGw,
    toGw,
    fetchPicks,
    repo,
    dryRun = false,
    delayMs = 150,
    onProgress,
  } = params;

  const existingGws = new Set(repo.listGameweeksForTeam(userId, teamId));

  const results: GwResult[] = [];
  let gwsUpserted = 0;
  let gwsAlreadyPresent = 0;
  let gwsSkipped = 0;
  let gwsErrored = 0;

  for (let gw = fromGw; gw <= toGw; gw++) {
    if (existingGws.has(gw)) {
      const result: GwResult = { gameweek: gw, status: 'already_present' };
      results.push(result);
      gwsAlreadyPresent++;
      onProgress?.(result);
      continue;
    }

    const fetchResult = await fetchPicks(gw);

    if (!fetchResult.ok) {
      if (fetchResult.error.type === 'not_found') {
        const result: GwResult = { gameweek: gw, status: 'skipped_404' };
        results.push(result);
        gwsSkipped++;
        onProgress?.(result);
      } else {
        const result: GwResult = {
          gameweek: gw,
          status: 'error',
          error: formatFetchError(fetchResult.error),
        };
        results.push(result);
        gwsErrored++;
        onProgress?.(result);
      }
    } else {
      const { picks } = fetchResult.value;
      const now = Date.now();

      if (!dryRun) {
        repo.upsertMany(
          picks.map((p) => ({
            user_id: userId,
            team_id: teamId,
            gameweek: gw,
            player_id: p.element,
            squad_position: p.position,
            is_captain: p.is_captain,
            is_vice_captain: p.is_vice_captain,
            fetched_at: now,
          })),
        );
        const result: GwResult = { gameweek: gw, status: 'upserted', picks: picks.length };
        results.push(result);
        gwsUpserted++;
        onProgress?.(result);
      } else {
        const result: GwResult = { gameweek: gw, status: 'dry_run', picks: picks.length };
        results.push(result);
        onProgress?.(result);
      }
    }

    if (gw < toGw) {
      await sleep(delayMs);
    }
  }

  return { gwsUpserted, gwsAlreadyPresent, gwsSkipped, gwsErrored, results };
}
