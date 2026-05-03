import { Suspense } from 'react';
import type { JSX } from 'react';
import { PlayersInteractive } from './PlayersInteractive';
import { SkeletonRow } from './SkeletonRow';
import type { PlayerWithConfidence } from './types';

interface PlayersShellProps {
  readonly players: readonly PlayerWithConfidence[];
}

export function PlayersShell({ players }: PlayersShellProps): JSX.Element {
  return (
    <div>
      {/* PlayersInteractive owns the search-box local state and renders both
          PlayersFilters and PlayersTable. Both children use useSearchParams
          for the non-search filters, so they need a Suspense ancestor. */}
      <Suspense
        fallback={
          <>
            <FilterBarPlaceholder />
            <TableSkeleton />
          </>
        }
      >
        <PlayersInteractive players={players} />
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
