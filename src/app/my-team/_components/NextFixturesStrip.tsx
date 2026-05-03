'use client';

import type { JSX } from 'react';
import { cn } from '@/lib/utils';
import type { NextFixture } from './types';

interface NextFixturesStripProps {
  readonly fixtures: readonly NextFixture[];
  /** Compact variant used in mobile rows. */
  readonly compact?: boolean;
}

// FDR colour scheme. Aligned with Premier League's own difficulty palette so
// the indicator reads at-a-glance without a legend.
const FDR_BG: Record<number, string> = {
  1: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300',
  2: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  3: 'bg-zinc-500/15 text-zinc-700 dark:text-zinc-200',
  4: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
  5: 'bg-rose-500/25 text-rose-800 dark:text-rose-200',
};

function fdrLabel(fdr: number): string {
  switch (fdr) {
    case 1:
      return 'very easy';
    case 2:
      return 'easy';
    case 3:
      return 'average';
    case 4:
      return 'hard';
    case 5:
      return 'very hard';
    default:
      return 'unknown';
  }
}

/**
 * Inline strip of up to 3 colour-coded upcoming fixtures.
 * Each pill shows opponent short-code + (H|A); background is tinted by FDR.
 * DGWs (multiple fixtures in the same gameweek) stack vertically within
 * a single column so it's visually clear that two fixtures fall in one GW.
 * Used under each player row on the My Team page.
 */
export function NextFixturesStrip({
  fixtures,
  compact = false,
}: NextFixturesStripProps): JSX.Element {
  if (fixtures.length === 0) {
    return (
      <span className="text-muted/60 font-mono text-[10px]" aria-label="No upcoming fixtures">
        —
      </span>
    );
  }

  // Group by gameweek so DGW fixtures share a column and stack vertically.
  const byGameweek = new Map<number, NextFixture[]>();
  for (const f of fixtures) {
    const list = byGameweek.get(f.gameweek) ?? [];
    list.push(f);
    byGameweek.set(f.gameweek, list);
  }
  const columns = Array.from(byGameweek.entries()).sort(([a], [b]) => a - b);

  return (
    <ul
      role="list"
      aria-label="Next fixtures"
      className={cn('flex shrink-0 items-start', compact ? 'gap-0.5' : 'gap-1')}
    >
      {columns.map(([gw, fs]) => (
        <li
          key={gw}
          role="listitem"
          className={cn('flex flex-col', compact ? 'gap-0.5' : 'gap-0.5')}
        >
          {fs.map((f, i) => (
            <span
              key={`${gw.toString()}-${i.toString()}`}
              aria-label={`GW${gw.toString()}: ${f.isHome ? 'home' : 'away'} vs ${f.opponentTeamShortName}, ${fdrLabel(f.fdr)}`}
              title={`GW${gw.toString()} · ${f.isHome ? 'vs' : '@'} ${f.opponentTeamShortName} · FDR ${f.fdr.toString()}`}
              className={cn(
                'flex items-center gap-0.5 rounded-[3px] px-1 py-px font-mono font-semibold tabular-nums',
                compact ? 'text-[9px]' : 'text-[10px]',
                FDR_BG[f.fdr] ?? FDR_BG[3],
              )}
            >
              <span>{f.opponentTeamShortName}</span>
              <span className="opacity-60">{f.isHome ? '(H)' : '(A)'}</span>
            </span>
          ))}
        </li>
      ))}
    </ul>
  );
}
