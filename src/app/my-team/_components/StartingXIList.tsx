import type { JSX } from 'react';
import Link from 'next/link';
import { ConfidenceNumber } from '@/components/confidence/ConfidenceNumber';
import { PlayerStatusIndicator } from '@/components/confidence/PlayerStatusIndicator';
import { computeFormation } from './computeFormation';
import type { SquadPlayerRow } from './types';

interface StartingXIListProps {
  readonly starters: readonly SquadPlayerRow[];
}

function CaptainBadge({
  isCaptain,
  isViceCaptain,
}: {
  isCaptain: boolean;
  isViceCaptain: boolean;
}): JSX.Element | null {
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

function StarterRow({ player }: { player: SquadPlayerRow }): JSX.Element {
  return (
    <li role="listitem">
      <Link
        href={`/players/${player.playerId.toString()}`}
        className="group border-border hover:bg-bg -mx-4 flex h-[52px] items-center gap-3 border-b px-4 transition-colors last:border-0"
        aria-label={`${player.webName}, ${player.teamShortName}, ${player.position}, confidence ${player.confidence > 0 ? '+' : ''}${player.confidence.toString()}`}
      >
        {/* Squad position number */}
        <span className="text-muted w-5 shrink-0 text-right font-mono text-[11px] tabular-nums">
          {player.squadPosition.toString()}
        </span>

        {/* Jersey */}
        {player.teamCode > 0 && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/jerseys/${player.teamCode.toString()}`}
            alt=""
            aria-hidden="true"
            width={28}
            height={36}
            className="h-7 w-7 shrink-0 object-contain"
          />
        )}

        {/* Name + team */}
        <div className="min-w-0 flex-1">
          <p className="text-text group-hover:text-accent truncate font-sans text-[13px] leading-tight font-medium transition-colors">
            {player.webName}
          </p>
          <p className="text-muted font-sans text-[11px] leading-tight">
            {player.teamShortName} · {player.position}
          </p>
        </div>

        {/* Captain / vice badge */}
        <CaptainBadge isCaptain={player.isCaptain} isViceCaptain={player.isViceCaptain} />

        {/* Status dot */}
        <PlayerStatusIndicator
          status={player.status}
          chanceOfPlaying={player.chanceOfPlaying}
          news={player.news}
        />

        {/* Confidence */}
        <div className="w-8 shrink-0 text-right">
          <ConfidenceNumber value={player.confidence} size="sm" animated={false} />
        </div>
      </Link>
    </li>
  );
}

/**
 * Renders the 11 starting players sorted by squad position (1–11).
 * Each row links to the player's detail page. Includes the formation label
 * derived from the actual squad positions.
 */
export function StartingXIList({ starters }: StartingXIListProps): JSX.Element {
  const formation = computeFormation(starters);

  return (
    <section aria-label="Starting XI" className="mb-2">
      {/* Formation label */}
      <div className="mb-3" aria-label={`Formation: ${formation}`}>
        <p className="text-muted font-sans text-[11px] font-semibold tracking-[0.06em] uppercase">
          Formation
        </p>
        <p className="text-text mt-0.5 font-sans text-[18px] font-semibold tracking-tight tabular-nums">
          {formation}
        </p>
      </div>

      <h2 className="text-muted mb-1 font-sans text-[11px] font-semibold tracking-[0.06em] uppercase">
        Starting XI
      </h2>
      <div className="border-border bg-surface rounded-[8px] border px-4">
        <ul role="list">
          {starters.map((player) => (
            <StarterRow key={player.playerId} player={player} />
          ))}
        </ul>
      </div>
      <p className="text-muted mt-2 font-sans text-[11px]">
        Captain shown for context only — doesn&apos;t affect Team Confidence.
      </p>
    </section>
  );
}
