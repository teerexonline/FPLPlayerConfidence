import type { JSX } from 'react';
import Link from 'next/link';
import { getRepositories } from '@/lib/db/server';
import { AuthButton } from '@/components/auth/AuthButton';
import { ThemeToggle } from './ThemeToggle';

async function resolveCurrentGameweek(): Promise<number> {
  try {
    const repos = getRepositories();
    const raw = await repos.syncMeta.get('current_gameweek');
    if (!raw) {
      // Fall back to the max gameweek in snapshots
      const currentForAll = await repos.confidenceSnapshots.currentForAllPlayers();
      return currentForAll.reduce((m: number, { snapshot }) => Math.max(m, snapshot.gameweek), 0);
    }
    const parsed = parseInt(raw, 10);
    return isNaN(parsed) ? 0 : parsed;
  } catch {
    return 0;
  }
}

export async function Topbar(): Promise<JSX.Element> {
  const currentGameweek = await resolveCurrentGameweek();

  return (
    <header
      className="border-border bg-bg sticky top-0 z-40 border-b"
      role="banner"
      aria-label="FPL Confidence navigation"
    >
      <div className="mx-auto flex h-14 max-w-[1280px] items-center justify-between px-4 sm:px-8">
        {/* Wordmark */}
        <Link
          href="/"
          className="group flex items-baseline gap-1 rounded-sm focus-visible:ring-2 focus-visible:ring-[#1e40af] focus-visible:outline-none dark:focus-visible:ring-[#60a5fa]"
        >
          <span className="font-display text-[15px] leading-none font-semibold tracking-tight text-[#1e40af] transition-opacity group-hover:opacity-80 dark:text-[#60a5fa]">
            FPL
          </span>
          <span className="text-muted font-sans text-[13px] leading-none font-medium tracking-[-0.01em] transition-opacity group-hover:opacity-80">
            Confidence
          </span>
          <span className="sr-only"> — home</span>
        </Link>

        {/* Right side — GW pill + theme toggle */}
        <div className="flex items-center gap-2">
          {currentGameweek > 0 && (
            <span
              className="border-border bg-surface text-text rounded-full border px-3 py-1 font-sans text-[11px] font-semibold tracking-[0.04em] uppercase tabular-nums"
              aria-label={`Gameweek ${currentGameweek.toString()}`}
            >
              GW {currentGameweek.toString()}
            </span>
          )}

          <div className="border-border h-4 w-px border-l" aria-hidden="true" />

          <AuthButton />

          <div className="border-border h-4 w-px border-l" aria-hidden="true" />

          <ThemeToggle className="text-muted hover:text-text focus-visible:ring-accent rounded-[4px] px-2 py-1.5 font-sans text-[11px] font-medium tracking-[0.04em] uppercase transition-colors focus-visible:ring-2 focus-visible:outline-none" />
        </div>
      </div>
    </header>
  );
}
