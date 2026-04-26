'use client';

import { useState, useSyncExternalStore } from 'react';
import type { JSX } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const LS_KEY = 'fpl-team-id';

type SectionState = { kind: 'disconnected' } | { kind: 'connected'; teamId: number };

type DisconnectState = 'idle' | 'confirming' | 'disconnecting';

function getStoredTeamId(): number | null {
  const stored = localStorage.getItem(LS_KEY);
  if (!stored) return null;
  const teamId = parseInt(stored, 10);
  if (isNaN(teamId)) {
    // Eagerly clean up invalid values so they don't persist across sessions.
    localStorage.removeItem(LS_KEY);
    return null;
  }
  return teamId;
}

export function TeamConnectionSection(): JSX.Element {
  const router = useRouter();
  // useSyncExternalStore returns a primitive (number | null) to avoid infinite re-render
  // loops that occur when getSnapshot returns a new object reference on each call.
  const storedTeamId = useSyncExternalStore(
    () => (): void => undefined,
    getStoredTeamId,
    () => null,
  );
  const state: SectionState =
    storedTeamId !== null ? { kind: 'connected', teamId: storedTeamId } : { kind: 'disconnected' };
  const [disconnectState, setDisconnectState] = useState<DisconnectState>('idle');

  function handleDisconnect(): void {
    if (disconnectState === 'idle') {
      setDisconnectState('confirming');
      return;
    }
    if (disconnectState === 'confirming') {
      setDisconnectState('disconnecting');
      localStorage.removeItem(LS_KEY);
      router.push('/');
    }
  }

  function handleCancelDisconnect(): void {
    setDisconnectState('idle');
  }

  if (state.kind === 'disconnected') {
    return (
      <div className="flex items-center justify-between">
        <div>
          <p className="text-text font-sans text-[14px] font-medium">No team connected</p>
          <p className="text-muted mt-0.5 font-sans text-[13px]">
            Connect your FPL team to see personalised confidence data.
          </p>
        </div>
        <Link
          href="/my-team"
          className={[
            'bg-accent rounded-[6px] px-4 font-sans text-[13px] font-medium text-white',
            'flex h-9 shrink-0 cursor-pointer items-center transition-opacity',
            'hover:opacity-90 focus-visible:ring-2 focus-visible:outline-none',
            'focus-visible:ring-accent focus-visible:ring-offset-2',
          ].join(' ')}
        >
          Connect a team
        </Link>
      </div>
    );
  }

  // Connected state
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-text font-sans text-[14px] font-medium">
            Team ID{' '}
            <span className="text-muted font-mono text-[13px] font-normal">{state.teamId}</span>
          </p>
          <p className="text-muted mt-0.5 font-sans text-[13px]">Your FPL team is connected.</p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/my-team"
            className={[
              'border-border bg-surface text-text rounded-[6px] border px-4 font-sans text-[13px] font-medium',
              'flex h-9 cursor-pointer items-center transition-colors',
              'hover:border-muted focus-visible:ring-2 focus-visible:outline-none',
              'focus-visible:ring-accent focus-visible:ring-offset-2',
            ].join(' ')}
          >
            View team
          </Link>

          <button
            type="button"
            onClick={handleDisconnect}
            disabled={disconnectState === 'disconnecting'}
            className={[
              'h-9 rounded-[6px] border px-4 font-sans text-[13px] font-medium',
              'cursor-pointer transition-colors focus-visible:outline-none',
              'focus-visible:ring-2 focus-visible:ring-offset-2',
              'disabled:cursor-not-allowed disabled:opacity-50',
              disconnectState === 'confirming'
                ? 'border-negative text-negative focus-visible:ring-negative'
                : 'border-border bg-surface text-muted hover:text-negative hover:border-negative focus-visible:ring-accent',
            ].join(' ')}
          >
            {disconnectState === 'confirming' ? 'Confirm disconnect' : 'Disconnect'}
          </button>
        </div>
      </div>

      {/* Inline cancel — appears only during confirm state */}
      {disconnectState === 'confirming' && (
        <p className="text-muted font-sans text-[12px]">
          This will clear your team from this browser.{' '}
          <button
            type="button"
            onClick={handleCancelDisconnect}
            className="text-text focus-visible:ring-accent cursor-pointer underline underline-offset-2 hover:no-underline focus-visible:ring-1 focus-visible:outline-none"
          >
            Cancel
          </button>
        </p>
      )}
    </div>
  );
}
