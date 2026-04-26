'use client';

import { useState } from 'react';
import type { JSX } from 'react';
import { triggerSync } from '../actions';

interface DataSyncSectionProps {
  /** Unix ms timestamp from sync_meta.last_sync, or null if never synced. */
  readonly initialLastSync: number | null;
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

type SyncState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'success'; syncedAt: number }
  | { kind: 'error'; message: string };

export function DataSyncSection({ initialLastSync }: DataSyncSectionProps): JSX.Element {
  const [syncState, setSyncState] = useState<SyncState>({ kind: 'idle' });

  const displayedLastSync = syncState.kind === 'success' ? syncState.syncedAt : initialLastSync;

  async function handleRefresh(): Promise<void> {
    setSyncState({ kind: 'loading' });
    try {
      const result = await triggerSync();
      if (result.ok) {
        setSyncState({ kind: 'success', syncedAt: result.syncedAt });
        setTimeout(() => {
          setSyncState({ kind: 'idle' });
        }, 4_000);
      } else {
        setSyncState({ kind: 'error', message: result.error });
      }
    } catch {
      setSyncState({ kind: 'error', message: 'Network error. Please try again.' });
    }
  }

  const isLoading = syncState.kind === 'loading';
  const isSuccess = syncState.kind === 'success';
  const isError = syncState.kind === 'error';

  return (
    <div className="space-y-4">
      {/* Timestamp row */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-text font-sans text-[14px] font-medium">Confidence data</p>
          <p className="text-muted mt-0.5 font-sans text-[13px]">
            {displayedLastSync !== null
              ? `Last synced ${formatTimeAgo(displayedLastSync)}`
              : 'Never synced'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            void handleRefresh();
          }}
          disabled={isLoading}
          className={[
            'border-border bg-surface text-text rounded-[6px] border px-4 font-sans text-[13px] font-medium',
            'h-9 cursor-pointer transition-colors',
            'hover:border-muted focus-visible:ring-2 focus-visible:outline-none',
            'focus-visible:ring-accent focus-visible:ring-offset-2',
            'active:opacity-80 disabled:cursor-not-allowed disabled:opacity-50',
            isSuccess ? 'text-positive border-positive' : '',
          ].join(' ')}
          aria-live="polite"
        >
          {isLoading && 'Syncing…'}
          {isSuccess && 'Synced ✓'}
          {!isLoading && !isSuccess && 'Refresh data'}
        </button>
      </div>

      {/* Inline error */}
      {isError && (
        <p role="alert" className="text-negative font-sans text-[13px]">
          {syncState.message}
        </p>
      )}
    </div>
  );
}
