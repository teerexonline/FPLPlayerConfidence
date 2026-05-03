'use client';

import { useDeferredValue, useState } from 'react';
import type { JSX } from 'react';
import { PlayersFilters } from './PlayersFilters';
import { PlayersTable } from './PlayersTable';
import type { PlayerWithConfidence } from './types';

interface PlayersInteractiveProps {
  readonly players: readonly PlayerWithConfidence[];
}

/**
 * Client wrapper that owns the search box's local state. Search is
 * intentionally NOT in the URL — every keystroke would otherwise trigger
 * a router.push() roundtrip, and the URL ↔ input sync introduced races
 * that dropped characters during fast typing.
 *
 * useDeferredValue keeps the input itself instantly responsive while
 * letting React schedule the (heavier) filter pass on the deferred value.
 * Other filters — positions, sort, eligibility — still go through the URL
 * because they're persistent settings worth sharing/bookmarking.
 */
export function PlayersInteractive({ players }: PlayersInteractiveProps): JSX.Element {
  const [searchInput, setSearchInput] = useState('');
  // Deferred value lags behind by one render under load — React itself
  // decides when to reconcile. The input box always shows the latest
  // keystrokes; the filtered table catches up a beat later.
  const deferredSearch = useDeferredValue(searchInput);

  return (
    <>
      <PlayersFilters searchValue={searchInput} onSearchChange={setSearchInput} />
      <PlayersTable players={players} searchOverride={deferredSearch} />
    </>
  );
}
