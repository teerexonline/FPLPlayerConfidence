'use client';

import type { JSX } from 'react';
import Link from 'next/link';
import { ArrowLeftRight } from 'lucide-react';
import { XpDisplay } from './XpDisplay';
import { LivePlayerStreakIndicator } from '@/components/confidence/LivePlayerStreakIndicator';
import { PlayerStatusIndicator } from '@/components/confidence/PlayerStatusIndicator';
import { StarButton } from '@/components/watchlist/StarButton';
import { cn } from '@/lib/utils';
import { getPlayerNameColorClass } from '@/lib/confidence/playerStatus';
import { NextFixturesStrip } from './NextFixturesStrip';
import type { MyTeamViewMode, SquadPlayerRow } from './types';

interface StartingXIListProps {
  readonly starters: readonly SquadPlayerRow[];
  /** `historical` shows confidence; `projected` shows xP and a swap button. */
  readonly viewMode?: MyTeamViewMode;
  /** Called when the user clicks a row's swap button (projected mode only). */
  readonly onRequestSwap?: (player: SquadPlayerRow) => void;
  /** Called when the user clicks a row's captain slot (projected mode only). */
  readonly onSetCaptain?: (playerId: number) => void;
}

function CaptainBadge({
  isCaptain,
  isViceCaptain,
  onSetCaptain,
  playerId,
  playerName,
}: {
  isCaptain: boolean;
  isViceCaptain: boolean;
  onSetCaptain?: (playerId: number) => void;
  playerId: number;
  playerName: string;
}): JSX.Element {
  // Projected-mode interactive: tapping the slot promotes this player to
  // captain (and demotes the previous one). Filled when active, outlined
  // otherwise. Vice-captain is shown only when not interactive.
  if (onSetCaptain) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (!isCaptain) onSetCaptain(playerId);
        }}
        disabled={isCaptain}
        className={cn(
          'focus-visible:ring-accent inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-sans text-[10px] font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-none',
          isCaptain
            ? 'bg-accent/20 text-accent cursor-default'
            : 'border-border text-muted hover:text-accent hover:border-accent/40 cursor-pointer border',
        )}
        aria-label={isCaptain ? `Captain: ${playerName}` : `Make ${playerName} captain`}
        title={isCaptain ? 'Captain (xP × 2)' : 'Tap to set as captain'}
      >
        C
      </button>
    );
  }
  if (isCaptain) {
    return (
      <span
        className="bg-accent/10 text-accent inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-sans text-[10px] font-semibold"
        aria-label="Captain"
        title="Captain"
      >
        C
      </span>
    );
  }
  if (isViceCaptain) {
    return (
      <span
        className="border-border text-muted inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border font-sans text-[10px] font-semibold"
        aria-label="Vice captain"
        title="Vice captain"
      >
        V
      </span>
    );
  }
  return <span className="w-5 shrink-0" aria-hidden="true" />;
}

