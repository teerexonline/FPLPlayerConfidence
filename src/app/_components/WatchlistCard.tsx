'use client';

import Link from 'next/link';
import type { JSX } from 'react';
import { LivePlayerStreakIndicator } from '@/components/confidence/LivePlayerStreakIndicator';
import { StarButton } from '@/components/watchlist/StarButton';
import { useAuth } from '@/components/auth/AuthContext';
import { cn } from '@/lib/utils';
import { getPlayerNameColorClass } from '@/lib/confidence/playerStatus';
import type { DashboardPlayer } from './types';

interface WatchlistCardProps {
  readonly players: readonly DashboardPlayer[];
  readonly isAuthenticated: boolean;
}

function WatchlistRow({ player }: { readonly player: DashboardPlayer }): JSX.Element {
  return (
    <li role="listitem">
      <Link
        href={`/players/${player.id.toString()}`}
        className="group border-border hover:bg-bg focus-visible:ring-accent -mx-4 flex h-[56px] items-center gap-3 border-b px-4 transition-colors last:border-0 focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
        aria-label={`${player.webName}, ${player.teamShortName}, ${player.position}${player.nextGwXp !== null ? `, projected ${Math.round(player.nextGwXp).toString()} xP next gameweek` : ''}`}
      >
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

        {/* Name + team · position */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <p
              className={cn(
                'group-hover:text-accent truncate font-sans text-[13px] leading-tight font-medium transition-colors',
                getPlayerNameColorClass(player.status, player.isStale),
              )}
            >
              {player.webName}
            </p>
            <LivePlayerStreakIndicator
              hotStreak={player.hotStreak}
              size="sm"
              status={player.status}
              isStale={player.isStale}
            />
          </div>
          <p className="text-muted font-sans text-[11px] leading-tight">
            {player.teamShortName} · {player.position}
          </p>
        </div>

        {/* Next-GW xP — actionable projection. Confidence lives on the player
            detail page only. */}
        <span
          className="text-text inline-flex items-baseline gap-0.5 font-sans text-[14px] tabular-nums"
          title="Projected expected points for the next gameweek"
        >
          {player.nextGwXp === null ? (
            <span className="text-muted/60 font-mono text-[12px]">—</span>
          ) : (
            <>
              <span className="font-semibold">{Math.round(player.nextGwXp).toString()}</span>
              <span className="text-muted text-[10px] font-medium">xP</span>
            </>
          )}
        </span>

        {/* Star — remove from watchlist */}
        <StarButton playerId={player.id} playerName={player.webName} size="sm" />
      </Link>
    </li>
  );
}

function SignInCta(): JSX.Element {
  const { openPanel } = useAuth();
  return (
    <div className="flex h-[168px] flex-col items-center justify-center gap-3">
      <svg
        width={28}
        height={28}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        className="text-border"
      >
        <path
          d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div className="text-center">
        <p className="text-text font-sans text-[14px] font-medium">Save players to watchlist</p>
        <p className="text-muted mt-1 max-w-[200px] font-sans text-[12px] leading-snug">
          Sign in to bookmark players and track them here.
        </p>
      </div>
      <button
        type="button"
        onClick={openPanel}
        className="border-border bg-bg text-text hover:border-accent hover:text-accent focus-visible:ring-accent inline-flex h-8 items-center rounded-[6px] border px-3 font-sans text-[12px] font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
      >
        Sign in
      </button>
    </div>
  );
}

function EmptyWatchlist(): JSX.Element {
  return (
    <div className="flex h-[168px] flex-col items-center justify-center gap-3">
      <svg
        width={28}
        height={28}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        className="text-border"
      >
        <path
          d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div className="text-center">
        <p className="text-text font-sans text-[14px] font-medium">No watchlist yet</p>
        <p className="text-muted mt-1 max-w-[200px] font-sans text-[12px] leading-snug">
          Star players from the players list to track them here.
        </p>
      </div>
      <Link
        href="/players"
        className="border-border bg-bg text-text hover:border-accent hover:text-accent focus-visible:ring-accent inline-flex h-8 items-center rounded-[6px] border px-3 font-sans text-[12px] font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
      >
        Browse players
      </Link>
    </div>
  );
}

export function WatchlistCard({ players, isAuthenticated }: WatchlistCardProps): JSX.Element {
  return (
    <section
      className="border-border bg-surface flex flex-col rounded-[8px] border px-4 pt-5 pb-4"
      aria-label="Watchlist"
    >
      <h2 className="text-muted mb-4 font-sans text-[11px] font-semibold tracking-[0.06em] uppercase">
        Watchlist
      </h2>

      {players.length > 0 ? (
        <ul role="list" className="flex flex-col">
          {players.map((player) => (
            <WatchlistRow key={player.id} player={player} />
          ))}
        </ul>
      ) : isAuthenticated ? (
        <EmptyWatchlist />
      ) : (
        <SignInCta />
      )}
    </section>
  );
}
