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
import { isValidFormation } from '@/app/my-team/_components/computeFormation';
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
  const captainRaw = query.get('captain');

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

  // Optional ?captain=playerId — staged captain override for projected planning.
  // Honoured only in projected mode; the captain's xP contributes 2× to team xP.
  const captainOverride =
    captainRaw !== null && /^\d+$/.test(captainRaw) ? parseInt(captainRaw, 10) : null;

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
  // A swap pair `outId:inId` is interpreted in one of two ways depending on
  // whether `inId` is already in the squad:
  //   - **Substitution**: inId is in the squad → swap the squad_position of
  //     `outId` and `inId`. Used to promote a bench player above a starter
  //     (or vice versa). No transfer cost; squad membership unchanged.
  //   - **Transfer**: inId is NOT in the squad → replace `outId` with `inId`.
  //     Squad membership changes; uses one transfer in real FPL.
  // Both flavours require positions to match (FPL rule: same-position only).
  // Invalid pairs are silently dropped — the UI never enables them.
  const swappedInIds = new Set<number>();
  if (viewMode === 'projected' && appliedSwaps.length > 0) {
    const swapped: import('@/lib/fpl/types').EntryPick[] = [...finalPicks];
    const currentIds = new Set(finalPicks.map((p) => p.element));

    for (const { outId, inId } of appliedSwaps) {
      const outIdx = swapped.findIndex((p) => p.element === outId);
      if (outIdx === -1) continue;
      const outPlayer = playerMap.get(outId);
      const inPlayer = playerMap.get(inId);
      if (!outPlayer || !inPlayer) continue;
      const out = swapped[outIdx];
      if (out === undefined) continue;

      if (currentIds.has(inId)) {
        // ── Substitution: swap squad_position values between the two picks.
        // FPL allows cross-position outfield substitutions as long as the
        // resulting starting XI is still a legal formation
        // (1 GK / 3-5 DEF / 2-5 MID / 1-3 FWD). GK can only swap with GK.
        const inIdx = swapped.findIndex((p) => p.element === inId);
        if (inIdx === -1) continue;
        const inn = swapped[inIdx];
        if (inn === undefined) continue;
        // GK rule: a GK swap is only valid against another GK.
        if (
          (outPlayer.position === 'GK' || inPlayer.position === 'GK') &&
          outPlayer.position !== inPlayer.position
        ) {
          continue;
        }
        // Project the resulting starter positions and validate the formation.
        // After the swap, `out` takes `inn`'s squad_position and vice versa.
        const projectedStarterPositions: Position[] = swapped.flatMap((p) => {
          const newSquadPos =
            p.element === out.element
              ? inn.position
              : p.element === inn.element
                ? out.position
                : p.position;
          if (newSquadPos > 11) return [];
          const info = playerMap.get(p.element);
          return info ? [info.position] : [];
        });
        if (!isValidFormation(projectedStarterPositions)) continue;

        swapped[outIdx] = { ...out, position: inn.position };
        swapped[inIdx] = { ...inn, position: out.position };
        // For substitutions, the "in" player is the one moving into the
        // starting XI — flag it so the IN badge renders on the correct row.
        if (inn.position > 11 && out.position <= 11) swappedInIds.add(inId);
        else if (out.position > 11 && inn.position <= 11) swappedInIds.add(outId);
      } else {
        // ── Transfer: replace outId with inId; preserve squad_position.
        // FPL squad totals (2 GK / 5 DEF / 5 MID / 3 FWD) are immutable, so a
        // single transfer must always replace like-for-like position.
        if (outPlayer.position !== inPlayer.position) continue;
        swapped[outIdx] = {
          element: inId,
          position: out.position,
          is_captain: out.is_captain,
          is_vice_captain: out.is_vice_captain,
        };
        currentIds.delete(outId);
        currentIds.add(inId);
        swappedInIds.add(inId);
      }
    }
    finalPicks = swapped;
  }

  // ── Apply captain override (projected mode only) ─────────────────────────
  // Validation: the override must be a starter in the (possibly swap-mutated)
  // squad. Otherwise silently fall through to FPL's captain choice.
  if (viewMode === 'projected' && captainOverride !== null) {
    const captainIsStarter = finalPicks.some(
      (p) => p.element === captainOverride && p.position <= 11,
    );
    if (captainIsStarter) {
      finalPicks = finalPicks.map((p) => ({
        ...p,
        is_captain: p.element === captainOverride,
        // Vice stays as-is — the user only picks the captain in this UI.
      }));
    }
  }

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

  // ── xP: computed for ALL modes (My Team is xP-first regardless of GW) ────
  // Pull fixtures for the *viewed* GW (per team) and per-player FDR averages,
  // then build per-row xP using the existing pure calculator. The hero shows
  // team xP for the viewed GW whether it's historical, current, or projected.
  const projectedXpByPlayer = new Map<number, number>();
  let projectedTeamXp: number | null = null;

  {
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
    // Captain's xP counts twice (FPL captain rule). The pure calculator stays
    // captain-agnostic; we apply the bonus here so a captain change just
    // re-shapes the response without re-running the per-player projections.
    const captain = finalPicks.find((p) => p.is_captain && p.position <= 11);
    const captainBonus = captain ? (projectedXpByPlayer.get(captain.element) ?? 0) : 0;
    projectedTeamXp = Math.round((teamResult.teamXp + captainBonus) * 100) / 100;
  }

  // Per-line xP breakdown (sum starters' xP by FPL position). Used by the
  // positional cards on the My Team page now that the page is xP-first.
  // Captain's xP is doubled here too so the per-line totals add up to team xP.
  let defenceXp = 0;
  let midfieldXp = 0;
  let attackXp = 0;
  for (const p of finalPicks) {
    if (p.position > 11) continue;
    const baseXp = projectedXpByPlayer.get(p.element) ?? 0;
    const xp = p.is_captain ? baseXp * 2 : baseXp;
    const player = playerMap.get(p.element);
    const pos = player?.position ?? 'MID';
    if (pos === 'GK' || pos === 'DEF') defenceXp += xp;
    else if (pos === 'MID') midfieldXp += xp;
    else attackXp += xp;
  }
  defenceXp = Math.round(defenceXp * 100) / 100;
  midfieldXp = Math.round(midfieldXp * 100) / 100;
  attackXp = Math.round(attackXp * 100) / 100;

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
      projectedXp: projectedXpByPlayer.get(p.element) ?? 0,
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
    defenceXp,
    midfieldXp,
    attackXp,
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
