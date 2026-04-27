import type { JSX } from 'react';
import type { MyTeamData } from './types';

export interface ManagerHeaderProps extends Pick<
  MyTeamData,
  | 'managerName'
  | 'teamName'
  | 'overallRank'
  | 'overallPoints'
  | 'gameweek'
  | 'freeHitBypassed'
  | 'freeHitGameweek'
  | 'isGw1FreeHit'
> {
  readonly preDeadlineFallback: boolean;
}

export function ManagerHeader({
  managerName,
  teamName,
  overallRank,
  overallPoints,
  gameweek,
  freeHitBypassed,
  freeHitGameweek,
  isGw1FreeHit,
  preDeadlineFallback,
}: ManagerHeaderProps): JSX.Element {
  // Free Hit wording takes priority — it's more specific than pre-deadline.
  const showFhBypassed = freeHitBypassed && freeHitGameweek !== null;
  const showPreDeadline = preDeadlineFallback && !showFhBypassed && !isGw1FreeHit;

  return (
    <div className="border-border border-b pt-8 pb-6">
      {/* Manager name in display serif — the second Fraunces moment in the product */}
      <h1 className="font-display text-[44px] leading-tight font-[400] tracking-[-0.01em]">
        {managerName}
      </h1>
      <div className="text-muted mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-sans text-[13px]">
        <span>{teamName}</span>
        {overallRank !== null && (
          <>
            <span aria-hidden="true">·</span>
            <span>Rank {overallRank.toLocaleString()}</span>
          </>
        )}
        <span aria-hidden="true">·</span>
        <span>{overallPoints.toLocaleString()} pts</span>
        <span aria-hidden="true">·</span>
        <span>GW{gameweek.toString()}</span>
      </div>
      {showFhBypassed && (
        <p className="text-muted/60 mt-1.5 font-sans text-[12px]">
          Showing your pre-Free Hit squad from GW{gameweek.toString()} — Free Hit was played in GW
          {freeHitGameweek.toString()}
        </p>
      )}
      {isGw1FreeHit && (
        <p className="text-muted/60 mt-1.5 font-sans text-[12px]">
          Showing your Free Hit squad — your regular squad data isn&apos;t available yet
        </p>
      )}
      {showPreDeadline && (
        <p className="text-muted/60 mt-1.5 font-sans text-[12px]">
          Showing your locked squad from GW{gameweek.toString()} — the next deadline hasn&apos;t
          passed yet
        </p>
      )}
    </div>
  );
}
