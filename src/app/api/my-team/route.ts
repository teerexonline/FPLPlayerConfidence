import 'server-only';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { fetchEntryInfo, fetchEntryPicks } from '@/lib/fpl/api';
import { resolveSquadPicks } from '@/lib/fpl/resolveSquadPicks';
import { getRepositories } from '@/lib/db/server';
import { calculateTeamConfidence, confidenceToPercent } from '@/lib/team-confidence';
import { hotStreakAtGw } from '@/lib/confidence/hotStreak';
import { createLogger } from '@/lib/logger';
import {
  calculatePlayerXp,
  calculateTeamXp,
  type PlayerBucketAverages,
  type TeamFixture,
} from '@/lib/expected-points';
import { parseSwaps, type Swap } from '@/lib/transfer-planner';
import type {
  MyTeamApiError,
  MyTeamData,
  MyTeamViewMode,
  NextFixture,
  SquadPlayerRow,
} from '@/app/my-team/_components/types';
import type { DbFixture, FdrBucketName, Position } from '@/lib/db/types';

const logger = createLogger('api/my-team');

// Alias so call sites remain readable.
const toPercent = confidenceToPercent;

/**
 * Runs an optional read query and returns `fallback` if it throws. Used to
 * gate features that depend on tables or rows that may not exist yet
 * (e.g. before migration 0004 is applied or before the first sync populates
 * the fixtures table). The route's core response — manager info, picks,
 * confidence — must never depend on this; only auxiliary projections do.
 */
async function safeQuery<T>(promise: Promise<T>, fallback: T, label: string): Promise<T> {
  try {
    return await promise;
  } catch (err) {
    logger.warn(`degraded: ${label}`, {
      error: err instanceof Error ? err.message : String(err),
    });
    return fallback;
  }
}

function errorResponse(code: MyTeamApiError, status: number): NextResponse {
  return NextResponse.json({ error: code }, { status });
}

