'use client';

import { useState, useEffect, useSyncExternalStore } from 'react';
import type { JSX } from 'react';
import { ConnectTeamForm } from './ConnectTeamForm';
import { MyTeamHero } from './MyTeamHero';
import { PositionalBreakdown } from './PositionalBreakdown';
import { StartingXIList } from './StartingXIList';
import { BenchSection } from './BenchSection';
import { TeamSyncFooter } from './TeamSyncFooter';
import type { MyTeamData } from './types';

const LS_KEY = 'fpl-team-id';

type FetchState =
  | { kind: 'idle' }
  | { kind: 'loaded'; data: MyTeamData }
  | { kind: 'error'; message: string };

function getStoredTeamId(): number | null {
  const stored = localStorage.getItem(LS_KEY);
  if (!stored) return null;
  const teamId = parseInt(stored, 10);
  return isNaN(teamId) ? null : teamId;
}

function ManagerHeader({
  managerName,
  teamName,
  overallRank,
  overallPoints,
  gameweek,
  freeHitBypassed,
  freeHitGameweek,
  isGw1FreeHit,
}: Pick<
  MyTeamData,
  | 'managerName'
  | 'teamName'
  | 'overallRank'
  | 'overallPoints'
  | 'gameweek'
  | 'freeHitBypassed'
  | 'freeHitGameweek'
  | 'isGw1FreeHit'
>): JSX.Element {
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
      {freeHitBypassed && freeHitGameweek !== null && (
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
    </div>
  );
}

function LoadedView({
  data,
  onChangeTeam,
}: {
  data: MyTeamData;
  onChangeTeam: () => void;
}): JSX.Element {
  const starters = data.starters;

  // Compute real player counts per line from the starters array.
  const defenceCount = starters.filter((p) => p.position === 'GK' || p.position === 'DEF').length;
  const midfieldCount = starters.filter((p) => p.position === 'MID').length;
  const attackCount = starters.filter((p) => p.position === 'FWD').length;

  return (
    <main className="bg-bg text-text min-h-screen font-sans">
      <div className="mx-auto max-w-[800px] px-4 sm:px-8">
        <ManagerHeader
          managerName={data.managerName}
          teamName={data.teamName}
          overallRank={data.overallRank}
          overallPoints={data.overallPoints}
          gameweek={data.gameweek}
          freeHitBypassed={data.freeHitBypassed}
          freeHitGameweek={data.freeHitGameweek}
          isGw1FreeHit={data.isGw1FreeHit}
        />

        <MyTeamHero
          percent={data.teamConfidencePercent}
          defencePercent={data.defencePercent}
          midfieldPercent={data.midfieldPercent}
          attackPercent={data.attackPercent}
        />

        <PositionalBreakdown
          defencePercent={data.defencePercent}
          midfieldPercent={data.midfieldPercent}
          attackPercent={data.attackPercent}
          defenceCount={defenceCount}
          midfieldCount={midfieldCount}
          attackCount={attackCount}
        />

        <StartingXIList starters={starters} />

        <div className="mt-6">
          <BenchSection bench={data.bench} />
        </div>

        <TeamSyncFooter
          syncedAt={data.syncedAt}
          gameweek={data.gameweek}
          onChangeTeam={onChangeTeam}
        />
      </div>
    </main>
  );
}

/**
 * Client orchestrator for the My Team page.
 *
 * Uses useSyncExternalStore to read the stored team ID from localStorage
 * without calling setState in an effect. The async fetch is handled in a
 * separate effect that only calls setState inside async callbacks.
 *
 * State machine:
 *   storedTeamId=null  → show ConnectTeamForm (empty state)
 *   storedTeamId≠null  + fetchState=idle   → loading (fetch in progress)
 *   fetchState=loaded  → show LoadedView
 *   fetchState=error   → show error state
 */
export function MyTeamPageClient(): JSX.Element {
  // Read storedTeamId from localStorage via useSyncExternalStore — avoids setState in effect.
  // Server snapshot returns null (no localStorage on server).
  const storedTeamId = useSyncExternalStore(
    () => (): void => undefined,
    getStoredTeamId,
    () => null,
  );

  const [fetchState, setFetchState] = useState<FetchState>({ kind: 'idle' });

  // Effect only fires when storedTeamId changes; all setState calls are in async callbacks.
  useEffect(() => {
    if (storedTeamId === null) return;

    const controller = new AbortController();

    void fetch(`/api/my-team?teamId=${storedTeamId.toString()}`, { signal: controller.signal })
      .then(async (res) => {
        if (res.ok) {
          const data = (await res.json()) as MyTeamData;
          setFetchState({ kind: 'loaded', data });
        } else {
          localStorage.removeItem(LS_KEY);
          setFetchState({ kind: 'idle' });
        }
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return;
        setFetchState({
          kind: 'error',
          message: 'Could not load your team. Check your connection and try again.',
        });
      });

    return () => {
      controller.abort();
    };
  }, [storedTeamId]);

  function handleFormSuccess(teamId: number, data: MyTeamData): void {
    localStorage.setItem(LS_KEY, teamId.toString());
    setFetchState({ kind: 'loaded', data });
  }

  function handleChangeTeam(): void {
    localStorage.removeItem(LS_KEY);
    setFetchState({ kind: 'idle' });
  }

  if (fetchState.kind === 'loaded') {
    return <LoadedView data={fetchState.data} onChangeTeam={handleChangeTeam} />;
  }

  if (fetchState.kind === 'error') {
    return (
      <main className="bg-bg text-text flex min-h-[calc(100vh-56px)] items-center justify-center px-4">
        <div className="text-center">
          <p className="text-text font-sans text-[15px] font-medium">{fetchState.message}</p>
          <button
            type="button"
            onClick={handleChangeTeam}
            className="text-accent mt-4 cursor-pointer font-sans text-[14px] underline underline-offset-2"
          >
            Try a different team ID
          </button>
        </div>
      </main>
    );
  }

  // Loading state: storedTeamId is known but fetch hasn't completed yet
  if (storedTeamId !== null) {
    return (
      <main
        className="bg-bg text-text flex min-h-[calc(100vh-56px)] items-center justify-center"
        aria-busy="true"
      >
        <div className="text-muted font-sans text-[14px]">Loading your squad…</div>
      </main>
    );
  }

  // Empty state: no team ID in localStorage (or server render)
  return <ConnectTeamForm onSuccess={handleFormSuccess} />;
}
