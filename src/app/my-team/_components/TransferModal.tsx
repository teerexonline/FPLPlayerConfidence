'use client';

import { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import { ArrowLeftRight, Search, X } from 'lucide-react';
import { ConfidenceNumber } from '@/components/confidence/ConfidenceNumber';
import type { TransferCandidate } from '@/app/api/transfer-candidates/route';
import type { SquadPlayerRow } from './types';

interface TransferModalProps {
  readonly playerOut: SquadPlayerRow;
  /** All 15 squad member IDs — non-bench/starter swap candidates in this set are excluded. */
  readonly squadPlayerIds: ReadonlySet<number>;
  /** IDs already staged as "in" by other pending swaps — excluded to prevent double-book. */
  readonly stagedInIds: ReadonlySet<number>;
  /**
   * Same-position squad players eligible for substitution. Rendered above the
   * external transfer candidates with a "From your squad" header. Selecting one
   * triggers a sub (squad_position swap) instead of a transfer.
   */
  readonly subCandidates?: readonly SquadPlayerRow[];
  readonly onSelect: (inId: number) => void;
  readonly onClose: () => void;
}

type FetchState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'loaded'; readonly candidates: readonly TransferCandidate[] }
  | { readonly kind: 'error' };

export function TransferModal({
  playerOut,
  squadPlayerIds,
  stagedInIds,
  subCandidates = [],
  onSelect,
  onClose,
}: TransferModalProps): JSX.Element {
  const [fetchState, setFetchState] = useState<FetchState>({ kind: 'loading' });
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/transfer-candidates?position=${playerOut.position}`, {
      signal: controller.signal,
    })
      .then((r) => r.json() as Promise<{ candidates: TransferCandidate[] }>)
      .then(({ candidates }) => {
        setFetchState({ kind: 'loaded', candidates });
      })
      .catch(() => {
        if (!controller.signal.aborted) setFetchState({ kind: 'error' });
      });
    return () => {
      controller.abort();
    };
  }, [playerOut.position]);

  // Close on Escape.
  useEffect(() => {
    function handleKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  // Focus search on mount.
  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  const filtered =
    fetchState.kind === 'loaded'
      ? fetchState.candidates.filter((c) => {
          if (squadPlayerIds.has(c.playerId)) return false;
          if (stagedInIds.has(c.playerId)) return false;
          if (!query) return true;
          const q = query.toLowerCase();
          return c.webName.toLowerCase().includes(q) || c.teamShortName.toLowerCase().includes(q);
        })
      : [];

  const visibleSubs = subCandidates.filter((s) => {
    if (s.playerId === playerOut.playerId) return false;
    if (stagedInIds.has(s.playerId)) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return s.webName.toLowerCase().includes(q) || s.teamShortName.toLowerCase().includes(q);
  });

  const isFromBench = playerOut.squadPosition > 11;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-sm sm:items-center sm:justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`Select replacement for ${playerOut.webName}`}
    >
      <div className="bg-surface border-border flex max-h-[85vh] w-full flex-col rounded-t-[16px] border shadow-2xl sm:max-w-md sm:rounded-[12px]">
        {/* Header */}
        <div className="border-border flex shrink-0 items-center gap-3 border-b px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-muted font-sans text-[11px] font-medium tracking-[0.08em] uppercase">
              Transfer out
            </p>
            <p className="text-text truncate font-sans text-[14px] font-semibold">
              {playerOut.webName}
              <span className="text-muted ml-1.5 font-normal">({playerOut.position})</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted hover:text-text focus-visible:ring-accent flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-none"
            aria-label="Close"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Search */}
        <div className="border-border shrink-0 border-b px-4 py-2.5">
          <div className="border-border bg-bg flex items-center gap-2 rounded-[8px] border px-3 py-2">
            <Search className="text-muted h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
              }}
              placeholder="Search by name or team…"
              className="text-text placeholder:text-muted min-w-0 flex-1 bg-transparent font-sans text-[13px] outline-none"
              aria-label="Search candidates"
            />
          </div>
        </div>

        {/* Candidate list */}
        <div className="flex-1 overflow-y-auto px-4">
          {/* Substitution candidates: same-position squad players. Rendered above
              transfers because using a player you already own is the cheaper
              option (no transfer cost). The label flips depending on whether the
              user clicked ↔ on a bench player (promoting → starter) or a starter
              (subbing → bench). */}
          {visibleSubs.length > 0 && (
            <>
              <p className="text-muted mt-3 mb-1 font-sans text-[11px] font-semibold tracking-[0.06em] uppercase">
                {isFromBench ? 'Swap with starter' : 'Substitute from bench'}
              </p>
              <ul role="list" className="divide-border divide-y">
                {visibleSubs.map((s) => (
                  <li key={s.playerId} role="listitem">
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(s.playerId);
                      }}
                      className="hover:bg-bg focus-visible:ring-accent -mx-4 flex w-[calc(100%+2rem)] items-center gap-3 px-4 py-3 transition-colors focus-visible:ring-2 focus-visible:outline-none"
                      aria-label={`Substitute in ${s.webName} (${s.teamShortName}, confidence ${s.confidence > 0 ? '+' : ''}${s.confidence.toString()})`}
                    >
                      {s.teamCode > 0 && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`/api/jerseys/${s.teamCode.toString()}`}
                          alt=""
                          aria-hidden="true"
                          width={28}
                          height={36}
                          className="h-7 w-7 shrink-0 object-contain"
                        />
                      )}
                      <div className="min-w-0 flex-1 text-left">
                        <p className="text-text truncate font-sans text-[13px] font-medium">
                          {s.webName}
                          <span className="text-muted ml-1.5 font-mono text-[10px] font-normal">
                            #{s.squadPosition.toString()}
                          </span>
                        </p>
                        <p className="text-muted font-sans text-[11px]">
                          {s.teamShortName} · {s.position}
                        </p>
                      </div>
                      <ConfidenceNumber value={s.confidence} mode="c" size="sm" animated={false} />
                      <ArrowLeftRight
                        className="text-muted h-3.5 w-3.5 shrink-0"
                        aria-hidden="true"
                      />
                    </button>
                  </li>
                ))}
              </ul>
              {!isFromBench && (
                <p className="text-muted mt-3 mb-1 font-sans text-[11px] font-semibold tracking-[0.06em] uppercase">
                  Or transfer in
                </p>
              )}
            </>
          )}

          {/* External transfer candidates — only shown when swapping a starter,
              since substitutions from the bench can only swap with starters. */}
          {!isFromBench && fetchState.kind === 'loading' && (
            <div className="flex items-center justify-center py-12">
              <span className="text-muted font-sans text-[13px]">Loading…</span>
            </div>
          )}
          {!isFromBench && fetchState.kind === 'error' && (
            <div className="flex items-center justify-center py-12">
              <span className="text-muted font-sans text-[13px]">
                Failed to load candidates. Try again.
              </span>
            </div>
          )}
          {!isFromBench &&
            fetchState.kind === 'loaded' &&
            filtered.length === 0 &&
            visibleSubs.length === 0 && (
              <div className="flex items-center justify-center py-12">
                <span className="text-muted font-sans text-[13px]">No results</span>
              </div>
            )}
          {!isFromBench && fetchState.kind === 'loaded' && filtered.length > 0 && (
            <ul role="list" className="divide-border divide-y">
              {filtered.map((c) => (
                <li key={c.playerId} role="listitem">
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(c.playerId);
                    }}
                    className="hover:bg-bg focus-visible:ring-accent -mx-4 flex w-[calc(100%+2rem)] items-center gap-3 px-4 py-3 transition-colors focus-visible:ring-2 focus-visible:outline-none"
                    aria-label={`Transfer in ${c.webName} (${c.teamShortName}, confidence ${c.currentConfidence > 0 ? '+' : ''}${c.currentConfidence.toString()})`}
                  >
                    {c.teamCode > 0 && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`/api/jerseys/${c.teamCode.toString()}`}
                        alt=""
                        aria-hidden="true"
                        width={28}
                        height={36}
                        className="h-7 w-7 shrink-0 object-contain"
                      />
                    )}
                    <div className="min-w-0 flex-1 text-left">
                      <p className="text-text truncate font-sans text-[13px] font-medium">
                        {c.webName}
                      </p>
                      <p className="text-muted font-sans text-[11px]">
                        {c.teamShortName} · {c.position}
                      </p>
                    </div>
                    <ConfidenceNumber
                      value={c.currentConfidence}
                      mode="c"
                      size="sm"
                      animated={false}
                    />
                    <ArrowLeftRight
                      className="text-muted h-3.5 w-3.5 shrink-0"
                      aria-hidden="true"
                    />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
