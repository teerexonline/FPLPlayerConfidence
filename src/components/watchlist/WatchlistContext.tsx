'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { JSX, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

interface WatchlistContextValue {
  /** Set of player IDs currently on the watchlist. Empty while loading. */
  readonly ids: ReadonlySet<number>;
  readonly isLoading: boolean;
  /** Toggles the watchlist state for a player optimistically, then persists. */
  readonly toggle: (playerId: number) => void;
}

const WatchlistContext = createContext<WatchlistContextValue | null>(null);

export function WatchlistProvider({ children }: { children: ReactNode }): JSX.Element {
  const [ids, setIds] = useState<ReadonlySet<number>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  // Tracks in-flight requests so concurrent toggles don't race.
  const pendingRef = useRef<Set<number>>(new Set());
  const router = useRouter();

  useEffect(() => {
    fetch('/api/watchlist')
      .then((r) => r.json() as Promise<{ ids: number[] }>)
      .then(({ ids: fetched }) => {
        setIds(new Set(fetched));
      })
      .catch(() => {
        // Non-fatal: watchlist stays empty. User can still toggle (mutations retry-free).
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const toggle = useCallback(
    (playerId: number) => {
      if (pendingRef.current.has(playerId)) return;
      pendingRef.current.add(playerId);

      setIds((prev) => {
        const next = new Set(prev);
        if (next.has(playerId)) {
          next.delete(playerId);
        } else {
          next.add(playerId);
        }
        return next;
      });

      const wasWatchlisted = ids.has(playerId);
      const request = wasWatchlisted
        ? fetch(`/api/watchlist/${playerId.toString()}`, { method: 'DELETE' })
        : fetch('/api/watchlist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playerId }),
          });

      request
        .then(() => {
          // Invalidate the Next.js Router Cache so the dashboard's server-rendered
          // WatchlistCard reflects the new state on the next navigation to '/'.
          router.refresh();
        })
        .catch(() => {
          // Rollback optimistic update on failure.
          setIds((prev) => {
            const next = new Set(prev);
            if (wasWatchlisted) {
              next.add(playerId);
            } else {
              next.delete(playerId);
            }
            return next;
          });
        })
        .finally(() => {
          pendingRef.current.delete(playerId);
        });
    },
    [ids, router],
  );

  return (
    <WatchlistContext.Provider value={{ ids, isLoading, toggle }}>
      {children}
    </WatchlistContext.Provider>
  );
}

export function useWatchlist(): WatchlistContextValue {
  const ctx = useContext(WatchlistContext);
  if (ctx === null) {
    throw new Error('useWatchlist must be used inside WatchlistProvider');
  }
  return ctx;
}
