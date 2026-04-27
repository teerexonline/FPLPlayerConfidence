'use client';

import { useEffect, useRef } from 'react';
import type { JSX } from 'react';

interface GwTimelineProps {
  /** Total number of gameweeks in the season (pills rendered 1..N). */
  readonly currentGameweek: number;
  /** Set of gameweeks for which cached squad data exists. */
  readonly availableGameweeks: ReadonlySet<number>;
  /** The currently displayed GW. */
  readonly selectedGw: number;
  /** Called when the user clicks an available, non-selected pill. */
  readonly onSelectGw: (gw: number) => void;
}

/**
 * Horizontal scrolling timeline of gameweek pills.
 *
 * - Available GWs (in availableGameweeks): clickable, show "GW{n}"
 * - Unavailable GWs: non-interactive, show "—", lower opacity
 * - Selected GW: accent background, bold, aria-current="true"
 * - Scrolls so the selected pill is always visible on mobile
 */
export function GwTimeline({
  currentGameweek,
  availableGameweeks,
  selectedGw,
  onSelectGw,
}: GwTimelineProps): JSX.Element {
  const selectedRef = useRef<HTMLLIElement | null>(null);
  const scrollRef = useRef<HTMLOListElement | null>(null);

  // Scroll selected pill into view on mount and whenever selectedGw changes.
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [selectedGw]);

  const pills = Array.from({ length: currentGameweek }, (_, i) => i + 1);

  return (
    <nav aria-label="Gameweek timeline" className="mt-6">
      <ol
        ref={scrollRef}
        className="flex gap-1.5 overflow-x-auto pb-2"
        style={{ scrollbarWidth: 'none', scrollSnapType: 'x mandatory' }}
      >
        {pills.map((gw) => {
          const isAvailable = availableGameweeks.has(gw);
          const isSelected = gw === selectedGw;

          return (
            <GwPill
              key={gw}
              gw={gw}
              isAvailable={isAvailable}
              isSelected={isSelected}
              onSelectGw={onSelectGw}
              ref={isSelected ? selectedRef : null}
            />
          );
        })}
      </ol>
    </nav>
  );
}

interface GwPillProps {
  readonly gw: number;
  readonly isAvailable: boolean;
  readonly isSelected: boolean;
  readonly onSelectGw: (gw: number) => void;
  readonly ref: React.Ref<HTMLLIElement> | null;
}

function GwPill({ gw, isAvailable, isSelected, onSelectGw, ref }: GwPillProps): JSX.Element {
  const baseClass =
    'flex min-w-[44px] cursor-pointer scroll-snap-align-center items-center justify-center rounded-md px-2.5 py-1.5 font-sans text-[11px] font-medium transition-colors select-none';

  if (!isAvailable) {
    return (
      <li
        role="listitem"
        aria-label={`GW${gw.toString()} — no data`}
        className={`${baseClass} text-muted/40 cursor-default opacity-40`}
        style={{ scrollSnapAlign: 'center' }}
      >
        —
      </li>
    );
  }

  if (isSelected) {
    return (
      <li
        ref={ref}
        role="listitem"
        aria-current="true"
        aria-label={`GW${gw.toString()}, selected`}
        className={`${baseClass} bg-accent text-bg font-semibold`}
        style={{ scrollSnapAlign: 'center' }}
      >
        GW{gw.toString()}
      </li>
    );
  }

  return (
    <li
      role="listitem"
      aria-label={`GW${gw.toString()}`}
      className={`${baseClass} bg-border text-muted hover:bg-border/70 cursor-pointer`}
      style={{ scrollSnapAlign: 'center' }}
      onClick={() => {
        onSelectGw(gw);
      }}
    >
      GW{gw.toString()}
    </li>
  );
}
