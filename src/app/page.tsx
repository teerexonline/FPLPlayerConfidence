import 'server-only';
import type { JSX } from 'react';
import { getRepositories } from '@/lib/db/server';
import { SYSTEM_USER_ID } from '@/lib/db/constants';
import { buildMatchBriefs, computeHotStreak } from '@/lib/confidence/hotStreak';
import { BiggestMoversCard } from './_components/BiggestMoversCard';
import { WatchlistCard } from './_components/WatchlistCard';
import { LeaderboardPreview } from './_components/LeaderboardPreview';
import { TeamConfidenceHero } from './_components/TeamConfidenceHero';
import { DashboardEmptyState } from './_components/DashboardEmptyState';
import { selectRisers, selectFallers } from './_components/moversFilter';
import type { DashboardData, DashboardPlayer } from './_components/types';

export const dynamic = 'force-dynamic';

interface DashboardResult {
  data: DashboardData;
  watchlistPlayers: readonly DashboardPlayer[];
}

async function loadDashboard(): Promise<DashboardResult> {
  const repos = getRepositories();

  const [allPlayers, allTeams, currentSnapshots, last5, watchlistIdList] = await Promise.all([
    repos.players.listAll(),
    repos.teams.listAll(),
    repos.confidenceSnapshots.currentForAllPlayers(),
    repos.confidenceSnapshots.listLast5ForAllPlayers(),
    repos.watchlist.findByUser(SYSTEM_USER_ID),
  ]);

  const watchlistIds = new Set(watchlistIdList);

  if (currentSnapshots.length === 0) {
    const emptyLeaderboard = { all: [], GK: [], DEF: [], MID: [], FWD: [] };
    return {
      data: {
        currentGameweek: 0,
        risers: [],
        fallers: [],
        leaderboard: emptyLeaderboard,
        isEmpty: true,
      },
      watchlistPlayers: [],
    };
  }

  const playerMap = new Map(allPlayers.map((p) => [p.id, p]));
  const teamMap = new Map(allTeams.map((t) => [t.id, t]));
  const deltaMap = new Map(last5.map(({ playerId, deltas }) => [Number(playerId), deltas]));

  const maxGw = currentSnapshots.reduce((m, { snapshot }) => Math.max(m, snapshot.gameweek), 0);

  const gwRaw = await repos.syncMeta.get('current_gameweek');
  const parsedGw = gwRaw ? parseInt(gwRaw, 10) : NaN;
  const currentGameweek = !isNaN(parsedGw) ? parsedGw : maxGw;

  // Stale indicator: count snapshots in the last 3 GW window per player.
  const minRecentGw = Math.max(1, currentGameweek - 2);
  const recentAppearancesMap =
    await repos.confidenceSnapshots.recentAppearancesForAllPlayers(minRecentGw);

  // Hot streak: fetch recent snapshots (with reason) so buildMatchBriefs can expand DGW
  // rows into per-sub-match entries. computeHotStreak then counts matches, not GWs, which
  // correctly handles DGW boosts where the combined delta ≠ any single sub-match delta.
  const minStreakGw = Math.max(1, currentGameweek - 2);
  const recentSnapshotsMap =
    await repos.confidenceSnapshots.listRecentSnapshotsForAllPlayers(minStreakGw);

  const players: DashboardPlayer[] = currentSnapshots.flatMap(({ playerId: pid, snapshot }) => {
    const numericId = Number(pid);
    const player = playerMap.get(numericId);
    const team = player ? teamMap.get(player.team_id) : undefined;
    if (!player || !team) return [];

    const recentSnaps = recentSnapshotsMap.get(numericId) ?? [];
    const hotStreak = computeHotStreak(buildMatchBriefs(recentSnaps));

    return [
      {
        id: numericId,
        webName: player.web_name,
        teamCode: team.code,
        teamShortName: team.short_name,
        position: player.position,
        confidence: snapshot.confidence_after,
        latestDelta: snapshot.delta,
        latestGameweek: snapshot.gameweek,
        recentDeltas: deltaMap.get(numericId) ?? [],
        status: player.status,
        chanceOfPlaying: player.chance_of_playing_next_round,
        news: player.news,
        recentAppearances: recentAppearancesMap.get(numericId) ?? 0,
        hotStreak,
        totalPoints: player.total_points,
      },
    ];
  });

  // Sort variants — all tracked players are now shown; stale ones display a flag.
  const byConfidenceDesc = [...players].sort((a, b) => {
    const primary = b.confidence - a.confidence;
    return primary !== 0 ? primary : b.totalPoints - a.totalPoints;
  });

  const watchlistPlayers = players.filter((p) => watchlistIds.has(p.id));

  return {
    data: {
      currentGameweek,
      risers: selectRisers(players, 3),
      fallers: selectFallers(players, 3),
      leaderboard: {
        all: byConfidenceDesc.slice(0, 10),
        GK: byConfidenceDesc.filter((p) => p.position === 'GK').slice(0, 10),
        DEF: byConfidenceDesc.filter((p) => p.position === 'DEF').slice(0, 10),
        MID: byConfidenceDesc.filter((p) => p.position === 'MID').slice(0, 10),
        FWD: byConfidenceDesc.filter((p) => p.position === 'FWD').slice(0, 10),
      },
      isEmpty: false,
    },
    watchlistPlayers,
  };
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<JSX.Element> {
  const resolved = await searchParams;
  const { data, watchlistPlayers } = await loadDashboard();

  const rawTab = resolved['leaderboard'];
  const initialTab = typeof rawTab === 'string' ? rawTab : 'all';

  if (data.isEmpty) {
    return (
      <main className="bg-bg text-text min-h-screen font-sans">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-8">
          <DashboardEmptyState />
        </div>
      </main>
    );
  }

  return (
    <main className="bg-bg text-text min-h-screen font-sans">
      <div className="mx-auto max-w-[1280px] px-4 pb-24 sm:px-8">
        {/* Page header */}
        <div className="pt-10 pb-8">
          <h1 className="text-text text-[32px] leading-tight font-semibold tracking-[-0.01em]">
            Dashboard
          </h1>
          {data.currentGameweek > 0 && (
            <p className="text-muted mt-1 font-sans text-[14px]">
              GW{data.currentGameweek.toString()} · confidence at a glance
            </p>
          )}
        </div>

        {/* Hero strip — Risers, Fallers, Watchlist, My Team */}
        <section aria-label="Hero overview" className="mb-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <BiggestMoversCard
              title="Biggest Risers"
              players={data.risers}
              variant="risers"
              ariaLabel="Biggest confidence risers this gameweek"
              viewAllHref="/players?sort=delta&order=desc&onlyEligible=true"
            />
            <BiggestMoversCard
              title="Biggest Fallers"
              players={data.fallers}
              variant="fallers"
              ariaLabel="Biggest confidence fallers this gameweek"
              viewAllHref="/players?sort=delta&order=asc&onlyEligible=true"
            />
            <WatchlistCard players={watchlistPlayers} />
            <TeamConfidenceHero />
          </div>
        </section>

        {/* Leaderboard */}
        <LeaderboardPreview leaderboard={data.leaderboard} initialTab={initialTab} />
      </div>
    </main>
  );
}
