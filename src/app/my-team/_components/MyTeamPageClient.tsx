'use client';

import { useState, useEffect, useSyncExternalStore } from 'react';
import type { JSX } from 'react';
import { ConnectTeamForm } from './ConnectTeamForm';
import { GwTimeline } from './GwTimeline';
import { ManagerHeader } from './ManagerHeader';
import { MyTeamHero } from './MyTeamHero';
import { PositionalBreakdown } from './PositionalBreakdown';
import { StartingXIList } from './StartingXIList';
import { BenchSection } from './BenchSection';
import { TeamSyncFooter } from './TeamSyncFooter';
import type { MyTeamData, MyTeamApiError } from './types';

const LS_KEY = 'fpl-team-id';

type FetchState =
  | { kind: 'idle' }
  | { kind: 'loaded'; data: MyTeamData; selectedGw: number; availableGwSet: ReadonlySet<number> }
  | { kind: 'error'; message: string }
  | { kind: 'pre_season' };

function getStoredTeamId(): number | null {
  const stored = localStorage.getItem(LS_KEY);
  if (!stored) return null;
  const teamId = parseInt(stored, 10);
  return isNaN(teamId) ? null : teamId;
}

function LoadedView({
  data,
  selectedGw,
  availableGwSet,
  onSelectGw,
  onChangeTeam,
}: {
  data: MyTeamData;
  selectedGw: number;
  availableGwSet: ReadonlySet<number>;
  onSelectGw: (gw: number) => void;
  onChangeTeam: () => void;
}): JSX.Element {
  const starters = data.starters;

  // Compute real player counts per line from the starters array.
  const defenceCount = starters.filter((p) => p.position === 'GK' || p.position === 'DEF').length;
  const midfieldCount = starters.filter((p) => p.position === 'MID').length;
  const attackCount = starters.filter((p) => p.position === 'FWD').length;

  // Earliest GW for which we have (or can fetch) squad data.
  // All GWs from firstGw to currentGameweek are shown as clickable pills;
  // GWs before firstGw remain "—" (no squad data and none fetchable).
  const firstGw = availableGwSet.size > 0 ? Math.min(...availableGwSet) : data.currentGameweek;

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
          preDeadlineFallback={data.preDeadlineFallback}
        />

        <GwTimeline
          currentGameweek={data.currentGameweek}
          firstGameweek={firstGw}
          selectedGw={selectedGw}
          onSelectGw={onSelectGw}
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

  // Fetches squad data for a given URL and updates state.
  // `preserveAvailableGws` carries forward the existing available-GW set so
  // that the scrubber timeline doesn't flicker when the user switches GWs.
  function doFetch(url: string, existingState?: Extract<FetchState, { kind: 'loaded' }>): void {
    const controller = new AbortController();

    void fetch(url, { signal: controller.signal })
      .then(async (res) => {
        if (res.ok) {
          const data = (await res.json()) as MyTeamData;
          // Merge available GWs: union of existing set + new response.
          const merged = new Set(existingState?.availableGwSet ?? []);
          for (const gw of data.availableGameweeks) merged.add(gw);
          setFetchState({
            kind: 'loaded',
            data,
            selectedGw: data.gameweek,
            availableGwSet: merged,
          });
        } else {
          const body = (await res.json()) as { error: MyTeamApiError };
          if (body.error === 'PRE_SEASON') {
            setFetchState({ kind: 'pre_season' });
          } else {
            localStorage.removeItem(LS_KEY);
            setFetchState({ kind: 'idle' });
          }
        }
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return;
        setFetchState({
          kind: 'error',
          message: 'Could not load your team. Check your connection and try again.',
        });
      });
  }

  // Effect only fires when storedTeamId changes; all setState calls are in async callbacks.
  useEffect(() => {
    if (storedTeamId === null) return;
    doFetch(`/api/my-team?teamId=${storedTeamId.toString()}`);
  }, [storedTeamId]);

  function handleSelectGw(gw: number): void {
    if (storedTeamId === null || fetchState.kind !== 'loaded') return;
    const existing = fetchState;
    doFetch(`/api/my-team?teamId=${storedTeamId.toString()}&gameweek=${gw.toString()}`, existing);
  }

  function handleFormSuccess(teamId: number, data: MyTeamData): void {
    localStorage.setItem(LS_KEY, teamId.toString());
    setFetchState({
      kind: 'loaded',
      data,
      selectedGw: data.gameweek,
      availableGwSet: new Set(data.availableGameweeks),
    });
  }

  function handlePreSeason(teamId: number): void {
    localStorage.setItem(LS_KEY, teamId.toString());
    setFetchState({ kind: 'pre_season' });
  }

  function handleChangeTeam(): void {
    localStorage.removeItem(LS_KEY);
    setFetchState({ kind: 'idle' });
  }

  if (fetchState.kind === 'loaded') {
    return (
      <LoadedView
        data={fetchState.data}
        selectedGw={fetchState.selectedGw}
        availableGwSet={fetchState.availableGwSet}
        onSelectGw={handleSelectGw}
        onChangeTeam={handleChangeTeam}
      />
    );
  }

  if (fetchState.kind === 'pre_season') {
    return (
      <main className="bg-bg text-text flex min-h-[calc(100vh-56px)] items-center justify-center px-4">
        <div className="text-center">
          <p className="text-text font-sans text-[15px] font-medium">
            Your team will appear once the season starts
          </p>
          <button
            type="button"
            onClick={handleChangeTeam}
            className="text-accent mt-4 cursor-pointer font-sans text-[14px] underline underline-offset-2"
          >
            Use a different team ID
          </button>
        </div>
      </main>
    );
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
  return <ConnectTeamForm onSuccess={handleFormSuccess} onPreSeason={handlePreSeason} />;
}
