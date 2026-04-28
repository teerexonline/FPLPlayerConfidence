'use client';

import { useRouter } from 'next/navigation';
import type { JSX } from 'react';
import { ConfidenceNumber } from '@/components/confidence/ConfidenceNumber';
import { ConfidenceTrend } from '@/components/confidence/ConfidenceTrend';
import { HotStreakIndicator } from '@/components/confidence/HotStreakIndicator';
import { PlayerStatusIndicator } from '@/components/confidence/PlayerStatusIndicator';
import { StaleDataIndicator } from '@/components/confidence/StaleDataIndicator';
import { cn } from '@/lib/utils';
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
    recentAppearances,
    hotStreakLevel,
  } = player;
  const router = useRouter();
  const price = `£${(nowCost / 10).toFixed(1)}m`;
  const lastDelta = recentDeltas.at(-1) ?? 0;
  const arrow = lastDelta > 0 ? '↑' : lastDelta < 0 ? '↓' : '→';
  const arrowColor =
    lastDelta > 0 ? 'text-positive' : lastDelta < 0 ? 'text-negative' : 'text-neutral';

  function handleClick(): void {
    router.push(`/players/${id.toString()}`);
  }

  return (
    <div
      role="row"
      tabIndex={focused ? 0 : -1}
      onClick={handleClick}
      className={cn(
        'group border-border hover:border-l-accent hover:bg-bg relative grid h-14 cursor-pointer grid-cols-[1fr_88px_60px_72px_72px_96px] items-center border-b px-4 last:border-0 hover:border-l-2',
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
        <span className="text-text truncate text-[14px] font-medium">{webName}</span>
        <HotStreakIndicator level={hotStreakLevel} size="sm" />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
          }}
          className="border-border bg-bg text-muted hover:border-accent hover:text-accent focus-visible:ring-accent absolute right-4 hidden h-7 items-center rounded-[4px] border px-2 text-[11px] font-medium transition-colors group-hover:flex focus-visible:ring-2 focus-visible:outline-none"
          aria-label={`Pin ${webName} to watchlist`}
        >
          Pin
        </button>
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

      {/* Confidence + status/stale indicators */}
      <div role="cell" className="flex items-center gap-1.5">
        <ConfidenceNumber value={confidence} mode="c" size="sm" animated={false} />
        <StaleDataIndicator recentAppearances={recentAppearances} />
        <PlayerStatusIndicator status={status} chanceOfPlaying={chanceOfPlaying} news={news} />
      </div>

      {/* Last 5 trend + arrow */}
      <div role="cell" className="flex items-center gap-2">
        <ConfidenceTrend deltas={recentDeltas} variant="strip" />
        <span className={cn('text-[11px] font-medium', arrowColor)} aria-hidden="true">
          {arrow}
        </span>
      </div>
    </div>
  );
}
