'use client';

import { useState, useEffect, useSyncExternalStore } from 'react';
import type { JSX } from 'react';
import { ConnectTeamForm } from './ConnectTeamForm';
import { computeFormation } from './computeFormation';
import { GwControlBar } from './GwControlBar';
import { GwTimeline } from './GwTimeline';
import { ManagerHeader } from './ManagerHeader';
import { MyTeamHero } from './MyTeamHero';
import { PositionalBreakdown } from './PositionalBreakdown';
import { StartingXIList } from './StartingXIList';
import { BenchSection } from './BenchSection';
import { TeamSyncFooter } from './TeamSyncFooter';
import { TransferModal } from './TransferModal';
import type { MyTeamData, MyTeamApiError, SquadPlayerRow } from './types';
import type { Swap } from '@/lib/transfer-planner';

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
  onRequestSwap,
  onClearSwaps,
  stagedSwapCount,
}: {
  data: MyTeamData;
  selectedGw: number;
  availableGwSet: ReadonlySet<number>;
  onSelectGw: (gw: number) => void;
  onChangeTeam: () => void;
  onRequestSwap: (player: SquadPlayerRow) => void;
  onClearSwaps: () => void;
  stagedSwapCount: number;
}): JSX.Element {
  const starters = data.starters;
  const formation = computeFormation(starters);

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
          lastGameweek={data.lastSeasonGameweek}
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

        <GwControlBar
          formation={formation}
          selectedGw={selectedGw}
          currentGameweek={data.currentGameweek}
          firstGameweek={firstGw}
          lastGameweek={data.lastSeasonGameweek}
          onSelectGw={onSelectGw}
        />

        {data.viewMode === 'projected' && stagedSwapCount > 0 && (
          <div className="mb-3 flex items-center justify-between rounded-[8px] border border-dashed border-blue-500/40 bg-blue-500/5 px-4 py-2.5">
            <p className="text-text font-sans text-[13px]">
              {stagedSwapCount.toString()} staged transfer{stagedSwapCount !== 1 ? 's' : ''}
            </p>
            <button
              type="button"
              onClick={onClearSwaps}
              className="text-muted hover:text-text font-sans text-[12px] underline underline-offset-2 transition-colors"
            >
              Clear
            </button>
          </div>
        )}

        <StartingXIList
          starters={starters}
          viewMode={data.viewMode}
          {...(data.viewMode === 'projected' ? { onRequestSwap } : {})}
        />

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
function swapsToParam(swaps: readonly Swap[]): string {
  return swaps.map((s) => `${s.outId.toString()}:${s.inId.toString()}`).join(',');
}

export function MyTeamPageClient(): JSX.Element {
  // Read storedTeamId from localStorage via useSyncExternalStore — avoids setState in effect.
  // Server snapshot returns null (no localStorage on server).
  const storedTeamId = useSyncExternalStore(
    () => (): void => undefined,
    getStoredTeamId,
    () => null,
  );

  const [fetchState, setFetchState] = useState<FetchState>({ kind: 'idle' });
  /** Staged transfers — append as ?swap= to projected-mode fetches. */
  const [stagedSwaps, setStagedSwaps] = useState<readonly Swap[]>([]);
  /** The player whose swap button was clicked; drives modal open/close. */
  const [swappingOut, setSwappingOut] = useState<SquadPlayerRow | null>(null);

  // Fetches squad data for a given base URL, appending staged swaps if present.
  // `existingState` carries forward the available-GW set so the scrubber
  // timeline doesn't flicker when the user switches GWs.
  function doFetch(
    baseUrl: string,
    swaps: readonly Swap[],
    existingState?: Extract<FetchState, { kind: 'loaded' }>,
  ): void {
    const url = swaps.length > 0 ? `${baseUrl}&swap=${swapsToParam(swaps)}` : baseUrl;
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
          } else if (existingState !== undefined) {
            // Historical GW navigation failed (e.g. FPL returned 404 for a GW
            // the manager didn't play, or a transient error). Restore the
            // previous loaded state — the user stays connected and the scrubber
            // remains usable at the last successfully fetched GW.
            setFetchState(existingState);
          } else {
            localStorage.removeItem(LS_KEY);
            setFetchState({ kind: 'idle' });
          }
        }
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return;
        if (existingState !== undefined) {
          setFetchState(existingState);
          return;
        }
        setFetchState({
          kind: 'error',
          message: 'Could not load your team. Check your connection and try again.',
        });
      });
  }

  // Effect only fires when storedTeamId changes; all setState calls are in async callbacks.
  useEffect(() => {
    if (storedTeamId === null) return;
    doFetch(`/api/my-team?teamId=${storedTeamId.toString()}`, []);
  }, [storedTeamId]);

  function handleSelectGw(gw: number): void {
    if (storedTeamId === null || fetchState.kind !== 'loaded') return;
    const existing = fetchState;
    doFetch(
      `/api/my-team?teamId=${storedTeamId.toString()}&gameweek=${gw.toString()}`,
      stagedSwaps,
      existing,
    );
  }

  function handleRequestSwap(player: SquadPlayerRow): void {
    setSwappingOut(player);
  }

  function handleSwapSelect(inId: number): void {
    if (swappingOut === null || fetchState.kind !== 'loaded' || storedTeamId === null) return;
    const outId = swappingOut.playerId;
    // Replace any existing swap for this outId, otherwise append.
    const newSwaps: readonly Swap[] = [
      ...stagedSwaps.filter((s) => s.outId !== outId),
      { outId, inId },
    ];
    setStagedSwaps(newSwaps);
    setSwappingOut(null);
    const existing = fetchState;
    doFetch(
      `/api/my-team?teamId=${storedTeamId.toString()}&gameweek=${existing.selectedGw.toString()}`,
      newSwaps,
      existing,
    );
  }

  function handleClearSwaps(): void {
    setStagedSwaps([]);
    if (fetchState.kind !== 'loaded' || storedTeamId === null) return;
    const existing = fetchState;
    doFetch(
      `/api/my-team?teamId=${storedTeamId.toString()}&gameweek=${existing.selectedGw.toString()}`,
      [],
      existing,
    );
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
    const squadPlayerIds = new Set([
      ...fetchState.data.starters.map((p) => p.playerId),
      ...fetchState.data.bench.map((p) => p.playerId),
    ]);
    const stagedInIds = new Set(stagedSwaps.map((s) => s.inId));

    return (
      <>
        <LoadedView
          data={fetchState.data}
          selectedGw={fetchState.selectedGw}
          availableGwSet={fetchState.availableGwSet}
          onSelectGw={handleSelectGw}
          onChangeTeam={handleChangeTeam}
          onRequestSwap={handleRequestSwap}
          onClearSwaps={handleClearSwaps}
          stagedSwapCount={stagedSwaps.length}
        />
        {swappingOut !== null && (
          <TransferModal
            playerOut={swappingOut}
            squadPlayerIds={squadPlayerIds}
            stagedInIds={stagedInIds}
            onSelect={handleSwapSelect}
            onClose={() => {
              setSwappingOut(null);
            }}
          />
        )}
      </>
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
