import Link from 'next/link';
import type { JSX } from 'react';
import { ConfidenceNumber } from '@/components/confidence/ConfidenceNumber';
import { HotStreakIndicator } from '@/components/confidence/HotStreakIndicator';
import type { DashboardPlayer } from './types';

interface HotPlayersCardProps {
  readonly players: readonly DashboardPlayer[];
}

interface HotPlayerRowProps {
  readonly player: DashboardPlayer;
  readonly rank: number;
}

function HotPlayerRow({ player, rank }: HotPlayerRowProps): JSX.Element {
  return (
    <Link
      href={`/players/${player.id.toString()}`}
      className="group border-border hover:bg-bg focus-visible:ring-accent -mx-4 flex h-[56px] items-center gap-3 border-b px-4 transition-colors last:border-0 focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
      aria-label={`${player.webName}, ${player.teamShortName}, ${player.position}, confidence ${player.confidence > 0 ? '+' : ''}${player.confidence.toString()}`}
    >
      {/* Rank */}
      <span className="text-muted w-4 shrink-0 text-right font-sans text-[11px] tabular-nums">
        {rank.toString()}
      </span>

      {/* Jersey */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/jerseys/${player.teamCode.toString()}`}
        alt=""
        aria-hidden="true"
        width={28}
        height={36}
        className="h-7 w-7 shrink-0 object-contain"
      />

      {/* Name + position */}
      <div className="min-w-0 flex-1">
        <p className="text-text group-hover:text-accent truncate font-sans text-[13px] leading-tight font-medium transition-colors">
          {player.webName}
        </p>
        <p className="text-muted font-sans text-[11px] leading-tight">
          {player.teamShortName} · {player.position}
        </p>
      </div>

      {/* Hot streak indicator */}
      <HotStreakIndicator level={player.hotStreakLevel} size="sm" />

      {/* Confidence number */}
      <div className="w-8 shrink-0 text-right">
        <ConfidenceNumber value={player.confidence} mode="c" size="sm" animated={false} />
      </div>
    </Link>
  );
}

function EmptyHotState(): JSX.Element {
  return (
    <div className="flex h-[168px] flex-col items-center justify-center gap-1.5">
      <span
        role="img"
        aria-label="No hot streak"
        className="flex h-[10px] w-[10px] items-center justify-center"
      >
        <span className="bg-muted/30 block h-[10px] w-[10px] rounded-full" aria-hidden="true" />
      </span>
      <p className="text-muted text-center font-sans text-[13px]">No players on a hot streak.</p>
    </div>
  );
}

export function HotPlayersCard({ players }: HotPlayersCardProps): JSX.Element {
  return (
    <section
      className="border-border bg-surface flex flex-col rounded-[8px] border px-4 pt-5 pb-4"
      aria-label="Players on a hot streak"
    >
      {/* Card header */}
      <h2 className="text-muted mb-4 font-sans text-[11px] font-semibold tracking-[0.06em] uppercase">
        Hot Streak
      </h2>

      {/* Player list */}
      {players.length === 0 ? (
        <EmptyHotState />
      ) : (
        <ul role="list" className="flex flex-col">
          {players.map((player, i) => (
            <li key={player.id} role="listitem">
              <HotPlayerRow player={player} rank={i + 1} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
