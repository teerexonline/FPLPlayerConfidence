import type { JSX } from 'react';
import { cn } from '@/lib/utils';
import { LivePlayerStreakIndicator } from '@/components/confidence/LivePlayerStreakIndicator';
import { PlayerStatusIndicator } from '@/components/confidence/PlayerStatusIndicator';
import { StarButton } from '@/components/watchlist/StarButton';
import { getPlayerNameColorClass } from '@/lib/confidence/playerStatus';
import type { PlayerDetailData } from './types';

interface PlayerHeaderProps {
  readonly player: PlayerDetailData;
}

const POSITION_LABELS: Record<string, string> = {
  GK: 'Goalkeeper',
  DEF: 'Defender',
  MID: 'Midfielder',
  FWD: 'Forward',
};

export function PlayerHeader({ player }: PlayerHeaderProps): JSX.Element {
  const {
    webName,
    teamCode,
    teamName,
    teamShortName,
    position,
    nowCost,
    status,
    chanceOfPlaying,
    news,
    hotStreak,
  } = player;
  const price = `£${(nowCost / 10).toFixed(1)}m`;
  const jerseyUrl = `/api/jerseys/${teamCode.toString()}?size=110`;
  const positionLabel = POSITION_LABELS[position] ?? position;

  return (
    <header className="flex flex-col items-center gap-6 pt-2 sm:flex-row sm:items-end sm:gap-10 sm:pt-4">
      {/* Jersey on radial gradient — the visual anchor */}
      <div className="relative flex shrink-0 items-center justify-center">
        {/* Soft oval gradient behind the kit */}
        <div
          aria-hidden="true"
          className="absolute inset-0 rounded-full"
          style={{
            background:
              'radial-gradient(ellipse 160px 140px at center, var(--surface) 10%, transparent 75%)',
          }}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={jerseyUrl}
          alt={`${teamName} kit`}
          width={110}
          height={140}
          className="relative z-10 h-[120px] w-auto object-contain drop-shadow-sm sm:h-[160px]"
        />
      </div>

      {/* Name + meta */}
      <div className="text-center sm:text-left">
        {/* The only Fraunces moment in the product — a nameplate, not decoration */}
        <h1
          className={cn('leading-[1.1] tracking-[-0.01em]', getPlayerNameColorClass(status, 99))}
          style={{
            fontFamily: 'var(--font-fraunces), ui-serif, Georgia, serif',
            fontSize: 'clamp(32px, 5vw, 44px)',
            fontWeight: 400,
            fontVariationSettings: '"opsz" 96',
          }}
        >
          {webName}
        </h1>

        {/* Meta row */}
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
          <span className="text-muted text-[14px]">{teamName}</span>
          <span className="bg-border h-3.5 w-px" aria-hidden="true" />
          <span
            className={cn(
              'border-border text-muted inline-flex h-6 items-center rounded-full border px-2.5 text-[11px] font-medium',
            )}
            title={positionLabel}
          >
            {position}
          </span>
          <span className="bg-border h-3.5 w-px" aria-hidden="true" />
          <span className="text-muted text-[14px] tabular-nums">{price}</span>
          {hotStreak !== null && (status === 'a' || status === '') && (
            <>
              <span className="bg-border h-3.5 w-px" aria-hidden="true" />
              <LivePlayerStreakIndicator
                hotStreak={hotStreak}
                size="lg"
                status={status}
                isStale={false}
              />
            </>
          )}
          {status !== 'a' && (
            <>
              <span className="bg-border h-3.5 w-px" aria-hidden="true" />
              <PlayerStatusIndicator
                status={status}
                chanceOfPlaying={chanceOfPlaying}
                news={news}
              />
            </>
          )}
          <span className="bg-border h-3.5 w-px" aria-hidden="true" />
          <StarButton playerId={player.id} playerName={webName} size="lg" />
        </div>

        {/* Team short + GW badge */}
        <p className="text-muted/60 mt-1.5 text-[12px] tracking-[0.06em] uppercase">
          {teamShortName} · FPL 2024/25
        </p>
      </div>
    </header>
  );
}
