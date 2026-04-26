import { Suspense } from 'react';
import type { JSX } from 'react';
import { PlayersFilters } from './PlayersFilters';
import { PlayersTable } from './PlayersTable';
import { SkeletonRow } from './SkeletonRow';
import type { PlayerWithConfidence } from './types';

interface PlayersShellProps {
  readonly players: readonly PlayerWithConfidence[];
}

export function PlayersShell({ players }: PlayersShellProps): JSX.Element {
  return (
    <div>
      {/* PlayersFilters uses useSearchParams — must be in a Suspense boundary. */}
      <Suspense fallback={<FilterBarPlaceholder />}>
        <PlayersFilters />
      </Suspense>

      {/* PlayersTable also uses useSearchParams — separate boundary so
          the filter bar renders immediately while the table streams. */}
      <Suspense fallback={<TableSkeleton />}>
        <PlayersTable players={players} />
      </Suspense>
    </div>
  );
}

function FilterBarPlaceholder(): JSX.Element {
  return <div className="border-border bg-bg/90 h-[52px] border-b" aria-hidden="true" />;
}

function TableSkeleton(): JSX.Element {
  return (
    <div
      className="border-border bg-surface overflow-hidden border border-t-0"
      aria-busy="true"
      aria-label="Loading players"
    >
      {Array.from({ length: 12 }, (_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}
