'use client';

import { useVirtualizer } from '@tanstack/react-virtual';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useRef, useState } from 'react';
import type { JSX, KeyboardEvent } from 'react';
import { isEligibleMover } from '@/app/_components/moversFilter';
import { cn } from '@/lib/utils';
import { EmptyFilterState } from './EmptyFilterState';
import { PlayerCard } from './PlayerCard';
import { PlayerRow } from './PlayerRow';
import { parseFilters } from './PlayersFilters';
import type { FilterState, PlayerWithConfidence, SortKey } from './types';

// Matches grid-cols in PlayerRow and SkeletonRow. Status indicators sit in
// their own column (no header label) so xP gets a clean dedicated column.
// Trailing empty string is the watchlist-star column.
const CONFIDENCE_HEADERS = ['Player', 'Team', 'Pos', 'Price', '', 'xP', 'Last 5', ''] as const;

const ROW_HEIGHT = 56; // h-14 = 56px
const HEADER_HEIGHT = 40; // py-2.5 + text
const TABLE_MAX_HEIGHT = 'calc(100vh - 220px)'; // page-header (~120px) + filter-bar (~52px) + table-header (~40px) + buffer

interface PlayersTableProps {
  readonly players: readonly PlayerWithConfidence[];
  /**
   * Search term provided by the parent (PlayersInteractive). Overrides any
   * search value parsed from the URL — search is now purely local state to
   * avoid URL roundtrip lag and the URL ↔ input race.
   */
  readonly searchOverride?: string;
}

export function PlayersTable({ players, searchOverride }: PlayersTableProps): JSX.Element {
  const searchParams = useSearchParams();
  const urlFilters = parseFilters(searchParams);
  // Compose effective filters: persistent settings from URL + ephemeral search
  // from the parent's local state.
  const filters: typeof urlFilters = {
    ...urlFilters,
    search: searchOverride ?? urlFilters.search,
  };
  // Memoize the filter+sort pass — it walks all 500+ players and runs on every
  // render of this component (URL state changes, parent re-renders, etc.).
  // Positions is an array so we serialise it to a stable key for the dep list.
  const positionsKey = filters.positions.join(',');
  const filtered = useMemo(
    () => applyFilters(players, filters),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- positionsKey is the stable serialisation of filters.positions
    [
      players,
      filters.search,
      filters.sortKey,
      filters.sortOrder,
      filters.minConf,
      filters.maxConf,
      filters.onlyEligible,
      positionsKey,
    ],
  );

  if (players.length > 0 && filtered.length === 0) {
    return <EmptyFilterState />;
  }

  return (
    <>
      {/* Desktop table ≥ sm breakpoint */}
      <div
        className="border-border bg-surface hidden border border-t-0 sm:block"
        role="table"
        aria-label="Players list"
      >
        <DesktopVirtualTable filtered={filtered} />
      </div>

      {/* Mobile card stack < sm breakpoint */}
      <div className="sm:hidden" role="table" aria-label="Players list">
        <div role="rowgroup">
          {filtered.map((player) => (
            <PlayerCard key={player.id} player={player} />
          ))}
        </div>
      </div>
    </>
  );
}

// ── Desktop virtual table ─────────────────────────────────────────────────────

