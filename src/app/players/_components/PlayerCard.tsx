'use client';

import type { JSX } from 'react';
import { ConfidenceNumber } from '@/components/confidence/ConfidenceNumber';
import { ConfidenceTrend } from '@/components/confidence/ConfidenceTrend';
import { HotStreakIndicator } from '@/components/confidence/HotStreakIndicator';
import { PlayerStatusIndicator } from '@/components/confidence/PlayerStatusIndicator';
import { StaleDataIndicator } from '@/components/confidence/StaleDataIndicator';
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
    webName,
    teamShortName,
    position,
    nowCost,
    confidence,
    recentDeltas,
    status,
    chanceOfPlaying,
    news,
    recentAppearances,
    hotStreakLevel,
    gameweek,
  } = player;
  const price = `£${(nowCost / 10).toFixed(1)}m`;

  return (
    <div
      role="row"
      className="border-border hover:border-l-accent hover:bg-bg relative border-b px-4 py-3 last:border-0 hover:border-l-2"
    >
      {/* Line 1: name | metric + indicators — role="cell" satisfies aria-required-children */}
      <div role="cell" className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-1">
          <span className="text-text min-w-0 truncate text-[15px] leading-tight font-semibold">
            {webName}
          </span>
          <HotStreakIndicator level={hotStreakLevel} size="sm" currentGW={gameweek} />
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <ConfidenceNumber value={confidence} mode="c" size="md" animated={false} />
          <StaleDataIndicator recentAppearances={recentAppearances} />
          <PlayerStatusIndicator status={status} chanceOfPlaying={chanceOfPlaying} news={news} />
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
