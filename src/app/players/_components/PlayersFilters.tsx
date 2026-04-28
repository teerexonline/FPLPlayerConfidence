'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';
import type { JSX } from 'react';
import { cn } from '@/lib/utils';
import type { FilterState, Position, SortKey, SortOrder } from './types';
import { DEFAULT_FILTER_STATE } from './types';

// ── URL codec ─────────────────────────────────────────────────────────────────

const POSITIONS: readonly Position[] = ['GK', 'DEF', 'MID', 'FWD'];
const SORT_KEYS: readonly SortKey[] = ['confidence', 'price', 'name', 'team', 'delta'];
const SORT_LABELS: Record<SortKey, string> = {
  confidence: 'Confidence',
  price: 'Price',
  name: 'Name',
  team: 'Team',
  delta: 'Delta',
};

export function parseFilters(params: URLSearchParams): FilterState {
  const rawPositions = params.getAll('pos');
  const positions = rawPositions.filter((p): p is Position =>
    (POSITIONS as readonly string[]).includes(p),
  );

  const rawSort = params.get('sort') ?? '';
  const sortKey: SortKey = (SORT_KEYS as readonly string[]).includes(rawSort)
    ? (rawSort as SortKey)
    : 'confidence';

  const rawOrder = params.get('order') ?? '';
  const sortOrder: SortOrder = rawOrder === 'asc' ? 'asc' : 'desc';

  const minConf = Math.max(-5, parseInt(params.get('minConf') ?? '-5', 10));
  const maxConf = Math.min(5, parseInt(params.get('maxConf') ?? '5', 10));

  return {
    positions,
    search: params.get('search') ?? '',
    sortKey,
    sortOrder,
    minConf,
    maxConf,
    onlyEligible: params.get('onlyEligible') === 'true',
  };
}

