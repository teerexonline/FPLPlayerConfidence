import 'server-only';
import type { JSX } from 'react';

// DB reads happen at request time — force dynamic rendering.
export const dynamic = 'force-dynamic';
import { getRepositories } from '@/lib/db/server';
import { teamId as brandTeamId } from '@/lib/db';
import { buildLeagueData, predict } from '@/lib/probability';
import type { PlayerInput } from '@/lib/probability';
import { PlayersShell } from './_components/PlayersShell';
import type { PlayerWithConfidence } from './_components/types';

// TODO(v2/Step-12): Add a "Show inactive" toggle to this page so users can optionally
// filter out stale players (>3 GWs without a snapshot). The dashboard already applies
// this filter automatically, but the players list is intentionally a complete reference.
function loadPlayers(): readonly PlayerWithConfidence[] {
  const repos = getRepositories();

  const allPlayers = repos.players.listAll();
  const allTeams = repos.teams.listAll();
  const currentSnapshots = repos.confidenceSnapshots.currentForAllPlayers();
  const last5 = repos.confidenceSnapshots.listLast5ForAllPlayers();

  if (currentSnapshots.length === 0) return [];

  const playerMap = new Map(allPlayers.map((p) => [p.id, p]));
  const teamMap = new Map(allTeams.map((t) => [t.id, t]));
  const deltaMap = new Map(last5.map(({ playerId, deltas }) => [playerId, deltas]));

  const maxGw = currentSnapshots.reduce((m, s) => Math.max(m, s.snapshot.gameweek), 0);

  const gwRaw = repos.syncMeta.get('current_gameweek');
  const parsedGw = gwRaw ? parseInt(gwRaw, 10) : NaN;
  const currentGameweek = !isNaN(parsedGw) ? parsedGw : maxGw;
  const minRecentGw = Math.max(1, currentGameweek - 2);
  const recentAppearancesMap =
    repos.confidenceSnapshots.recentAppearancesForAllPlayers(minRecentGw);

  // Build probability predictor inputs from stored ICT stats
  const playerInputs: PlayerInput[] = allPlayers
    .filter((p) => p.minutes > 0)
    .map((p) => ({
      id: p.id,
      position: p.position,
      minutes: p.minutes,
      influence: p.influence,
      creativity: p.creativity,
      threat: p.threat,
    }));

  const playerInputById = new Map(playerInputs.map((pi) => [pi.id, pi]));
  const leagueData = playerInputs.length > 0 ? buildLeagueData(playerInputs) : null;

  // Pre-compute predictions for all players that have ICT data
  const predictionMap = new Map<number, { pGoal: number; pAssist: number }>();
  if (leagueData) {
    for (const p of allPlayers) {
      if (p.minutes === 0) continue;
      const pi = playerInputById.get(p.id);
      if (!pi) continue;
      const result = predict(
        p.id,
        pi,
        {
          playerTeamFdr: p.next_fixture_fdr,
          opponentTeamFdr: 3,
          expectedMinutes: 90,
        },
        leagueData,
      );
      predictionMap.set(p.id, { pGoal: result.pGoal, pAssist: result.pAssist });
    }
  }

  return currentSnapshots.flatMap(({ playerId: pid, snapshot }) => {
    const player = playerMap.get(pid);
    const team = player ? teamMap.get(player.team_id) : undefined;
    if (!player || !team) return [];

    const prediction = predictionMap.get(pid);

    return [
      {
        id: pid,
        webName: player.web_name,
        teamId: brandTeamId(player.team_id),
        teamCode: team.code,
        teamShortName: team.short_name,
        position: player.position,
        nowCost: player.now_cost,
        confidence: snapshot.confidence_after,
        recentDeltas: deltaMap.get(pid) ?? [],
        gameweek: maxGw,
        status: player.status,
        chanceOfPlaying: player.chance_of_playing_next_round,
        news: player.news,
        recentAppearances: recentAppearancesMap.get(pid) ?? 0,
        pGoal: prediction?.pGoal ?? 0,
        pAssist: prediction?.pAssist ?? 0,
      },
    ];
  });
}

export default function PlayersPage(): JSX.Element {
  const players = loadPlayers();

  return (
    <div className="bg-bg text-text min-h-screen font-sans">
      <div className="mx-auto max-w-[1280px]">
        <header className="border-border border-b px-8 py-8">
          <h1 className="text-text text-[32px] leading-tight font-semibold tracking-[-0.01em]">
            Players
          </h1>
          <p className="text-muted mt-1 text-[14px]">
            {players.length > 0
              ? `${players.length.toString()} players · FPL 2024/25`
              : 'FPL 2024/25'}
          </p>
        </header>

        <PlayersShell players={players} />
      </div>
    </div>
  );
}
