'use client';

import { memo } from 'react';
import type { JSX } from 'react';
import { useRouter } from 'next/navigation';
import { ConfidenceTrend } from '@/components/confidence/ConfidenceTrend';
import { LivePlayerStreakIndicator } from '@/components/confidence/LivePlayerStreakIndicator';
import { PlayerStatusIndicator } from '@/components/confidence/PlayerStatusIndicator';
import { StaleDataIndicator } from '@/components/confidence/StaleDataIndicator';
import { StarButton } from '@/components/watchlist/StarButton';
import { cn } from '@/lib/utils';
import { getPlayerNameColorClass } from '@/lib/confidence/playerStatus';
import { XpPrimary } from './XpPrimary';
import type { PlayerWithConfidence } from './types';

interface PlayerCardProps {
  readonly player: PlayerWithConfidence;
}

/**
 * Mobile card layout (< sm breakpoint, 375px).
 * Line 1: jersey + name + flame (left) | xP-primary cell + status + star (right)
 * Line 2: team · position · price (left) | 5-square trend strip (right)
 * The xP-primary cell shows the projected xP large with confidence as a small
 * colored sub-line — same pattern as PlayerRow on desktop.
 */
function PlayerCardImpl({ player }: PlayerCardProps): JSX.Element {
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
    nextGwXp,
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
          <StaleDataIndicator isStale={isStale} />
          <PlayerStatusIndicator status={status} chanceOfPlaying={chanceOfPlaying} news={news} />
          <XpPrimary nextGwXp={nextGwXp} confidence={confidence} />
          <span
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <StarButton playerId={id} playerName={webName} size="sm" />
          </span>
        </div>
      </div>

      {/* Line 2: meta · price | recent-form trend strip */}
      <div role="cell" className="mt-1.5 flex items-center justify-between gap-2">
        <span className="text-muted text-[12px]">
          {teamShortName} · {position} · {price}
        </span>
        <ConfidenceTrend deltas={recentDeltas} variant="strip" />
      </div>
    </div>
  );
}

// Memoized for the same reason as PlayerRow — see that file's note.
export const PlayerCard = memo(PlayerCardImpl);
