'use client';

import type { JSX } from 'react';
import { useRouter } from 'next/navigation';
import { ConfidenceNumber } from '@/components/confidence/ConfidenceNumber';
import { ConfidenceTrend } from '@/components/confidence/ConfidenceTrend';
import { LivePlayerStreakIndicator } from '@/components/confidence/LivePlayerStreakIndicator';
import { PlayerStatusIndicator } from '@/components/confidence/PlayerStatusIndicator';
import { StaleDataIndicator } from '@/components/confidence/StaleDataIndicator';
import { StarButton } from '@/components/watchlist/StarButton';
import { cn } from '@/lib/utils';
import { getPlayerNameColorClass } from '@/lib/confidence/playerStatus';
import type { PlayerWithConfidence } from './types';

interface PlayerCardProps {
  readonly player: PlayerWithConfidence;
}

/**
 * Mobile card layout (< sm breakpoint, 375px).
 * Line 1: player name (left) + active metric (right).
 * Line 2: team · position · price (left) + 5-square strip (right).
 * ~80px height; reuses same hover pattern as PlayerRow.
 */
export function PlayerCard({ player }: PlayerCardProps): JSX.Element {
  const {
    id,
    webName,
    teamCode,
    teamShortName,
    position,
    nowCost,
    confidence,
    recentDeltas,
    status,
    chanceOfPlaying,
    news,
    isStale,
    hotStreak,
  } = player;
  const router = useRouter();
  const price = `£${(nowCost / 10).toFixed(1)}m`;

  function handleClick(): void {
    router.push(`/players/${id.toString()}`);
  }

  return (
    <div
      role="row"
      onClick={handleClick}
      className="border-border hover:border-l-accent hover:bg-bg relative cursor-pointer border-b px-4 py-3 last:border-0 hover:border-l-2"
    >
      {/* Line 1: jersey + name | metric + indicators — role="cell" satisfies aria-required-children */}
      <div role="cell" className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/jerseys/${teamCode.toString()}`}
            alt=""
            aria-hidden="true"
            width={28}
            height={36}
            className="h-7 w-7 shrink-0 object-contain"
          />
          <span
            className={cn(
              'min-w-0 truncate text-[15px] leading-tight font-semibold',
              getPlayerNameColorClass(status, isStale),
            )}
          >
            {webName}
          </span>
          <LivePlayerStreakIndicator
            hotStreak={hotStreak}
            size="sm"
            status={status}
            isStale={isStale}
          />
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <ConfidenceNumber value={confidence} mode="c" size="md" animated={false} />
          <StaleDataIndicator isStale={isStale} />
          <PlayerStatusIndicator status={status} chanceOfPlaying={chanceOfPlaying} news={news} />
          <span
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <StarButton playerId={id} playerName={webName} size="sm" />
          </span>
        </div>
      </div>

      {/* Line 2: meta | strip */}
      <div role="cell" className="mt-1.5 flex items-center justify-between">
        <span className="text-muted text-[12px]">
          {teamShortName} · {position} · {price}
        </span>
        <ConfidenceTrend deltas={recentDeltas} variant="strip" />
      </div>
    </div>
  );
}
