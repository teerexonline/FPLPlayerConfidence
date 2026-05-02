'use client';

import { useState, useSyncExternalStore, type JSX } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { updateFplManagerIdAction } from '@/app/actions/updateFplManagerId';

const LS_KEY = 'fpl-team-id';

export interface TeamConnectionSectionProps {
  /** True when a Supabase session is active (server-rendered). */
  readonly isAuthenticated: boolean;
  /**
   * fpl_manager_id from user_profiles (server-rendered).
   * Null when unauthenticated or when the profile row has no team ID.
   * Takes precedence over localStorage when non-null.
   */
  readonly profileTeamId: number | null;
}

type DisconnectState = 'idle' | 'confirming' | 'disconnecting';
type SaveState = 'idle' | 'saving' | 'error';

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

export function TeamConnectionSection({
  isAuthenticated,
  profileTeamId,
}: TeamConnectionSectionProps): JSX.Element {
  const router = useRouter();

  // Auth users: state is driven by profileTeamId (server prop) and updated by
  // actions. storedTeamId is the SSR-safe localStorage read for anonymous users.
  const [authTeamId, setAuthTeamId] = useState<number | null>(profileTeamId);

  const storedTeamId = useSyncExternalStore(
    () => (): void => undefined,
    getStoredTeamId,
    () => null,
  );

  // Profile value takes precedence when authenticated; localStorage drives anon.
  const teamId = isAuthenticated ? authTeamId : storedTeamId;

  const [inputValue, setInputValue] = useState('');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [disconnectState, setDisconnectState] = useState<DisconnectState>('idle');

  // ── Handlers ────────────────────────────────────────────────────────────────

  async function handleConnect(): Promise<void> {
    const parsed = parseInt(inputValue.trim(), 10);
    if (isNaN(parsed) || parsed <= 0) return;

    setSaveState('saving');
    const { error } = await updateFplManagerIdAction(parsed);
    if (error !== null) {
      setSaveState('error');
      return;
    }
    localStorage.setItem(LS_KEY, String(parsed));
    setAuthTeamId(parsed);
    setInputValue('');
    setSaveState('idle');
  }

  async function handleDisconnect(): Promise<void> {
    if (disconnectState === 'idle') {
      setDisconnectState('confirming');
      return;
    }
    if (disconnectState !== 'confirming') return;

    setDisconnectState('disconnecting');
    localStorage.removeItem(LS_KEY);

    if (isAuthenticated) {
      await updateFplManagerIdAction(null);
      setAuthTeamId(null);
      setDisconnectState('idle');
      // Stay on settings so the user can reconnect inline.
    } else {
      router.push('/');
    }
  }

  function handleCancelDisconnect(): void {
    setDisconnectState('idle');
  }

  // ── Disconnected state ───────────────────────────────────────────────────────

  if (teamId === null) {
    if (isAuthenticated) {
      return (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleConnect();
          }}
          className="space-y-3"
        >
          <div>
            <p className="text-text font-sans text-[14px] font-medium">No team connected</p>
            <p className="text-muted mt-0.5 font-sans text-[13px]">
              Enter your FPL manager ID to see personalised confidence data.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1">
              <label
                htmlFor="fpl-manager-id-input"
                className="text-muted font-sans text-[12px] font-medium"
              >
                FPL Manager ID
              </label>
              <input
                id="fpl-manager-id-input"
                type="number"
                min="1"
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  setSaveState('idle');
                }}
                placeholder="e.g. 231177"
                disabled={saveState === 'saving'}
                className={[
                  'border-border bg-surface text-text rounded-[6px] border px-3 font-sans text-[13px]',
                  'h-9 w-40 focus:ring-2 focus:ring-offset-1 focus:outline-none',
                  'focus:ring-accent disabled:opacity-50',
                  saveState === 'error' ? 'border-negative focus:ring-negative' : '',
                ].join(' ')}
              />
            </div>
            <button
              type="submit"
              disabled={saveState === 'saving' || !inputValue.trim()}
              className={[
                'bg-accent h-9 rounded-[6px] px-4 font-sans text-[13px] font-medium text-white',
                'flex shrink-0 cursor-pointer items-center transition-opacity',
                'hover:opacity-90 focus-visible:ring-2 focus-visible:outline-none',
                'focus-visible:ring-accent focus-visible:ring-offset-2',
                'disabled:cursor-not-allowed disabled:opacity-50',
              ].join(' ')}
            >
              {saveState === 'saving' ? 'Connecting…' : 'Connect'}
            </button>
          </div>
          {saveState === 'error' && (
            <p className="text-negative font-sans text-[12px]">
              Failed to connect. Please try again.
            </p>
          )}
        </form>
      );
    }

    // Anonymous user: link to /my-team (existing behaviour).
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

  // ── Connected state ──────────────────────────────────────────────────────────

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-text font-sans text-[14px] font-medium">
            Team ID <span className="text-muted font-mono text-[13px] font-normal">{teamId}</span>
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
            onClick={() => void handleDisconnect()}
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
