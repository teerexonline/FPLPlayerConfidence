import Link from 'next/link';
import type { JSX } from 'react';
import { ConfidenceNumber } from '@/components/confidence/ConfidenceNumber';
import type { DashboardPlayer } from './types';

interface BiggestMoversCardProps {
  readonly title: string;
  readonly players: readonly DashboardPlayer[];
  readonly variant: 'risers' | 'fallers';
  /** Aria label describing the card purpose */
  readonly ariaLabel: string;
}

interface MoverRowProps {
  readonly player: DashboardPlayer;
  readonly variant: 'risers' | 'fallers';
  readonly rank: number;
}

function DeltaPill({
  delta,
  variant,
}: {
  delta: number;
  variant: 'risers' | 'fallers';
}): JSX.Element {
  const isPositive = variant === 'risers';
  const sign = delta > 0 ? '+' : delta < 0 ? '−' : '';
  const abs = Math.abs(delta);
  // Light mode: #15803d on #ecf8f1 = 4.67:1 ✓ / #b91c1c on #fceced = 5.89:1 ✓ (WCAG AA)
  // Dark mode: text-positive/negative (lighter variants) on dark tint pass easily
  const colorClass = isPositive
    ? 'text-[#15803d] dark:text-positive bg-positive/8'
    : 'text-[#b91c1c] dark:text-negative bg-negative/8';

  return (
    <span
      className={`${colorClass} inline-flex items-center rounded-full px-2 py-0.5 font-sans text-[11px] font-semibold tabular-nums`}
      aria-hidden="true"
    >
      {sign}
      {abs.toString()}
    </span>
  );
}

function MoverRow({ player, variant, rank }: MoverRowProps): JSX.Element {
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

      {/* Delta pill */}
      <DeltaPill delta={player.latestDelta} variant={variant} />

      {/* Confidence number */}
      <div className="w-8 shrink-0 text-right">
        <ConfidenceNumber value={player.confidence} mode="c" size="sm" animated={false} />
      </div>
    </Link>
  );
}

function EmptyMoversState({ variant }: { variant: 'risers' | 'fallers' }): JSX.Element {
  const message =
    variant === 'risers'
      ? 'No players gained confidence this gameweek.'
      : 'No players lost confidence this gameweek.';

  return (
    <div className="flex h-[168px] flex-col items-center justify-center">
      <p className="text-muted text-center font-sans text-[13px]">{message}</p>
    </div>
  );
}

export function BiggestMoversCard({
  title,
  players,
  variant,
  ariaLabel,
}: BiggestMoversCardProps): JSX.Element {
  return (
    <section
      className="border-border bg-surface flex flex-col rounded-[8px] border px-4 pt-5 pb-4"
      aria-label={ariaLabel}
    >
      {/* Card header */}
      <h2 className="text-muted mb-4 font-sans text-[11px] font-semibold tracking-[0.06em] uppercase">
        {title}
      </h2>

      {/* Player list */}
      {players.length === 0 ? (
        <EmptyMoversState variant={variant} />
      ) : (
        <ul role="list" className="flex flex-col">
          {players.map((player, i) => (
            <li key={player.id} role="listitem">
              <MoverRow player={player} variant={variant} rank={i + 1} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
