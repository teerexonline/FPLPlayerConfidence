import 'server-only';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { fetchEntryInfo, fetchEntryPicks } from '@/lib/fpl/api';
import { resolveSquadPicks } from '@/lib/fpl/resolveSquadPicks';
import { getRepositories } from '@/lib/db/server';
import { calculateTeamConfidence, confidenceToPercent } from '@/lib/team-confidence';
import { createLogger } from '@/lib/logger';
import type { SquadPlayerRow, MyTeamData, MyTeamApiError } from '@/app/my-team/_components/types';
import type { Position } from '@/lib/db/types';

const logger = createLogger('api/my-team');

// Alias so call sites remain readable.
const toPercent = confidenceToPercent;

function errorResponse(code: MyTeamApiError, status: number): NextResponse {
  return NextResponse.json({ error: code }, { status });
}

/**
 * GET /api/my-team?teamId={n}
 *
 * Loads a manager's squad for the current gameweek. Fetch strategy:
 *  1. Try currentGw — a 200 means the deadline has passed; use those picks.
 *  2. A 404 means deadline not yet passed; fall back to currentGw-1 (preDeadlineFallback=true).
 *  3. Both GWs 404, or currentGw < 1 → PRE_SEASON (503).
 *  4. Free Hit detection: if the resolved GW has FH chip, step back one more GW.
 *  5. Upsert squad to manager_squads cache.
 *  6. Join picks against confidence_snapshots.
 *  7. Run calculateTeamConfidence.
 *  8. Return MyTeamData JSON with preDeadlineFallback and FH metadata.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  // Route handler query parsing — URL.searchParams is synchronous here.
  // (The async searchParams pattern applies only to page/layout props in Next.js 15+,
  // not to route handler request objects.)
  const query = new URL(request.url).searchParams;
  const teamIdRaw = query.get('teamId');

  if (!teamIdRaw || !/^\d+$/.test(teamIdRaw)) {
    logger.warn('GET /api/my-team: invalid teamId param', { teamIdRaw });
    return errorResponse('INVALID_TEAM_ID', 400);
  }

  const teamId = parseInt(teamIdRaw, 10);
  logger.info('GET /api/my-team: fetching squad', { teamId });
  const repos = getRepositories();

  // Resolve target GW. We use currentGW − 1 (Option A per API.md §8 note).
  // Fall back to the max GW in confidence_snapshots when sync_meta hasn't been
  // written yet (legacy DBs synced before this key was added).
  const gwRaw = repos.syncMeta.get('current_gameweek');
  let currentGw = gwRaw ? parseInt(gwRaw, 10) : NaN;

  if (isNaN(currentGw)) {
    const allSnapshots = repos.confidenceSnapshots.currentForAllPlayers();
    const maxGw = allSnapshots.reduce((m, { snapshot }) => Math.max(m, snapshot.gameweek), 0);
    if (maxGw > 0) currentGw = maxGw;
  }

  if (isNaN(currentGw) || currentGw < 1) {
    logger.error('GET /api/my-team: cannot resolve current_gameweek', {});
    return errorResponse('NO_GAMEWEEK_DATA', 503);
  }

  // Start entry info fetch immediately so it overlaps with the first picks fetch.
  const infoPromise = fetchEntryInfo(teamId);

  // Resolve picks with deadline-fallback and Free Hit detection encapsulated.
  const squadResult = await resolveSquadPicks((gw) => fetchEntryPicks(teamId, gw), currentGw);

  if (!squadResult.ok) {
    const { error } = squadResult;
    if (error.type === 'pre_season') {
      logger.info('GET /api/my-team: pre-season, no picks available', { teamId, currentGw });
      return errorResponse('PRE_SEASON', 503);
    }
    // error.type === 'fetch_error'
    logger.warn('GET /api/my-team: picks fetch failed', { teamId, error: error.inner.type });
    if (error.inner.type === 'not_found') return errorResponse('NOT_FOUND', 404);
    if (error.inner.type === 'network_error') return errorResponse('NETWORK_ERROR', 502);
    return errorResponse('SCHEMA_ERROR', 502);
  }

  const {
    picks: finalPicks,
    gameweek: targetGw,
    preDeadlineFallback,
    freeHitBypassed,
    freeHitGameweek,
    isGw1FreeHit,
  } = squadResult.value;

  const infoResult = await infoPromise;

  if (!infoResult.ok) {
    logger.warn('GET /api/my-team: entry info fetch failed', {
      teamId,
      error: infoResult.error.type,
    });
    if (infoResult.error.type === 'not_found') return errorResponse('NOT_FOUND', 404);
    if (infoResult.error.type === 'network_error') return errorResponse('NETWORK_ERROR', 502);
    return errorResponse('SCHEMA_ERROR', 502);
  }

  logger.info('GET /api/my-team: picks + info fetched successfully', {
    teamId,
    targetGw,
    preDeadlineFallback,
  });

  const info = infoResult.value;
  const now = Date.now();

  // Upsert the squad to the manager_squads cache table.
  repos.managerSquads.upsertMany(
    finalPicks.map((p) => ({
      team_id: teamId,
      gameweek: targetGw,
      player_id: p.element,
      squad_position: p.position,
      is_captain: p.is_captain,
      is_vice_captain: p.is_vice_captain,
      fetched_at: now,
    })),
  );

  // Build lookups.
  const allPlayers = repos.players.listAll();
  const allTeams = repos.teams.listAll();
  const playerMap = new Map(allPlayers.map((p) => [p.id, p]));
  const teamMap = new Map(allTeams.map((t) => [t.id, t]));

  // Resolve confidence for each pick from the most recent snapshot.
  const playerIds = finalPicks.map((p) => p.element);
  const confidenceMap = new Map<number, number>();
  for (const pid of playerIds) {
    const snap = repos.confidenceSnapshots.currentByPlayer(
      pid as Parameters<typeof repos.confidenceSnapshots.currentByPlayer>[0],
    );
    confidenceMap.set(pid, snap?.confidence_after ?? 0);
  }

  // Build playerData for team calculator (starters only need positions).
  const playerDataMap = new Map<number, { confidence: number; position: Position }>();
  for (const pid of playerIds) {
    const player = playerMap.get(pid);
    if (player) {
      playerDataMap.set(pid, {
        confidence: confidenceMap.get(pid) ?? 0,
        position: player.position,
      });
    }
  }

  const calcInput = {
    picks: finalPicks.map((p) => ({
      playerId: p.element,
      squadPosition: p.position,
      isCaptain: p.is_captain,
      isViceCaptain: p.is_vice_captain,
    })),
    playerData: playerDataMap,
  };

  const calcResult = calculateTeamConfidence(calcInput);

  // Validation errors here indicate data integrity issues, not user error.
  const teamConfidencePercent = calcResult.ok ? calcResult.value.teamConfidencePercent : 50;
  const positional = calcResult.ok
    ? calcResult.value.positional
    : { defence: 0, midfield: 0, attack: 0 };

  // Build squad player rows.
  const squadRows: SquadPlayerRow[] = finalPicks.map((p) => {
    const player = playerMap.get(p.element);
    const team = player ? teamMap.get(player.team_id) : undefined;
    return {
      playerId: p.element,
      webName: player?.web_name ?? `Player ${p.element.toString()}`,
      teamCode: team?.code ?? 0,
      teamShortName: team?.short_name ?? '???',
      position: player?.position ?? 'MID',
      squadPosition: p.position,
      isCaptain: p.is_captain,
      isViceCaptain: p.is_vice_captain,
      confidence: confidenceMap.get(p.element) ?? 0,
      status: player?.status ?? 'a',
      chanceOfPlaying: player?.chance_of_playing_next_round ?? null,
      news: player?.news ?? '',
    };
  });

  const starters = squadRows
    .filter((r) => r.squadPosition <= 11)
    .sort((a, b) => a.squadPosition - b.squadPosition);
  const bench = squadRows
    .filter((r) => r.squadPosition > 11)
    .sort((a, b) => a.squadPosition - b.squadPosition);

  const syncedAtRaw = repos.syncMeta.get('last_sync');
  const syncedAt = syncedAtRaw ? parseInt(syncedAtRaw, 10) : now;

  const data: MyTeamData = {
    managerName: `${info.player_first_name} ${info.player_last_name}`,
    teamName: info.name,
    overallRank: info.summary_overall_rank,
    overallPoints: info.summary_overall_points,
    gameweek: targetGw,
    teamConfidencePercent,
    defencePercent: toPercent(positional.defence),
    midfieldPercent: toPercent(positional.midfield),
    attackPercent: toPercent(positional.attack),
    starters,
    bench,
    syncedAt,
    preDeadlineFallback,
    freeHitBypassed,
    freeHitGameweek,
    isGw1FreeHit,
  };

  return NextResponse.json(data);
}
