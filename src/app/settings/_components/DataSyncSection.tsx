'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import type { SyncStatusResponse } from '@/app/api/sync-status/route';
import type { CronSyncPhase } from '@/lib/sync/cronSync';
import { triggerManualSync } from '../actions';

const POLL_INTERVAL_MS = 2_500;

interface DataSyncSectionProps {
  /** Unix ms timestamp from sync_state.completedAt, or null if never synced. */
  readonly initialLastSync: number | null;
  /** Initial sync phase read at page render time. */
  readonly initialPhase: CronSyncPhase;
  /**
   * Override the polling interval in milliseconds.
   * Production default: POLL_INTERVAL_MS (2500).
   * Pass 0 in tests to make polling fire synchronously without fake timers.
   */
  readonly pollIntervalMs?: number;
}

export function formatTimeAgo(syncedAt: number): string {
  const diffMs = Date.now() - syncedAt;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin.toString()} minute${diffMin !== 1 ? 's' : ''} ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr.toString()} hour${diffHr !== 1 ? 's' : ''} ago`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays.toString()} day${diffDays !== 1 ? 's' : ''} ago`;
}

function phaseLabel(phase: CronSyncPhase, batchIndex: number, totalBatches: number): string {
  switch (phase) {
    case 'idle':
      return '';
    case 'player_history': {
      const current = batchIndex + 1;
      const total = totalBatches;
      return `Syncing players (batch ${current.toString()} of ${total.toString()})…`;
    }
    case 'complete':
      return 'Finishing up…';
    case 'failed':
      return 'Sync failed';
  }
}

function isSyncing(phase: CronSyncPhase): boolean {
  return phase === 'player_history' || phase === 'complete';
}

type UIState =
  | { kind: 'idle' }
  | { kind: 'starting' }
  | { kind: 'syncing'; phase: CronSyncPhase; batchIndex: number; totalBatches: number }
  | { kind: 'error'; message: string };

export function DataSyncSection({
  initialLastSync,
  initialPhase,
  pollIntervalMs = POLL_INTERVAL_MS,
}: DataSyncSectionProps): JSX.Element {
  const [uiState, setUiState] = useState<UIState>(
    isSyncing(initialPhase)
      ? { kind: 'syncing', phase: initialPhase, batchIndex: 0, totalBatches: 0 }
      : { kind: 'idle' },
  );
  const [lastSync, setLastSync] = useState<number | null>(initialLastSync);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Stable ref to the schedule function so the setTimeout callback can call the
  // next iteration without a circular useCallback dependency.
  const schedulePollRef = useRef<(() => void) | null>(null);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current !== null) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const schedulePoll = useCallback(() => {
    stopPolling();
    pollTimerRef.current = setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch('/api/sync-status');
          if (!res.ok) return;
          const status: SyncStatusResponse = await (res.json() as Promise<SyncStatusResponse>);

          if (status.phase === 'idle') {
            setUiState({ kind: 'idle' });
            if (status.completedAt !== null) setLastSync(status.completedAt);
            return; // stop polling
          }

          if (status.phase === 'failed') {
            setUiState({
              kind: 'error',
              message: status.error ?? 'Sync failed. Please try again.',
            });
            return; // stop polling
          }

          setUiState({
            kind: 'syncing',
            phase: status.phase,
            batchIndex: status.batchIndex,
            totalBatches: status.totalBatches,
          });
          schedulePollRef.current?.(); // continue via stable ref, not closure
        } catch {
          schedulePollRef.current?.(); // network hiccup — retry
        }
      })();
    }, pollIntervalMs);
  }, [stopPolling, pollIntervalMs]);

  // Keep the ref in sync with the latest schedulePoll.
  useEffect(() => {
    schedulePollRef.current = schedulePoll;
  }, [schedulePoll]);

  // Start polling on mount if the server-rendered phase indicates a sync is already in progress.
  useEffect(() => {
    if (isSyncing(initialPhase)) schedulePoll();
    return stopPolling;
  }, [initialPhase, schedulePoll, stopPolling]);

  async function handleRefresh(): Promise<void> {
    setUiState({ kind: 'starting' });
    const result = await triggerManualSync();
    if (!result.ok) {
      setUiState({ kind: 'error', message: result.error });
      return;
    }
    // First batch has started — begin polling for status
    schedulePoll();
  }

  const isDisabled = uiState.kind === 'starting' || uiState.kind === 'syncing';

  function buttonLabel(): string {
    if (uiState.kind === 'starting') return 'Starting…';
    if (uiState.kind === 'syncing') return 'Syncing…';
    return 'Refresh now';
  }

  function statusLine(): string {
    if (uiState.kind === 'starting') return 'Connecting…';
    if (uiState.kind === 'syncing') {
      return phaseLabel(uiState.phase, uiState.batchIndex, uiState.totalBatches);
    }
    if (lastSync !== null) return `Last synced ${formatTimeAgo(lastSync)}`;
    return 'Never synced';
  }

  return (
    <div className="space-y-4">
      {/* Timestamp / progress row */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-text font-sans text-[14px] font-medium">Confidence data</p>
          <p className="text-muted mt-0.5 font-sans text-[13px]">{statusLine()}</p>
          <p className="text-muted mt-0.5 font-sans text-[12px] opacity-70">
            Auto-syncs daily at 12:00 UTC
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            void handleRefresh();
          }}
          disabled={isDisabled}
          className={[
            'border-border bg-surface text-text rounded-[6px] border px-4 font-sans text-[13px] font-medium',
            'h-9 cursor-pointer transition-colors',
            'hover:border-muted focus-visible:ring-2 focus-visible:outline-none',
            'focus-visible:ring-accent focus-visible:ring-offset-2',
            'active:opacity-80 disabled:cursor-not-allowed disabled:opacity-50',
          ].join(' ')}
          aria-live="polite"
        >
          {buttonLabel()}
        </button>
      </div>

      {/* Inline error */}
      {uiState.kind === 'error' && (
        <p role="alert" className="text-negative font-sans text-[13px]">
          {uiState.message}
        </p>
      )}
    </div>
  );
}
