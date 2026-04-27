'use client';

import { useState, useId } from 'react';
import type { JSX } from 'react';
import type { MyTeamData, MyTeamApiError } from './types';

interface ConnectTeamFormProps {
  /** Called with the validated team ID and the loaded data when submission succeeds. */
  readonly onSuccess: (teamId: number, data: MyTeamData) => void;
  /** Called with the team ID when the route returns PRE_SEASON, instead of showing an error. */
  readonly onPreSeason?: (teamId: number) => void;
}

type FormState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error'; code: MyTeamApiError | 'VALIDATION' };

function errorMessage(code: MyTeamApiError | 'VALIDATION'): string {
  switch (code) {
    case 'VALIDATION':
      return 'Please enter a valid numeric team ID.';
    case 'NOT_FOUND':
      return 'Team not found. Check your team ID and try again.';
    case 'INVALID_TEAM_ID':
      return 'Please enter a valid numeric team ID.';
    case 'NETWORK_ERROR':
      return 'Could not reach the FPL servers. Check your connection and try again.';
    case 'NO_GAMEWEEK_DATA':
      return 'No gameweek data available yet. Run a sync first.';
    case 'SCHEMA_ERROR':
      return 'The FPL API returned an unexpected response. Try again shortly.';
    case 'PRE_SEASON':
      return "The season hasn't started yet. Your team will appear once GW1 kicks off.";
  }
}

export function ConnectTeamForm({ onSuccess, onPreSeason }: ConnectTeamFormProps): JSX.Element {
  const [state, setState] = useState<FormState>({ kind: 'idle' });
  const [value, setValue] = useState('');
  const inputId = useId();
  const errorId = useId();

  async function handleSubmit(): Promise<void> {
    const trimmed = value.trim();
    if (!/^\d+$/.test(trimmed) || trimmed.length === 0) {
      setState({ kind: 'error', code: 'VALIDATION' });
      return;
    }

    setState({ kind: 'loading' });

    try {
      const res = await fetch(`/api/my-team?teamId=${trimmed}`);
      if (res.ok) {
        const data = (await res.json()) as MyTeamData;
        onSuccess(parseInt(trimmed, 10), data);
      } else {
        const body = (await res.json()) as { error: MyTeamApiError };
        if (body.error === 'PRE_SEASON' && onPreSeason) {
          onPreSeason(parseInt(trimmed, 10));
        } else {
          setState({ kind: 'error', code: body.error });
        }
      }
    } catch {
      setState({ kind: 'error', code: 'NETWORK_ERROR' });
    }
  }

  const isLoading = state.kind === 'loading';
  const hasError = state.kind === 'error';

  return (
    <main className="bg-bg text-text flex min-h-[calc(100vh-56px)] items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="border-border bg-surface rounded-[12px] border px-8 py-10">
          {/* Icon mark */}
          <div className="border-border mb-6 inline-flex h-10 w-10 items-center justify-center rounded-[8px] border">
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"
                stroke="currentColor"
                strokeWidth={1.75}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-muted"
              />
              <circle
                cx={9}
                cy={7}
                r={4}
                stroke="currentColor"
                strokeWidth={1.75}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-muted"
              />
              <path
                d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"
                stroke="currentColor"
                strokeWidth={1.75}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-muted"
              />
            </svg>
          </div>

          {/* Heading — Fraunces for the invitation moment */}
          <h1 className="font-display mb-2 text-[26px] leading-tight font-[400] tracking-[-0.01em]">
            Connect your FPL team
          </h1>
          <p className="text-muted mb-8 font-sans text-[14px] leading-relaxed">
            Enter your FPL team ID to see your squad&apos;s confidence breakdown, positional
            ratings, and captain context.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSubmit();
            }}
            noValidate
          >
            {/* Label */}
            <label
              htmlFor={inputId}
              className="text-text mb-1.5 block font-sans text-[13px] font-medium"
            >
              FPL Team ID
            </label>

            {/* Input */}
            <input
              id={inputId}
              type="text"
              inputMode="numeric"
              pattern="\d*"
              autoComplete="off"
              spellCheck={false}
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                if (state.kind === 'error') setState({ kind: 'idle' });
              }}
              placeholder="e.g. 231177"
              disabled={isLoading}
              aria-describedby={`${inputId}-hint ${hasError ? errorId : ''}`.trim()}
              aria-invalid={hasError}
              className={[
                'border-border bg-bg text-text placeholder:text-muted w-full rounded-[6px] border px-3 font-sans',
                'h-10 text-[14px] transition-[box-shadow] outline-none',
                'focus-visible:ring-accent focus-visible:ring-2 focus-visible:ring-offset-1',
                hasError ? 'border-negative' : '',
                isLoading ? 'cursor-not-allowed opacity-60' : '',
              ].join(' ')}
            />

            {/* Helper text */}
            <p
              id={`${inputId}-hint`}
              className="text-muted mt-2 font-sans text-[12px] leading-relaxed"
            >
              Find your team ID in the URL on the FPL website:{' '}
              <span className="font-mono text-[11px]">
                fantasy.premierleague.com/entry/
                <span className="text-accent font-semibold">12345678</span>
                /…
              </span>
            </p>

            {/* Inline error */}
            {hasError && (
              <p
                id={errorId}
                role="alert"
                className="text-negative mt-2 font-sans text-[13px] font-medium"
              >
                {errorMessage(state.code)}
              </p>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={isLoading}
              className={[
                'bg-accent mt-6 w-full rounded-[6px] px-4 font-sans text-[14px] font-medium text-white',
                'h-9 cursor-pointer transition-opacity',
                'hover:opacity-90 focus-visible:ring-2 focus-visible:outline-none',
                'focus-visible:ring-accent focus-visible:ring-offset-2',
                'active:opacity-80 disabled:cursor-not-allowed disabled:opacity-50',
              ].join(' ')}
            >
              {isLoading ? 'Loading…' : 'Load my team'}
            </button>
          </form>
        </div>

        {/* Footer hint */}
        <p className="text-muted mt-6 text-center font-sans text-[12px]">
          Your team ID is stored locally in your browser — never sent to our servers.
        </p>
      </div>
    </main>
  );
}
