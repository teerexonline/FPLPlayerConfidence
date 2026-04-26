'use client';

import type { JSX } from 'react';
import { MatchHistoryCard } from './MatchHistoryCard';
import { DgwMatchCard } from './DgwMatchCard';
import { parseDgwReason } from './types';
import type { SnapshotPoint } from './types';

interface MatchHistoryStripProps {
  readonly snapshots: readonly SnapshotPoint[];
}

/**
 * Horizontal-scrolling strip of match history cards, oldest → newest (left → right).
 * Masked on both edges with a fade so the scroll affordance is clear.
 */
export function MatchHistoryStrip({ snapshots }: MatchHistoryStripProps): JSX.Element {
  if (snapshots.length === 0) {
    return (
      <section aria-label="Match history" className="mt-12">
        <SectionHeader count={0} />
        <p className="text-muted mt-4 text-center text-[13px]">No match history yet.</p>
      </section>
    );
  }

  return (
    <section aria-label="Match history" className="mt-12">
      <SectionHeader count={snapshots.length} />

      {/* Scroll container — masked edges communicate overflow */}
      <div
        className="relative mt-4"
        style={{
          maskImage:
            'linear-gradient(to right, transparent 0%, black 32px, black calc(100% - 32px), transparent 100%)',
          WebkitMaskImage:
            'linear-gradient(to right, transparent 0%, black 32px, black calc(100% - 32px), transparent 100%)',
        }}
      >
        <div
          role="list"
          aria-label="Match cards"
          className="flex gap-2.5 overflow-x-auto pr-8 pb-4 pl-8"
          style={{ scrollbarWidth: 'none' }}
        >
          {snapshots.map((snapshot) => {
            const dgwParts = parseDgwReason(snapshot.reason);
            return dgwParts !== null ? (
              <DgwMatchCard key={snapshot.gameweek} snapshot={snapshot} parts={dgwParts} />
            ) : (
              <MatchHistoryCard key={snapshot.gameweek} snapshot={snapshot} />
            );
          })}
        </div>
      </div>
    </section>
  );
}

function SectionHeader({ count }: { readonly count: number }): JSX.Element {
  return (
    <div className="flex items-center gap-3">
      <h2 className="text-muted text-[13px] font-medium tracking-[0.06em] uppercase">
        Match History
      </h2>
      {count > 0 && (
        <span className="bg-border text-muted rounded-full px-2 py-px text-[11px] font-medium tabular-nums">
          {count}
        </span>
      )}
    </div>
  );
}