function DesktopVirtualTable({
  filtered,
}: {
  readonly filtered: readonly PlayerWithConfidence[];
}): JSX.Element {
  const router = useRouter();
  const parentRef = useRef<HTMLDivElement>(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 5,
  });

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (filtered.length === 0) return;

      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault();
          const next = Math.min(focusedIndex + 1, filtered.length - 1);
          setFocusedIndex(next);
          virtualizer.scrollToIndex(next, { align: 'auto' });
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          const prev = Math.max(focusedIndex - 1, 0);
          setFocusedIndex(prev);
          virtualizer.scrollToIndex(prev, { align: 'auto' });
          break;
        }
        case 'Enter': {
          e.preventDefault();
          const player = filtered[focusedIndex];
          if (player) {
            router.push(`/players/${player.id.toString()}`);
          }
          break;
        }
      }
    },
    [filtered, focusedIndex, router, virtualizer],
  );

  return (
    <>
      {/* Column header row — always rendered, not virtualized */}
      <div
        role="row"
        className="border-border grid grid-cols-[1fr_88px_60px_72px_56px_72px_96px_36px] border-b px-4 py-2.5"
        style={{ height: HEADER_HEIGHT }}
      >
        {CONFIDENCE_HEADERS.map((h, i) => {
          // xP column header is right-aligned + right-padded to match the
          // right-aligned + right-padded xP data cell.
          const isXp = h === 'xP';
          // Star column is the LAST empty header; status column is the FIRST empty.
          const isStar = h === '' && i === CONFIDENCE_HEADERS.length - 1;
          const srLabel = isStar ? 'Watchlist' : h === '' ? 'Status' : null;
          return (
            <span
              key={h || `col-${i.toString()}`}
              role="columnheader"
              className={cn(
                'text-muted text-[11px] font-medium tracking-[0.05em] uppercase',
                isXp && 'pr-4 text-right',
              )}
            >
              {h || (srLabel && <span className="sr-only">{srLabel}</span>)}
            </span>
          );
        })}
      </div>

      {/* Virtualized body */}
      <div
        ref={parentRef}
        role="rowgroup"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (focusedIndex === -1 && filtered.length > 0) setFocusedIndex(0);
        }}
        onBlur={() => {
          setFocusedIndex(-1);
        }}
        style={{ height: TABLE_MAX_HEIGHT, overflowY: 'auto' }}
        className="focus:outline-none"
        aria-label="Player rows — use arrow keys to navigate"
      >
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const player = filtered[virtualRow.index];
            if (!player) return null;
            return (
              <div
                key={player.id}
                style={{
                  position: 'absolute',
                  top: virtualRow.start,
                  left: 0,
                  right: 0,
                  height: virtualRow.size,
                }}
              >
                <PlayerRow player={player} focused={focusedIndex === virtualRow.index} />
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ── Filter + sort — pure functions ────────────────────────────────────────────

function applyFilters(
  players: readonly PlayerWithConfidence[],
  filters: FilterState,
): readonly PlayerWithConfidence[] {
  let result = players;

  if (filters.positions.length > 0) {
    result = result.filter((p) => filters.positions.includes(p.position));
  }

  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(
      (p) => p.webName.toLowerCase().includes(q) || p.teamShortName.toLowerCase().includes(q),
    );
  }

  result = result.filter((p) => p.confidence >= filters.minConf && p.confidence <= filters.maxConf);

  if (filters.onlyEligible) {
    result = result.filter((p) => isEligibleMover(p));
  }

  return sortPlayers(result, filters.sortKey, filters.sortOrder);
}

function sortPlayers(
  players: readonly PlayerWithConfidence[],
  key: SortKey,
  order: 'asc' | 'desc',
): readonly PlayerWithConfidence[] {
  return [...players].sort((a, b) => {
    let primary: number;
    switch (key) {
      case 'confidence':
        primary = a.confidence - b.confidence;
        break;
      case 'price':
        primary = a.nowCost - b.nowCost;
        break;
      case 'name':
        // Name sort is already deterministic — no numeric tiebreaker needed.
        return a.webName.localeCompare(b.webName) * (order === 'asc' ? 1 : -1);
      case 'team':
        primary = a.teamShortName.localeCompare(b.teamShortName);
        break;
      case 'delta':
        primary = (a.recentDeltas.at(-1) ?? 0) - (b.recentDeltas.at(-1) ?? 0);
        break;
    }
    const oriented = order === 'asc' ? primary : -primary;
    if (oriented !== 0) return oriented;
    // Tiebreaker: higher total season points first (independent of sort direction).
    return b.totalPoints - a.totalPoints;
  });
}
