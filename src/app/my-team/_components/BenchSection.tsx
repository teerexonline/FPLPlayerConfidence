'use client';

import type { JSX } from 'react';
import Link from 'next/link';
import { ArrowLeftRight } from 'lucide-react';
import { LivePlayerStreakIndicator } from '@/components/confidence/LivePlayerStreakIndicator';
import { PlayerStatusIndicator } from '@/components/confidence/PlayerStatusIndicator';
import { StarButton } from '@/components/watchlist/StarButton';
import { cn } from '@/lib/utils';
import { getPlayerNameColorClass } from '@/lib/confidence/playerStatus';
import { NextFixturesStrip } from './NextFixturesStrip';
import { XpDisplay } from './XpDisplay';
import type { MyTeamViewMode, SquadPlayerRow } from './types';

interface BenchSectionProps {
  readonly bench: readonly SquadPlayerRow[];
  /** `historical` shows confidence; `projected` shows xP (bench still excluded from team xP). */
  readonly viewMode?: MyTeamViewMode;
  /** Called when the user clicks ↔ on a bench row in projected mode (substitute promote). */
  readonly onRequestSwap?: (player: SquadPlayerRow) => void;
}

function BenchRow({
  player,
  viewMode,
  onRequestSwap,
}: {
  player: SquadPlayerRow;
  viewMode: MyTeamViewMode;
  onRequestSwap?: (p: SquadPlayerRow) => void;
}): JSX.Element {
  const isProjected = viewMode === 'projected';
  const ariaLabel = isProjected
    ? `Bench: ${player.webName}, ${player.teamShortName}, ${player.position}, projected ${Math.round(player.projectedXp ?? 0).toString()} xP`
    : `Bench: ${player.webName}, ${player.teamShortName}, ${player.position}, confidence ${player.confidence > 0 ? '+' : ''}${player.confidence.toString()}`;
  return (
    <li role="listitem">
      <div className="group border-border hover:bg-bg -mx-4 border-b px-4 py-2 transition-colors last:border-0">
        {/* Top row: # | jersey | name+team | right-side controls */}
        <div className="flex items-center gap-3">
          <span className="text-muted w-5 shrink-0 text-right font-mono text-[11px] tabular-nums opacity-60">
            {player.squadPosition.toString()}
          </span>

          <Link
            href={`/players/${player.playerId.toString()}`}
            aria-label={ariaLabel}
            className="shrink-0 opacity-70"
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
            aria-label={ariaLabel}
            className="min-w-0 flex-1"
          >
            <div className="flex items-center gap-1">
              <p
                className={cn(
                  'group-hover:text-accent truncate font-sans text-[13px] leading-tight font-medium transition-colors',
                  player.status !== 'a' && player.status !== ''
                    ? getPlayerNameColorClass(player.status, false)
                    : 'text-muted',
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
            </div>
            <p className="text-muted/60 font-sans text-[11px] leading-tight">
              {player.teamShortName} · {player.position}
            </p>
          </Link>

          <span className="w-5 shrink-0" aria-hidden="true" />

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
              aria-label={`Promote ${player.webName} into starting XI`}
              title="Promote into starting XI"
            >
              <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          ) : (
            <StarButton playerId={player.playerId} playerName={player.webName} size="sm" />
          )}
        </div>

        {/* Bottom row: fixtures strip below jersey + name (full width). */}
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
 * Renders the 4 bench players (squad positions 12–15) at reduced opacity
 * to signal their exclusion from Team Confidence (and projected team xP).
 */
export function BenchSection({
  bench,
  viewMode = 'historical',
  onRequestSwap,
}: BenchSectionProps): JSX.Element {
  return (
    <section aria-label="Bench" className="mb-8">
      <h2 className="text-muted mb-1 font-sans text-[11px] font-semibold tracking-[0.06em] uppercase">
        Bench
      </h2>
      <div className="border-border bg-surface rounded-[8px] border px-4">
        <ul role="list">
          {bench.map((player) => (
            <BenchRow
              key={player.playerId}
              player={player}
              viewMode={viewMode}
              {...(onRequestSwap !== undefined ? { onRequestSwap } : {})}
            />
          ))}
        </ul>
      </div>
      <p className="text-muted mt-2 font-sans text-[11px]">
        {viewMode === 'projected'
          ? 'Tap ↔ to promote a bench player into the XI. Bench xP is shown for context — team xP only counts starters.'
          : 'Bench is excluded from Team Confidence — only starters count.'}
      </p>
    </section>
  );
}
