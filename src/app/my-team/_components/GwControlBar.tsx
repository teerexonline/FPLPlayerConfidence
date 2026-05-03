'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { JSX } from 'react';
import { cn } from '@/lib/utils';

interface GwControlBarProps {
  /** Computed formation string, e.g. "4-3-3". */
  readonly formation: string;
  /** Currently viewed gameweek. */
  readonly selectedGw: number;
  /** Latest live gameweek — anything beyond is projected. */
  readonly currentGameweek: number;
  /** Earliest navigable gameweek — left arrow is disabled at this boundary. */
  readonly firstGameweek: number;
  /**
   * Latest gameweek with a scheduled fixture. Right arrow is disabled here.
   * Defaults to `currentGameweek` (no forward navigation possible).
   */
  readonly lastGameweek?: number;
  /** Called when the user navigates to a new GW via the arrows. */
  readonly onSelectGw: (gw: number) => void;
}

/**
 * Horizontal control bar placed above the Starting XI list.
 * Left side: formation label (tabular, fixed width feel).
 * Right side: GW stepper with left/right arrow buttons and a GW indicator.
 *
 * On narrow viewports the two groups wrap to two lines but remain within
 * the same logical container via flex-wrap.
 */
export function GwControlBar({
  formation,
  selectedGw,
  currentGameweek,
  firstGameweek,
  lastGameweek,
  onSelectGw,
}: GwControlBarProps): JSX.Element {
  const upperBound = Math.max(currentGameweek, lastGameweek ?? currentGameweek);
  const canGoPrev = selectedGw > firstGameweek;
  const canGoNext = selectedGw < upperBound;

  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      {/* ── Formation label ──────────────────────────────────── */}
      <div aria-label={`Formation: ${formation}`}>
        <p className="text-muted font-sans text-[11px] font-semibold tracking-[0.06em] uppercase">
          Formation
        </p>
        <p className="text-text mt-0.5 font-sans text-[18px] font-semibold tracking-tight tabular-nums">
          {formation}
        </p>
      </div>

      {/* ── GW navigation ────────────────────────────────────── */}
      <div role="group" aria-label="Gameweek navigation" className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={() => {
            if (canGoPrev) onSelectGw(selectedGw - 1);
          }}
          disabled={!canGoPrev}
          aria-label="Previous gameweek"
          className={cn(
            'focus-visible:ring-accent/50 flex h-8 w-8 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none',
            canGoPrev
              ? 'text-muted hover:bg-border hover:text-text cursor-pointer'
              : 'text-muted/30 cursor-not-allowed',
          )}
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </button>

        <span
          className="text-text min-w-[52px] text-center font-sans text-[13px] font-semibold tabular-nums"
          aria-live="polite"
          aria-atomic="true"
        >
          GW{selectedGw.toString()}
        </span>

        <button
          type="button"
          onClick={() => {
            if (canGoNext) onSelectGw(selectedGw + 1);
          }}
          disabled={!canGoNext}
          aria-label="Next gameweek"
          className={cn(
            'focus-visible:ring-accent/50 flex h-8 w-8 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none',
            canGoNext
              ? 'text-muted hover:bg-border hover:text-text cursor-pointer'
              : 'text-muted/30 cursor-not-allowed',
          )}
        >
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