function StarterRow({
  player,
  viewMode,
  onRequestSwap,
  onSetCaptain,
}: {
  player: SquadPlayerRow;
  viewMode: MyTeamViewMode;
  onRequestSwap?: (p: SquadPlayerRow) => void;
  onSetCaptain?: (playerId: number) => void;
}): JSX.Element {
  const isProjected = viewMode === 'projected';
  const ariaSummary = isProjected
    ? `${player.webName}, ${player.teamShortName}, ${player.position}, projected ${Math.round(player.projectedXp ?? 0).toString()} xP`
    : `${player.webName}, ${player.teamShortName}, ${player.position}, confidence ${player.confidence > 0 ? '+' : ''}${player.confidence.toString()}`;

  return (
    <li role="listitem">
      <div
        className={cn(
          'group border-border -mx-4 border-b px-4 py-2 transition-colors last:border-0',
          'hover:bg-bg',
          player.isSwappedIn && 'bg-accent/5',
        )}
      >
        {/* Top row: # | jersey | name+team | right-side controls */}
        <div className="flex items-center gap-3">
          <span className="text-muted w-5 shrink-0 text-right font-mono text-[11px] tabular-nums">
            {player.squadPosition.toString()}
          </span>

          <Link
            href={`/players/${player.playerId.toString()}`}
            aria-label={ariaSummary}
            className="shrink-0"
          >
            {player.teamCode > 0 && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/jerseys/${player.teamCode.toString()}`}
                alt=""
                aria-hidden="true"
                width={28}
                height={36}
                className="h-7 w-7 object-contain"
              />
            )}
          </Link>

          <Link
            href={`/players/${player.playerId.toString()}`}
            aria-label={ariaSummary}
            className="min-w-0 flex-1"
          >
            <div className="flex items-center gap-1">
              <p
                className={cn(
                  'group-hover:text-accent truncate font-sans text-[13px] leading-tight font-medium transition-colors',
                  getPlayerNameColorClass(player.status, false),
                )}
              >
                {player.webName}
              </p>
              <LivePlayerStreakIndicator
                hotStreak={player.hotStreak}
                size="sm"
                status={player.status}
                isStale={false}
              />
              {player.isSwappedIn && (
                <span
                  className="bg-accent/20 text-accent inline-flex h-4 items-center rounded-sm px-1 font-mono text-[9px] font-semibold tracking-wider uppercase"
                  aria-label="Swapped in"
                  title="Swapped in via the planner"
                >
                  IN
                </span>
              )}
            </div>
            <p className="text-muted font-sans text-[11px] leading-tight">
              {player.teamShortName} · {player.position}
            </p>
          </Link>

          <CaptainBadge
            isCaptain={player.isCaptain}
            isViceCaptain={player.isViceCaptain}
            playerId={player.playerId}
            playerName={player.webName}
            {...(isProjected && onSetCaptain ? { onSetCaptain } : {})}
          />

          <PlayerStatusIndicator
            status={player.status}
            chanceOfPlaying={player.chanceOfPlaying}
            news={player.news}
          />

          {/* xP is the only displayed metric on My Team in any mode —
              confidence lives on the player detail page only. */}
          <div className="flex shrink-0 items-center gap-1">
            <XpDisplay value={player.projectedXp ?? 0} />
          </div>

          {isProjected && onRequestSwap ? (
            <button
              type="button"
              onClick={() => {
                onRequestSwap(player);
              }}
              className="border-border text-muted hover:text-accent hover:border-accent/40 focus-visible:ring-accent flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full border transition-colors focus-visible:ring-2 focus-visible:outline-none"
              aria-label={`Plan a transfer for ${player.webName}`}
              title="Plan a transfer"
            >
              <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          ) : (
            <StarButton playerId={player.playerId} playerName={player.webName} size="sm" />
          )}
        </div>

        {/* Bottom row: fixtures strip below the jersey + name area.
            pl-8 indents the strip past the squad-position column so it begins
            under the jersey and runs through the name column for breathing room. */}
        {player.nextFixtures.length > 0 && (
          <div className="mt-1 pl-8">
            <NextFixturesStrip fixtures={player.nextFixtures} compact />
          </div>
        )}
      </div>
    </li>
  );
}

/**
 * Renders the 11 starting players sorted by squad position (1–11).
 * Each row links to the player's detail page; in projected mode each row
 * shows xP and a swap button instead of confidence and a watchlist star.
 */
export function StartingXIList({
  starters,
  viewMode = 'historical',
  onRequestSwap,
  onSetCaptain,
}: StartingXIListProps): JSX.Element {
  return (
    <section aria-label="Starting XI" className="mb-2">
      <h2 className="text-muted mb-1 font-sans text-[11px] font-semibold tracking-[0.06em] uppercase">
        Starting XI
      </h2>
      <div className="border-border bg-surface rounded-[8px] border px-4">
        <ul role="list">
          {starters.map((player) => (
            <StarterRow
              key={player.playerId}
              player={player}
              viewMode={viewMode}
              {...(onRequestSwap !== undefined ? { onRequestSwap } : {})}
              {...(onSetCaptain !== undefined ? { onSetCaptain } : {})}
            />
          ))}
        </ul>
      </div>
      <p className="text-muted mt-2 font-sans text-[11px]">
        {viewMode === 'projected'
          ? 'Tap ↔ to plan a swap. Changes stay local until you accept them in FPL.'
          : "Captain shown for context only — doesn't affect Team Confidence."}
      </p>
    </section>
  );
}
