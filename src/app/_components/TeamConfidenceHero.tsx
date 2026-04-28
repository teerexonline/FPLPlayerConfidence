'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { JSX } from 'react';
import type { MyTeamData } from '@/app/my-team/_components/types';

const LS_KEY = 'fpl-team-id';

type HeroState =
  | { kind: 'hydrating' }
  | { kind: 'absent' }
  | { kind: 'loading' }
  | { kind: 'loaded'; data: MyTeamData }
  | { kind: 'error' };

function sign(pct: number): 'positive' | 'negative' | 'neutral' {
  if (pct > 50) return 'positive';
  if (pct < 50) return 'negative';
  return 'neutral';
}

/** Stat pill shown inside the loaded card. */
function StatPill({ label, pct }: { label: string; pct: number }): JSX.Element {
  const s = sign(pct);
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span
        className="font-mono text-[13px] font-semibold tabular-nums"
        data-sign={s}
        style={{
          color:
            s === 'positive'
              ? 'var(--color-positive)'
              : s === 'negative'
                ? 'var(--color-negative)'
                : 'var(--color-muted)',
        }}
      >
        {pct.toFixed(1)}%
      </span>
      <span className="text-muted font-sans text-[10px] tracking-[0.05em] uppercase">{label}</span>
    </div>
  );
}

function LoadedCard({ data }: { data: MyTeamData }): JSX.Element {
  const s = sign(data.teamConfidencePercent);
  const accentColor =
    s === 'positive'
      ? 'var(--color-positive)'
      : s === 'negative'
        ? 'var(--color-negative)'
        : 'var(--color-muted)';

  return (
    <Link
      href="/my-team"
      className="border-border bg-surface group focus-visible:ring-accent flex flex-col rounded-[8px] border px-4 pt-5 pb-4 transition-colors hover:border-[var(--color-accent)] focus-visible:ring-2 focus-visible:outline-none"
      aria-label="My Team Confidence — view full breakdown"
    >
      <h2 className="text-muted mb-3 font-sans text-[11px] font-semibold tracking-[0.06em] uppercase">
        My Team
      </h2>

      {/* Big number */}
      <div className="flex flex-col">
        <span
          className="font-mono text-[40px] leading-none font-semibold tabular-nums"
          style={{ color: accentColor }}
        >
          {data.teamConfidencePercent.toFixed(1)}%
        </span>
        <span className="text-muted mt-1 font-sans text-[12px]">Team Confidence</span>
      </div>

      {/* Positional pills — full card width, no overflow risk */}
      <div className="mt-3 flex justify-between">
        <StatPill label="Def" pct={data.defencePercent} />
        <StatPill label="Mid" pct={data.midfieldPercent} />
        <StatPill label="Att" pct={data.attackPercent} />
      </div>

      <p className="text-muted mt-2 font-sans text-[11px]">
        {data.teamName} · GW{data.gameweek.toString()}
      </p>
    </Link>
  );
}

function CtaCard(): JSX.Element {
  return (
    <section
      className="border-border bg-surface flex flex-col rounded-[8px] border px-4 pt-5 pb-4"
      aria-label="My Team"
    >
      <h2 className="text-muted mb-4 font-sans text-[11px] font-semibold tracking-[0.06em] uppercase">
        My Team
      </h2>

      <div className="flex h-[168px] flex-col items-center justify-center gap-3">
        {/* Shield icon */}
        <svg
          width={28}
          height={28}
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          className="text-border"
        >
          <path
            d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        <div className="text-center">
          <p className="text-text font-sans text-[14px] font-medium">No team connected</p>
          <p className="text-muted mt-1 max-w-[200px] font-sans text-[12px] leading-snug">
            Connect your FPL team ID to see your squad confidence.
          </p>
        </div>

        <Link
          href="/my-team"
          className="border-border bg-bg text-text hover:border-accent hover:text-accent focus-visible:ring-accent inline-flex h-8 items-center rounded-[6px] border px-3 font-sans text-[12px] font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          Connect team
        </Link>
      </div>
    </section>
  );
}

/**
 * Dashboard widget that reads localStorage for a stored FPL team ID.
 * If found, fetches /api/my-team and shows the team confidence percentage.
 * Otherwise renders a CTA linking to /my-team.
 *
 * Rendered as the third card in the dashboard hero strip, replacing WatchlistCard
 * when this feature ships. WatchlistCard is preserved for the existing layout
 * until the watchlist feature is built out.
 */
export function TeamConfidenceHero(): JSX.Element {
  const [state, setState] = useState<HeroState>({ kind: 'hydrating' });

  useEffect(() => {
    const stored = localStorage.getItem(LS_KEY);
    if (!stored) {
      // Synchronous setState for localStorage hydration — browser-only, intentional.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState({ kind: 'absent' });
      return;
    }

    const teamId = parseInt(stored, 10);
    if (isNaN(teamId)) {
      localStorage.removeItem(LS_KEY);
      setState({ kind: 'absent' });
      return;
    }

    setState({ kind: 'loading' });

    void fetch(`/api/my-team?teamId=${teamId.toString()}`)
      .then(async (res) => {
        if (res.ok) {
          const data = (await res.json()) as MyTeamData;
          setState({ kind: 'loaded', data });
        } else {
          setState({ kind: 'error' });
        }
      })
      .catch(() => {
        setState({ kind: 'error' });
      });
  }, []);

  // Hydrating / loading: render a skeleton that matches the CtaCard height.
  if (state.kind === 'hydrating' || state.kind === 'loading') {
    return (
      <section
        className="border-border bg-surface flex flex-col rounded-[8px] border px-4 pt-5 pb-4"
        aria-label="My Team"
        aria-busy="true"
      >
        <div className="text-muted mb-4 h-3 w-14 animate-pulse rounded bg-current font-sans text-[11px] font-semibold tracking-[0.06em] uppercase opacity-20" />
        <div className="flex h-[168px] flex-col items-center justify-center gap-4">
          <div className="text-border h-7 w-7 animate-pulse rounded bg-current opacity-20" />
          <div className="flex flex-col items-center gap-2">
            <div className="bg-border h-3 w-28 animate-pulse rounded opacity-40" />
            <div className="bg-border h-2 w-36 animate-pulse rounded opacity-25" />
          </div>
        </div>
      </section>
    );
  }

  if (state.kind === 'loaded') {
    return <LoadedCard data={state.data} />;
  }

  // 'absent' or 'error' — show the CTA
  return <CtaCard />;
}