/**
 * GET /api/my-team?teamId={n}[&gameweek={m}]
 *
 * Loads a manager's squad. Default (no gameweek param): resolves the current GW
 * with deadline-fallback and Free Hit detection. With gameweek={m}: serves that
 * specific historical GW from cache (no fallback logic applied).
 *
 * Fetch strategy (default mode):
 *  1. Try currentGw — a 200 means the deadline has passed; use those picks.
 *  2. A 404 means deadline not yet passed; fall back to currentGw-1 (preDeadlineFallback=true).
 *  3. Both GWs 404, or currentGw < 1 → PRE_SEASON (503).
 *  4. Free Hit detection: if the resolved GW has FH chip, step back one more GW.
 *  5. Upsert squad to manager_squads cache.
 *  6. Join picks against confidence_snapshots for that GW.
 *  7. Run calculateTeamConfidence.
 *  8. Return MyTeamData JSON with preDeadlineFallback, FH metadata, currentGameweek,
 *     and availableGameweeks.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  // Route handler query parsing — URL.searchParams is synchronous here.
  // (The async searchParams pattern applies only to page/layout props in Next.js 15+,
  // not to route handler request objects.)
  const query = new URL(request.url).searchParams;
  const teamIdRaw = query.get('teamId');
  const gameweekRaw = query.get('gameweek');
  const swapRaw = query.get('swap');

  if (!teamIdRaw || !/^\d+$/.test(teamIdRaw)) {
    logger.warn('GET /api/my-team: invalid teamId param', { teamIdRaw });
    return errorResponse('INVALID_TEAM_ID', 400);
  }

  // Optional GW override — when present, skip deadline/FH resolution.
  const gwOverride =
    gameweekRaw !== null && /^\d+$/.test(gameweekRaw) ? parseInt(gameweekRaw, 10) : null;

  // Optional ?swap=outId:inId,… — staged transfers for the planner. Only honoured
  // when the viewed GW is in the future (projected mode); ignored otherwise.
  const swapsParse = parseSwaps(swapRaw);
  if (!swapsParse.ok) {
    logger.warn('GET /api/my-team: invalid swap param', { swapRaw, error: swapsParse.error });
    return errorResponse('INVALID_TEAM_ID', 400);
  }
  const requestedSwaps: readonly Swap[] = swapsParse.value;

  const teamId = parseInt(teamIdRaw, 10);
  logger.info('GET /api/my-team: fetching squad', {
    teamId,
    gwOverride,
    swapCount: requestedSwaps.length,
  });
  const repos = getRepositories();

  // Resolve target GW. We use currentGW − 1 (Option A per API.md §8 note).
  // Fall back to the max GW in confidence_snapshots when sync_meta hasn't been
  // written yet (legacy DBs synced before this key was added).
  const gwRaw = await repos.syncMeta.get('current_gameweek');
  let currentGw = gwRaw ? parseInt(gwRaw, 10) : NaN;

  if (isNaN(currentGw)) {
    const allSnapshots = await repos.confidenceSnapshots.currentForAllPlayers();
    const maxGw = allSnapshots.reduce((m, { snapshot }) => Math.max(m, snapshot.gameweek), 0);
    if (maxGw > 0) currentGw = maxGw;
  }

  if (isNaN(currentGw) || currentGw < 1) {
    logger.error('GET /api/my-team: cannot resolve current_gameweek', {});
    return errorResponse('NO_GAMEWEEK_DATA', 503);
  }

  // Start entry info fetch immediately so it overlaps with the first picks fetch.
  const infoPromise = fetchEntryInfo(teamId);

  // ── Determine view mode ────────────────────────────────────────────────────
  // `projected` = viewing a future GW (FPL hasn't generated picks yet — we use
  //               the latest cached squad as the planning baseline).
  // `historical` = viewing a past or current GW (existing behavior).
  const viewMode: MyTeamViewMode =
    gwOverride !== null && gwOverride > currentGw ? 'projected' : 'historical';
  const appliedSwaps = viewMode === 'projected' ? requestedSwaps : [];

  // ── Historical GW override path ────────────────────────────────────────────
  // When the user selects a specific past GW from the scrubber, skip the
  // deadline-fallback and Free Hit resolution — serve cached picks directly.
  let finalPicks: readonly import('@/lib/fpl/types').EntryPick[];
  let targetGw: number;
  let preDeadlineFallback: boolean;
  let freeHitBypassed: boolean;
  let freeHitGameweek: number | null;
  let isGw1FreeHit: boolean;

  if (viewMode === 'projected' && gwOverride !== null) {
    // Future GW: FPL has no picks yet. Use the latest cached squad as the
    // planning baseline (the user's current real lineup).
    const latestCachedGw = await repos.managerSquads.latestGameweekForTeam(teamId);
    if (latestCachedGw === null) {
      logger.warn('GET /api/my-team: projected mode but no cached squad', { teamId });
      return errorResponse('NO_GAMEWEEK_DATA', 503);
    }
    const cached = await repos.managerSquads.listByTeamAndGameweek(teamId, latestCachedGw);
    finalPicks = cached.map((p) => ({
      element: p.player_id,
      position: p.squad_position,
      is_captain: p.is_captain,
      is_vice_captain: p.is_vice_captain,
    }));
    targetGw = gwOverride;
    preDeadlineFallback = false;
    freeHitBypassed = false;
    freeHitGameweek = null;
    isGw1FreeHit = false;
  } else if (gwOverride !== null) {
    const cached = await repos.managerSquads.listByTeamAndGameweek(teamId, gwOverride);
    if (cached.length > 0) {
      finalPicks = cached.map((p) => ({
        element: p.player_id,
        position: p.squad_position,
        is_captain: p.is_captain,
        is_vice_captain: p.is_vice_captain,
      }));
    } else {
      // Cache miss — fetch from FPL API and persist.
      const fetchResult = await fetchEntryPicks(teamId, gwOverride);
      if (!fetchResult.ok) {
        logger.warn('GET /api/my-team: historical GW fetch failed', {
          teamId,
          gwOverride,
          error: fetchResult.error.type,
        });
        if (fetchResult.error.type === 'not_found') return errorResponse('NOT_FOUND', 404);
        if (fetchResult.error.type === 'network_error') return errorResponse('NETWORK_ERROR', 502);
        return errorResponse('SCHEMA_ERROR', 502);
      }
      finalPicks = fetchResult.value.picks;
      await repos.managerSquads.upsertMany(
        finalPicks.map((p) => ({
          team_id: teamId,
          gameweek: gwOverride,
          player_id: p.element,
          squad_position: p.position,
          is_captain: p.is_captain,
          is_vice_captain: p.is_vice_captain,
          fetched_at: Date.now(),
        })),
      );
    }
    targetGw = gwOverride;
    preDeadlineFallback = false;
    freeHitBypassed = false;
    freeHitGameweek = null;
    isGw1FreeHit = false;
  } else {
    // ── Default path: deadline-fallback + Free Hit detection ────────────────
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

    ({
      picks: finalPicks,
      gameweek: targetGw,
      preDeadlineFallback,
      freeHitBypassed,
      freeHitGameweek,
      isGw1FreeHit,
    } = squadResult.value);
  }

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

  // Upsert the squad to the manager_squads cache table (default path only;
  // the historical path upserts inside its cache-miss branch above).
  if (gwOverride === null) {
    await repos.managerSquads.upsertMany(
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
  }

  // Build lookups.
  const [allPlayers, allTeams] = await Promise.all([
    repos.players.listAll(),
    repos.teams.listAll(),
  ]);
  const playerMap = new Map(allPlayers.map((p) => [p.id, p]));
  const teamMap = new Map(allTeams.map((t) => [t.id, t]));

  // ── Apply staged swaps (projected mode only) ─────────────────────────────
  // Validation: outId must be in the squad; inId must NOT be; positions must match.
  // Invalid swaps are silently dropped — the UI never enables them, so this is
  // a defense-in-depth check, not a user-facing error path.
  if (viewMode === 'projected' && appliedSwaps.length > 0) {
    const swapped: import('@/lib/fpl/types').EntryPick[] = [...finalPicks];
    const currentIds = new Set(finalPicks.map((p) => p.element));
    for (const { outId, inId } of appliedSwaps) {
      const outIdx = swapped.findIndex((p) => p.element === outId);
      if (outIdx === -1) continue;
      if (currentIds.has(inId)) continue;
      const outPlayer = playerMap.get(outId);
      const inPlayer = playerMap.get(inId);
      if (!outPlayer || !inPlayer) continue;
      if (outPlayer.position !== inPlayer.position) continue;

      const before = swapped[outIdx];
      if (before === undefined) continue;
      swapped[outIdx] = {
        element: inId,
        position: before.position,
        is_captain: before.is_captain,
        is_vice_captain: before.is_vice_captain,
      };
      currentIds.delete(outId);
      currentIds.add(inId);
    }
    finalPicks = swapped;
  }
  const swappedInIds = new Set(appliedSwaps.map((s) => s.inId));

  // Resolve confidence at the target GW.
  // Historical mode: look up snapshots exactly at targetGw (one batch query).
  // Default mode: use the most recent snapshot per player (same as before).
  const confidenceMap = new Map<number, number>();
  if (gwOverride !== null) {
    // Use latestSnapshotsAtOrBeforeGameweek rather than snapshotsAtGameweek so
    // players who didn't feature in a given GW still carry their most recent
    // confidence forward. snapshotsAtGameweek(N) returns nothing for players who
    // skipped N, causing them to fall back to confidence=0 (renders as 50%).
    const historicalSnaps =
      await repos.confidenceSnapshots.latestSnapshotsAtOrBeforeGameweek(targetGw);
    for (const snap of historicalSnaps) {
      confidenceMap.set(snap.player_id, snap.confidence_after);
    }
    // Players with no snapshot at or before this GW (e.g. brand-new signings) keep 0.
  } else {
    for (const p of finalPicks) {
      const snap = await repos.confidenceSnapshots.currentByPlayer(
        p.element as Parameters<typeof repos.confidenceSnapshots.currentByPlayer>[0],
      );
      confidenceMap.set(p.element, snap?.confidence_after ?? 0);
    }
  }

  const playerIds = finalPicks.map((p) => p.element);

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

  // Hot streak: look back up to 2 GWs from the *viewed* GW (not the live GW)
  // so the flame reflects what was true at GW N, not at the current season GW.
  const minBoostGw = Math.max(1, targetGw - 2);
  const boostMap = await repos.confidenceSnapshots.recentBoostForAllPlayers(minBoostGw, targetGw);

  // ── Fixtures: next-3 strip below jersey + xP projection input ────────────
  // In historical mode the strip shows fixtures *after* the viewed GW (the
  // viewed GW is already played). In projected mode it includes the viewed
  // GW so DGWs and the gameweek being planned are visible — otherwise the
  // strip omits the very fixtures the xP number is derived from.
  const nextStripFromGw = viewMode === 'projected' ? targetGw : targetGw + 1;
  const nextStripWindowRows = await safeQuery<readonly DbFixture[]>(
    repos.fixtures.listInGameweekRange(nextStripFromGw, nextStripFromGw + 9),
    [],
    'fixtures.listInGameweekRange',
  );
  const nextFixturesByTeam = new Map<number, NextFixture[]>();
  for (const f of nextStripWindowRows) {
    const list = nextFixturesByTeam.get(f.team_id) ?? [];
    if (list.length < 3) {
      const opponent = teamMap.get(f.opponent_team_id);
      list.push({
        gameweek: f.gameweek,
        opponentTeamShortName: opponent?.short_name ?? '???',
        isHome: f.is_home,
        fdr: f.fdr,
        kickoffTime: f.kickoff_time,
      });
      nextFixturesByTeam.set(f.team_id, list);
    }
  }

  // ── Projected xP: only computed in `projected` mode ──────────────────────
  // Pull fixtures for the *viewed* GW (per team) and per-player FDR averages,
  // then build per-row xP using the existing pure calculator.
  const projectedXpByPlayer = new Map<number, number>();
  let projectedTeamXp: number | null = null;

  if (viewMode === 'projected') {
    const viewedGwFixtures = await safeQuery<readonly DbFixture[]>(
      repos.fixtures.listForGameweek(targetGw),
      [],
      'fixtures.listForGameweek',
    );
    const fixturesByTeam = new Map<number, DbFixture[]>();
    for (const f of viewedGwFixtures) {
      const list = fixturesByTeam.get(f.team_id) ?? [];
      list.push(f);
      fixturesByTeam.set(f.team_id, list);
    }

    const allBucketAverages = await safeQuery<
      ReadonlyMap<number, ReadonlyMap<FdrBucketName, number>>
    >(
      repos.playerFdrAverages.averagesForPlayers(finalPicks.map((p) => p.element)),
      new Map<number, ReadonlyMap<FdrBucketName, number>>(),
      'playerFdrAverages.averagesForPlayers',
    );

    const xpStarters: {
      playerId: number;
      squadPosition: number;
      confidencePct: number;
      averages: PlayerBucketAverages;
      fixtures: readonly TeamFixture[];
    }[] = [];

    for (const p of finalPicks) {
      const player = playerMap.get(p.element);
      if (!player) {
        projectedXpByPlayer.set(p.element, 0);
        continue;
      }

      const teamFixtureRows = fixturesByTeam.get(player.team_id) ?? [];
      const teamFixtures: TeamFixture[] = teamFixtureRows.map((f) => ({
        gameweek: f.gameweek,
        opponentTeamId: f.opponent_team_id,
        isHome: f.is_home,
        fdr: f.fdr,
      }));

      const buckets = allBucketAverages.get(p.element) ?? new Map<FdrBucketName, number>();
      const averages: PlayerBucketAverages = {
        low: buckets.get('LOW') ?? null,
        mid: buckets.get('MID') ?? null,
        high: buckets.get('HIGH') ?? null,
      };

      const confidencePct = confidenceToPercent(confidenceMap.get(p.element) ?? 0);

      const playerXp = calculatePlayerXp({
        playerId: p.element,
        confidencePct,
        averages,
        fixtures: teamFixtures,
      });
      projectedXpByPlayer.set(p.element, playerXp.xp);

      if (p.position <= 11) {
        xpStarters.push({
          playerId: p.element,
          squadPosition: p.position,
          confidencePct,
          averages,
          fixtures: teamFixtures,
        });
      }
    }

    const teamResult = calculateTeamXp({ picks: xpStarters });
    projectedTeamXp = teamResult.teamXp;
  }

  // Build squad player rows.
  const squadRows: SquadPlayerRow[] = finalPicks.map((p) => {
    const player = playerMap.get(p.element);
    const team = player ? teamMap.get(player.team_id) : undefined;
    const boost = boostMap.get(p.element);
    const hotStreak =
      boost !== undefined ? hotStreakAtGw(boost.boostGw, targetGw, boost.boostDelta) : null;
    const nextFixtures = team ? (nextFixturesByTeam.get(team.id) ?? []) : [];
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
      hotStreak,
      nextFixtures,
      projectedXp: viewMode === 'projected' ? (projectedXpByPlayer.get(p.element) ?? 0) : null,
      isSwappedIn: swappedInIds.has(p.element),
    };
  });

  const starters = squadRows
    .filter((r) => r.squadPosition <= 11)
    .sort((a, b) => a.squadPosition - b.squadPosition);
  const bench = squadRows
    .filter((r) => r.squadPosition > 11)
    .sort((a, b) => a.squadPosition - b.squadPosition);

  const [syncedAtRaw, availableGameweeks, lastSeasonGameweekRaw] = await Promise.all([
    repos.syncMeta.get('last_sync'),
    repos.managerSquads.listGameweeksForTeam(teamId),
    safeQuery<number | null>(repos.fixtures.latestGameweek(), null, 'fixtures.latestGameweek'),
  ]);
  const syncedAt = syncedAtRaw ? parseInt(syncedAtRaw, 10) : now;
  // FPL season is always 38 GWs. Default to 38 when the fixtures table hasn't been
  // populated yet (pre-migration or first-sync), so the forward scrubber is usable
  // immediately. Once fixtures sync, the real upper bound takes over.
  const FPL_FINAL_GW = 38;
  const lastSeasonGameweek = lastSeasonGameweekRaw ?? Math.max(currentGw, FPL_FINAL_GW);

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
    currentGameweek: currentGw,
    availableGameweeks,
    lastSeasonGameweek,
    viewMode,
    projectedTeamXp,
    appliedSwaps,
  };

  return NextResponse.json(data);
}
