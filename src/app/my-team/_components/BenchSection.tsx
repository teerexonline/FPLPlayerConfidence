'use client';

import type { JSX } from 'react';
import Link from 'next/link';
import { ConfidenceNumber } from '@/components/confidence/ConfidenceNumber';
import { LivePlayerStreakIndicator } from '@/components/confidence/LivePlayerStreakIndicator';
import { PlayerStatusIndicator } from '@/components/confidence/PlayerStatusIndicator';
import { StarButton } from '@/components/watchlist/StarButton';
import { cn } from '@/lib/utils';
import { getPlayerNameColorClass } from '@/lib/confidence/playerStatus';
import type { SquadPlayerRow } from './types';

interface BenchSectionProps {
  readonly bench: readonly SquadPlayerRow[];
  /** The gameweek context being displayed — forwarded to HotStreakIndicator. */
  readonly currentGW: number;
}

function BenchRow({
  player,
  currentGW,
}: {
  player: SquadPlayerRow;
  currentGW: number;
}): JSX.Element {
  return (
    <li role="listitem">
      <Link
        href={`/players/${player.playerId.toString()}`}
        className="group border-border hover:bg-bg -mx-4 flex h-[52px] items-center gap-3 border-b px-4 transition-colors last:border-0"
        aria-label={`Bench: ${player.webName}, ${player.teamShortName}, ${player.position}, confidence ${player.confidence > 0 ? '+' : ''}${player.confidence.toString()}`}
      >
        {/* Squad position (12–15) */}
        <span className="text-muted w-5 shrink-0 text-right font-mono text-[11px] tabular-nums opacity-60">
          {player.squadPosition.toString()}
        </span>

        {/* Jersey — slight fade signals bench status without looking broken */}
        {player.teamCode > 0 && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/jerseys/${player.teamCode.toString()}`}
            alt=""
            aria-hidden="true"
            width={28}
            height={36}
            className="h-7 w-7 shrink-0 object-contain opacity-60"
          />
        )}

        {/* Name + team — muted text instead of opacity so content remains readable */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <p
              className={cn(
                'group-hover:text-accent truncate font-sans text-[13px] leading-tight font-medium transition-colors',
                player.status !== 'a' && player.status !== ''
                  ? getPlayerNameColorClass(player.status, 99)
                  : 'text-muted',
              )}
            >
              {player.webName}
            </p>
            <LivePlayerStreakIndicator
              level={player.hotStreakLevel}
              size="sm"
              currentGW={currentGW}
              status={player.status}
              isStale={false}
            />
          </div>
          <p className="text-muted/60 font-sans text-[11px] leading-tight">
            {player.teamShortName} · {player.position}
          </p>
        </div>

        {/* Placeholder for badge alignment */}
        <span className="w-5 shrink-0" aria-hidden="true" />

        {/* Status dot */}
        <PlayerStatusIndicator
          status={player.status}
          chanceOfPlaying={player.chanceOfPlaying}
          news={player.news}
        />

        {/* Confidence — full opacity so the value is readable */}
        <div className="flex shrink-0 items-center gap-1">
          <ConfidenceNumber value={player.confidence} mode="c" size="sm" animated={false} />
        </div>

        {/* Watchlist star */}
        <StarButton playerId={player.playerId} playerName={player.webName} size="sm" />
      </Link>
    </li>
  );
}

/**
 * Renders the 4 bench players (squad positions 12–15) at reduced opacity
 * to signal their exclusion from Team Confidence.
 */
export function BenchSection({ bench, currentGW }: BenchSectionProps): JSX.Element {
  return (
    <section aria-label="Bench" className="mb-8">
      <h2 className="text-muted mb-1 font-sans text-[11px] font-semibold tracking-[0.06em] uppercase">
        Bench
      </h2>
      <div className="border-border bg-surface rounded-[8px] border px-4">
        <ul role="list">
          {bench.map((player) => (
            <BenchRow key={player.playerId} player={player} currentGW={currentGW} />
          ))}
        </ul>
      </div>
      <p className="text-muted mt-2 font-sans text-[11px]">
        Bench is excluded from Team Confidence — only starters count.
      </p>
    </section>
  );
}
