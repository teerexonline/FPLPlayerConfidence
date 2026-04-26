import 'server-only';
import { notFound } from 'next/navigation';
import type { JSX } from 'react';
import Link from 'next/link';
import { getRepositories } from '@/lib/db/server';
import { playerId } from '@/lib/db';
import { PlayerHeader } from './_components/PlayerHeader';
import { ConfidenceHero } from './_components/ConfidenceHero';
import { MatchHistoryStrip } from './_components/MatchHistoryStrip';
import { BigTeamBreakdown } from './_components/BigTeamBreakdown';
import { ConfidenceChart } from '@/components/confidence/ConfidenceChart';
import type { PlayerDetailData, SnapshotPoint } from './_components/types';

export const dynamic = 'force-dynamic';

function loadPlayer(rawId: string): PlayerDetailData {
  const parsed = parseInt(rawId, 10);
  if (isNaN(parsed) || parsed <= 0) notFound();

  const repos = getRepositories();
  const player = repos.players.findById(parsed);
  if (!player) notFound();

  const team = repos.teams.findById(player.team_id);
  if (!team) notFound();

  const rawSnapshots = repos.confidenceSnapshots.listByPlayer(playerId(parsed));
  const snapshots: readonly SnapshotPoint[] = rawSnapshots.map((s) => ({
    gameweek: s.gameweek,
    confidenceAfter: s.confidence_after,
    delta: s.delta,
    reason: s.reason,
    fatigueApplied: s.fatigue_applied,
    motmCounter: s.motm_counter,
  }));

  const latest = snapshots[snapshots.length - 1];
  const confidence = latest?.confidenceAfter ?? 0;
  const latestDelta = latest?.delta ?? 0;
  const latestReason = latest?.reason ?? '';
  const latestGameweek = latest?.gameweek ?? 0;

  return {
    id: player.id,
    webName: player.web_name,
    teamCode: team.code,
    teamName: team.name,
    teamShortName: team.short_name,
    position: player.position,
    nowCost: player.now_cost,
    confidence,
    latestDelta,
    latestReason,
    latestGameweek,
    snapshots,
    status: player.status,
    chanceOfPlaying: player.chance_of_playing_next_round,
    news: player.news,
  };
}

export default async function PlayerDetailPage({
  params,
}: {
  readonly params: Promise<{ id: string }>;
}): Promise<JSX.Element> {
  const { id } = await params;
  const player = loadPlayer(id);

  return (
    <div className="bg-bg text-text min-h-screen font-sans">
      <div className="mx-auto max-w-[1280px] px-4 pb-24 sm:px-8">
        {/* Back link */}
        <div className="py-6">
          <Link
            href="/players"
            className="text-muted hover:text-text inline-flex items-center gap-1.5 text-[13px] transition-colors"
          >
            <svg width={16} height={16} viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M10 3L5 8l5 5"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Players
          </Link>
        </div>

        {/* Header — jersey + name + meta */}
        <PlayerHeader player={player} />

        {/* Confidence hero — number + slider + reason */}
        <div className="mt-12">
          <ConfidenceHero
            confidence={player.confidence}
            latestDelta={player.latestDelta}
            latestReason={player.latestReason}
            latestGameweek={player.latestGameweek}
            hasSnapshots={player.snapshots.length > 0}
          />
        </div>

        {/* Match history — horizontal scroll strip */}
        <MatchHistoryStrip snapshots={player.snapshots} />

        {/* Confidence chart — season trajectory */}
        <ConfidenceChart snapshots={player.snapshots} currentConfidence={player.confidence} />

        {/* Big-team breakdown — two stat blocks */}
        <BigTeamBreakdown snapshots={player.snapshots} />
      </div>
    </div>
  );
}