export function filtersToParams(f: FilterState): URLSearchParams {
  const p = new URLSearchParams();
  f.positions.forEach((pos) => {
    p.append('pos', pos);
  });
  if (f.search) p.set('search', f.search);
  // Only serialize sort when it differs from the global default
  if (
    f.sortKey !== DEFAULT_FILTER_STATE.sortKey ||
    f.sortOrder !== DEFAULT_FILTER_STATE.sortOrder
  ) {
    p.set('sort', f.sortKey);
    p.set('order', f.sortOrder);
  }
  if (f.minConf !== DEFAULT_FILTER_STATE.minConf) p.set('minConf', f.minConf.toString());
  if (f.maxConf !== DEFAULT_FILTER_STATE.maxConf) p.set('maxConf', f.maxConf.toString());
  if (f.onlyEligible) p.set('onlyEligible', 'true');
  return p;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PlayersFilters(): JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filters = parseFilters(searchParams);
  const searchRef = useRef<HTMLInputElement>(null);

  // Focus the search input on `/` or Cmd/Ctrl+K, unless an input is already focused.
  useEffect(() => {
    function onKeyDown(e: globalThis.KeyboardEvent): void {
      const inInput =
        e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if (e.key === '/' && !e.metaKey && !e.ctrlKey && !inInput) {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  function push(next: FilterState): void {
    const qs = filtersToParams(next).toString();
    router.push(qs ? `/players?${qs}` : '/players', { scroll: false });
  }

  function togglePosition(pos: Position): void {
    const next = filters.positions.includes(pos)
      ? filters.positions.filter((p) => p !== pos)
      : [...filters.positions, pos];
    push({ ...filters, positions: next });
  }

  function setSearch(search: string): void {
    push({ ...filters, search });
  }

  function setSort(key: SortKey): void {
    // Toggling the active key flips order; switching key resets to natural default direction.
    const naturalAsc = key === 'name' || key === 'team';
    const sortOrder: SortOrder =
      key === filters.sortKey
        ? filters.sortOrder === 'asc'
          ? 'desc'
          : 'asc'
        : naturalAsc
          ? 'asc'
          : 'desc';
    push({ ...filters, sortKey: key, sortOrder });
  }

  function clearAll(): void {
    router.push('/players', { scroll: false });
  }

  const hasActiveFilters =
    filters.positions.length > 0 ||
    filters.search !== '' ||
    filters.sortKey !== DEFAULT_FILTER_STATE.sortKey ||
    filters.sortOrder !== DEFAULT_FILTER_STATE.sortOrder ||
    filters.minConf !== DEFAULT_FILTER_STATE.minConf ||
    filters.maxConf !== DEFAULT_FILTER_STATE.maxConf ||
    filters.onlyEligible;

  return (
    <div className="border-border bg-bg/90 sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b px-4 py-3 backdrop-blur-sm">
      {/* Position chips */}
      <div className="flex gap-1.5" role="group" aria-label="Filter by position">
        {POSITIONS.map((pos) => {
          const active = filters.positions.includes(pos);
          return (
            <button
              key={pos}
              type="button"
              onClick={() => {
                togglePosition(pos);
              }}
              aria-pressed={active}
              className={cn(
                'inline-flex h-8 items-center rounded-full border px-3 text-[12px] font-medium transition-colors',
                'focus-visible:ring-accent focus-visible:ring-2 focus-visible:outline-none',
                active
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-border text-muted hover:border-accent/40 hover:text-text',
              )}
            >
              {pos}
            </button>
          );
        })}
      </div>

      <div className="bg-border mx-1 h-5 w-px shrink-0" aria-hidden="true" />

      {/* Sort buttons */}
      <div className="flex items-center gap-0.5" role="group" aria-label="Sort players">
        <span className="text-muted mr-1 text-[11px] font-medium tracking-[0.04em] uppercase">
          Sort
        </span>
        {SORT_KEYS.map((key) => {
          const active = filters.sortKey === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => {
                setSort(key);
              }}
              aria-pressed={active}
              className={cn(
                'flex items-center gap-1 rounded px-2 py-1 text-[12px] font-medium transition-colors',
                'focus-visible:ring-accent focus-visible:ring-2 focus-visible:outline-none',
                active ? 'text-text' : 'text-muted hover:text-text',
              )}
            >
              {SORT_LABELS[key]}
              {active && (
                <svg
                  width={10}
                  height={10}
                  viewBox="0 0 10 10"
                  className={cn(
                    'transition-transform',
                    filters.sortOrder === 'asc' && 'rotate-180',
                  )}
                  aria-hidden="true"
                >
                  <path d="M5 7L1 3h8L5 7z" fill="currentColor" />
                </svg>
              )}
            </button>
          );
        })}
      </div>

      {/* Eligible movers chip — shown when onlyEligible is active */}
      {filters.onlyEligible && (
        <div className="border-accent/40 bg-accent/8 flex items-center gap-1 rounded-full border px-2.5 py-1">
          <span className="text-accent font-sans text-[11px] font-medium">
            Eligible movers only
          </span>
          <button
            type="button"
            onClick={() => {
              push({ ...filters, onlyEligible: false });
            }}
            aria-label="Remove eligible movers filter"
            className="text-accent/70 hover:text-accent focus-visible:ring-accent ml-0.5 rounded-full transition-colors focus-visible:ring-1 focus-visible:outline-none"
          >
            <svg width={10} height={10} viewBox="0 0 10 10" aria-hidden="true">
              <path
                d="M2 2l6 6M8 2l-6 6"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Clear */}
      {hasActiveFilters && (
        <button
          type="button"
          onClick={clearAll}
          className="text-muted hover:text-text focus-visible:ring-accent rounded px-2 py-1 text-[12px] transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          Clear
        </button>
      )}

      {/* Search */}
      <div className="relative">
        <svg
          width={14}
          height={14}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          className="text-muted pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2"
          aria-hidden="true"
        >
          <circle cx={11} cy={11} r={8} />
          <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
        </svg>
        <input
          ref={searchRef}
          type="search"
          value={filters.search}
          onChange={(e) => {
            setSearch(e.target.value);
          }}
          placeholder="Search players…"
          aria-label="Search players"
          className="border-border bg-surface text-text placeholder:text-muted focus:border-accent focus:ring-accent/20 h-8 w-[200px] rounded-[6px] border py-1.5 pr-3 pl-8 text-[13px] transition-colors focus:ring-2 focus:outline-none"
        />
      </div>
    </div>
  );
}
