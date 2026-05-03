'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { JSX } from 'react';
import { cn } from '@/lib/utils';
import { ConfidenceNumber } from '@/components/confidence/ConfidenceNumber';
import { LivePlayerStreakIndicator } from '@/components/confidence/LivePlayerStreakIndicator';
import { PlayerStatusIndicator } from '@/components/confidence/PlayerStatusIndicator';
import { StaleDataIndicator } from '@/components/confidence/StaleDataIndicator';
import { StarButton } from '@/components/watchlist/StarButton';
import { getPlayerNameColorClass } from '@/lib/confidence/playerStatus';
import type { DashboardLeaderboard, DashboardPlayer } from './types';

// ── Tab definitions ───────────────────────────────────────────────────────────

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'gk', label: 'GK' },
  { key: 'def', label: 'DEF' },
  { key: 'mid', label: 'MID' },
  { key: 'fwd', label: 'FWD' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

function isValidTab(v: string): v is TabKey {
  return TABS.some((t) => t.key === v);
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface LeaderboardPreviewProps {
  readonly leaderboard: DashboardLeaderboard;
  readonly initialTab?: string;
}

// ── Row ───────────────────────────────────────────────────────────────────────

interface LeaderboardRowProps {
  readonly player: DashboardPlayer;
  readonly rank: number;
}

function LeaderboardRow({ player, rank }: LeaderboardRowProps): JSX.Element {
  const router = useRouter();

  function handleClick(): void {
    router.push(`/players/${player.id.toString()}`);
  }

  return (
    <div
      role="row"
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      tabIndex={0}
      className="group border-border hover:border-l-accent hover:bg-bg focus-visible:ring-accent/60 relative flex h-14 cursor-pointer items-center gap-4 border-b px-4 transition-colors last:border-0 hover:border-l-2 focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
      aria-label={`${rank.toString()}. ${player.webName}, ${player.teamShortName}, ${player.position}, confidence ${player.confidence > 0 ? '+' : ''}${player.confidence.toString()}`}
    >
      {/* Rank */}
      <span
        role="cell"
        className="text-muted w-5 shrink-0 text-right font-sans text-[12px] tabular-nums"
      >
        {rank.toString()}
      </span>

      {/* Jersey + name + position */}
      <div role="cell" className="flex min-w-0 flex-1 items-center gap-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/jerseys/${player.teamCode.toString()}`}
          alt=""
          aria-hidden="true"
          width={28}
          height={36}
          className="h-7 w-7 shrink-0 object-contain"
        />
        <div className="min-w-0">
          <div className="flex items-center gap-1">
            <p
              className={cn(
                'group-hover:text-accent truncate font-sans text-[14px] leading-tight font-medium transition-colors',
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
          <p className="text-muted font-sans text-[11px] leading-tight">{player.teamShortName}</p>
        </div>
      </div>

      {/* Position chip */}
      <span
        role="cell"
        className="border-border text-muted hidden shrink-0 items-center rounded-full border px-2 py-0.5 font-sans text-[11px] font-medium sm:inline-flex"
      >
        {player.position}
      </span>

      {/* GW */}
      <span
        role="cell"
        className="text-muted hidden shrink-0 font-sans text-[12px] tabular-nums sm:block"
      >
        GW{player.latestGameweek.toString()}
      </span>

      {/* Next-GW xP — quick read for "what's the projection" alongside confidence */}
      {player.nextGwXp !== null && (
        <span
          role="cell"
          className="text-text hidden shrink-0 items-baseline gap-0.5 font-sans text-[13px] tabular-nums sm:inline-flex"
          title="Projected expected points for the next gameweek"
          aria-label={`Projected ${Math.round(player.nextGwXp).toString()} xP next gameweek`}
        >
          <span className="font-semibold">{Math.round(player.nextGwXp).toString()}</span>
          <span className="text-muted text-[10px] font-medium">xP</span>
        </span>
      )}

      {/* Confidence + status/stale indicators */}
      <div role="cell" className="flex shrink-0 items-center gap-1.5">
        <ConfidenceNumber value={player.confidence} mode="c" size="sm" animated={false} />
        <StaleDataIndicator isStale={player.isStale} />
        <PlayerStatusIndicator
          status={player.status}
          chanceOfPlaying={player.chanceOfPlaying}
          news={player.news}
        />
      </div>

      {/* Watchlist star */}
      <span
        role="cell"
        className="flex shrink-0 items-center"
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <StarButton playerId={player.id} playerName={player.webName} size="sm" />
      </span>
    </div>
  );
}

// ── Empty slot ────────────────────────────────────────────────────────────────

function EmptyLeaderboard({ tab }: { readonly tab: TabKey }): JSX.Element {
  const label = tab === 'all' ? 'players' : tab.toUpperCase() + 's';
  return (
    <div className="border-border bg-surface flex h-32 items-center justify-center rounded-b-[8px] border border-t-0">
      <p className="text-muted font-sans text-[13px]">No {label} with confidence data yet.</p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function LeaderboardPreview({
  leaderboard,
  initialTab = 'all',
}: LeaderboardPreviewProps): JSX.Element {
  const router = useRouter();
  const resolvedInitial = isValidTab(initialTab) ? initialTab : 'all';
  const [activeTab, setActiveTab] = useState<TabKey>(resolvedInitial);

  function handleTabChange(tab: TabKey): void {
    setActiveTab(tab);
    const url = tab === 'all' ? '/' : `/?leaderboard=${tab}`;
    router.replace(url, { scroll: false });
  }

  const players = (() => {
    switch (activeTab) {
      case 'all':
        return leaderboard.all;
      case 'gk':
        return leaderboard.GK;
      case 'def':
        return leaderboard.DEF;
      case 'mid':
        return leaderboard.MID;
      case 'fwd':
        return leaderboard.FWD;
    }
  })();

  return (
    <section aria-label="Confidence leaderboard">
      <LeaderboardHeader activeTab={activeTab} onTabChange={handleTabChange} />

      {players.length === 0 ? (
        <EmptyLeaderboard tab={activeTab} />
      ) : (
        <div
          role="table"
          aria-label={`Top players by confidence — ${activeTab === 'all' ? 'all positions' : activeTab.toUpperCase()}`}
          className="border-border bg-surface overflow-hidden rounded-b-[8px] border border-t-0"
        >
          {/* Column headers — screen-reader only */}
          <div role="rowgroup" className="sr-only">
            <div role="row">
              <span role="columnheader">Rank</span>
              <span role="columnheader">Player</span>
              <span role="columnheader">Position</span>
              <span role="columnheader">Gameweek</span>
              <span role="columnheader">Confidence</span>
            </div>
          </div>

          <div role="rowgroup">
            {players.map((player, i) => (
              <LeaderboardRow key={player.id} player={player} rank={i + 1} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

// ── Header with tabs ──────────────────────────────────────────────────────────

interface LeaderboardHeaderProps {
  readonly activeTab: TabKey;
  readonly onTabChange: (tab: TabKey) => void;
}

function LeaderboardHeader({ activeTab, onTabChange }: LeaderboardHeaderProps): JSX.Element {
  return (
    <div className="border-border bg-surface flex items-center justify-between gap-3 rounded-t-[8px] border px-4 py-2.5">
      {/* Title */}
      <h2 className="text-muted shrink-0 font-sans text-[11px] font-semibold tracking-[0.06em] uppercase">
        Confidence Leaderboard
      </h2>

      {/* Position tabs — scrollable on mobile */}
      <div
        className="flex items-center gap-1 overflow-x-auto"
        style={{ scrollbarWidth: 'none' }}
        role="tablist"
        aria-label="Filter leaderboard by position"
      >
        {TABS.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={activeTab === tab.key}
            onClick={() => {
              onTabChange(tab.key);
            }}
            className={cn(
              'focus-visible:ring-accent shrink-0 rounded-full px-2.5 py-0.5 font-sans text-[11px] font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none',
              activeTab === tab.key
                ? 'bg-accent text-white'
                : 'border-border text-muted hover:text-text border',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* View all link */}
      <Link
        href="/players"
        className="text-muted hover:text-accent focus-visible:ring-accent shrink-0 rounded font-sans text-[11px] font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
      >
        View all →
      </Link>
    </div>
  );
}
