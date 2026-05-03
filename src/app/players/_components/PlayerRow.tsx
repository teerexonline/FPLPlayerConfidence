'use client';

import { useRouter } from 'next/navigation';
import type { JSX } from 'react';
import { ConfidenceTrend } from '@/components/confidence/ConfidenceTrend';
import { LivePlayerStreakIndicator } from '@/components/confidence/LivePlayerStreakIndicator';
import { PlayerStatusIndicator } from '@/components/confidence/PlayerStatusIndicator';
import { StaleDataIndicator } from '@/components/confidence/StaleDataIndicator';
import { StarButton } from '@/components/watchlist/StarButton';
import { cn } from '@/lib/utils';
import { getPlayerNameColorClass } from '@/lib/confidence/playerStatus';
import { XpPrimary } from './XpPrimary';
import type { PlayerWithConfidence } from './types';

interface PlayerRowProps {
  readonly player: PlayerWithConfidence;
  /** Whether this row currently has keyboard focus (roving tabIndex pattern). */
  readonly focused?: boolean;
}

export function PlayerRow({ player, focused = false }: PlayerRowProps): JSX.Element {
  const {
    webName,
    teamShortName,
    teamCode,
    position,
    nowCost,
    confidence,
    recentDeltas,
    id,
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
      tabIndex={focused ? 0 : -1}
      onClick={handleClick}
      className={cn(
        'group border-border hover:border-l-accent hover:bg-bg relative grid h-14 cursor-pointer grid-cols-[1fr_88px_60px_72px_88px_96px_36px] items-center border-b px-4 last:border-0 hover:border-l-2',
        focused && 'ring-accent/60 ring-2 outline-none ring-inset',
      )}
      aria-label={`${webName}, ${teamShortName}, ${position}, ${price}, confidence ${confidence.toString()}`}
    >
      {/* Player: jersey + name — role="cell" on each column satisfies aria-required-children.
          Pin button lives here so it remains inside a cell (not a bare row child). */}
      <div role="cell" className="flex min-w-0 items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/jerseys/${teamCode.toString()}`}
          alt=""
          aria-hidden="true"
          width={32}
          height={41}
          className="h-8 w-8 shrink-0 object-contain"
        />
        <span
          className={cn(
            'truncate text-[14px] font-medium',
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

      {/* Team */}
      <span role="cell" className="text-muted text-[13px]">
        {teamShortName}
      </span>

      {/* Position chip */}
      <span
        role="cell"
        className="border-border text-muted inline-flex h-6 w-fit items-center rounded-full border px-2.5 text-[11px] font-medium"
      >
        {position}
      </span>

      {/* Price */}
      <span role="cell" className="text-muted text-[14px] tabular-nums">
        {price}
      </span>

      {/* xP-primary cell: xP big, confidence as a small colored sub-line.
          Status + stale indicators sit alongside, since they answer "is this
          player going to play?" — context for any projection. pr-3 gives the
          right-aligned content breathing room before the trend column. */}
      <div role="cell" className="flex items-center justify-end gap-1.5 pr-3">
        <StaleDataIndicator isStale={isStale} />
        <PlayerStatusIndicator status={status} chanceOfPlaying={chanceOfPlaying} news={news} />
        <XpPrimary nextGwXp={nextGwXp} confidence={confidence} />
      </div>

      {/* Last 5 trend strip — drops the redundant arrow (the strip's last bar
          already shows direction). */}
      <div role="cell" className="flex items-center">
        <ConfidenceTrend deltas={recentDeltas} variant="strip" />
      </div>

      {/* Watchlist star */}
      <span
        role="cell"
        className="flex items-center justify-center"
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <StarButton playerId={id} playerName={webName} size="sm" />
      </span>
    </div>
  );
}
