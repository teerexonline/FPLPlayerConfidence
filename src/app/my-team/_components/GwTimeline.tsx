'use client';

import { useEffect, useRef } from 'react';
import type { JSX } from 'react';

interface GwTimelineProps {
  /** The most recent gameweek the system knows about (real squad data exists up to here). */
  readonly currentGameweek: number;
  /**
   * The earliest gameweek this manager can navigate to — typically the first
   * GW for which their squad was ever fetched. GWs before this show as "—"
   * (no data exists and none can be fetched). GWs in [firstGameweek,
   * currentGameweek] are all clickable; cache misses trigger an on-demand
   * fetch when the user selects them.
   */
  readonly firstGameweek: number;
  /**
   * The latest gameweek with at least one scheduled fixture. Pills between
   * `currentGameweek+1` and this GW are clickable as **projected** GWs
   * (planner mode). Defaults to `currentGameweek` (no forward navigation).
   */
  readonly lastGameweek?: number;
  /** The currently displayed GW. */
  readonly selectedGw: number;
  /** Called when the user clicks a non-selected pill in the available range. */
  readonly onSelectGw: (gw: number) => void;
}

/**
 * Horizontal scrolling timeline of gameweek pills.
 *
 * - GWs in [firstGameweek, currentGameweek]: clickable, show "GW{n}".
 *   Clicking a GW not yet in the local cache triggers an on-demand fetch.
 * - GWs before firstGameweek: non-interactive, show "—", lower opacity.
 * - Selected GW: accent background, bold, aria-current="true".
 * - Scrolls so the selected pill is always visible on mobile.
 */
export function GwTimeline({
  currentGameweek,
  firstGameweek,
  lastGameweek,
  selectedGw,
  onSelectGw,
}: GwTimelineProps): JSX.Element {
  const selectedRef = useRef<HTMLLIElement | null>(null);

  // Scroll selected pill into view on mount and whenever selectedGw changes.
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [selectedGw]);

  const endGw = Math.max(currentGameweek, lastGameweek ?? currentGameweek);
  const pills = Array.from({ length: endGw }, (_, i) => i + 1);

  return (
    <nav aria-label="Gameweek timeline" className="mt-6">
      <ol
        className="flex gap-1.5 overflow-x-auto pb-2"
        style={{ scrollbarWidth: 'none', scrollSnapType: 'x mandatory' }}
      >
        {pills.map((gw) => {
          const isInRange = gw >= firstGameweek;
          const isSelected = gw === selectedGw;
          const isProjected = gw > currentGameweek;

          return (
            <GwPill
              key={gw}
              gw={gw}
              isInRange={isInRange}
              isProjected={isProjected}
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
  readonly isInRange: boolean;
  readonly isProjected: boolean;
  readonly isSelected: boolean;
  readonly onSelectGw: (gw: number) => void;
  readonly ref: React.Ref<HTMLLIElement> | null;
}

function GwPill({
  gw,
  isInRange,
  isProjected,
  isSelected,
  onSelectGw,
  ref,
}: GwPillProps): JSX.Element {
  const baseClass =
    'flex min-w-[44px] cursor-pointer scroll-snap-align-center items-center justify-center rounded-md px-2.5 py-1.5 font-sans text-[11px] font-medium transition-colors select-none';

  if (!isInRange) {
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
        aria-label={`GW${gw.toString()}${isProjected ? ', projected' : ''}, selected`}
        className={`${baseClass} ${isProjected ? 'border-accent text-accent border border-dashed' : 'bg-accent text-bg font-semibold'}`}
        style={{ scrollSnapAlign: 'center' }}
      >
        GW{gw.toString()}
      </li>
    );
  }

  // Future GWs render with a dashed outline so the user knows they are
  // entering forward-projection territory rather than browsing real history.
  if (isProjected) {
    return (
      <li
        role="listitem"
        aria-label={`GW${gw.toString()}, projected`}
        className={`${baseClass} border-border/70 text-muted hover:border-accent/50 hover:text-accent border border-dashed`}
        style={{ scrollSnapAlign: 'center' }}
        onClick={() => {
          onSelectGw(gw);
        }}
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
