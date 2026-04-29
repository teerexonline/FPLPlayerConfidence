'use client';

import type { JSX } from 'react';
import { computeHotStreakAtMatch } from '@/lib/confidence/hotStreak';
import type { MatchBrief } from '@/lib/confidence/hotStreak';
import { MatchHistoryCard } from './MatchHistoryCard';
import { DgwMatchCard } from './DgwMatchCard';
import { parseDgwReason } from './types';
import type { DgwPart, SnapshotPoint } from './types';

interface MatchHistoryStripProps {
  readonly snapshots: readonly SnapshotPoint[];
  /** The currently selected GW — card receives accent ring when matched. */
  readonly selectedGw?: number;
  /** Called when the user clicks a match card. */
  readonly onSelectGw?: (gw: number) => void;
}

// ── Pre-computed per-card metadata ────────────────────────────────────────────

interface SingleCardMeta {
  isDgw: false;
  orderA: number;
  orderB: null;
}
interface DgwCardMeta {
  isDgw: true;
  dgwParts: readonly DgwPart[];
  orderA: number;
  orderB: number;
}
type CardMeta = SingleCardMeta | DgwCardMeta;

/**
 * Builds a flat MatchBrief list and per-card metadata from the snapshot array.
 * DGW snapshots produce two consecutive MatchBrief entries (one per sub-match),
 * so the streak burns through sub-matches rather than gameweeks.
 * Snapshots are sorted by gameweek first to ensure matchOrders are chronological.
 */
function buildMatchData(snapshots: readonly SnapshotPoint[]): {
  matchBriefs: MatchBrief[];
  cardMetas: CardMeta[];
  sortedSnapshots: SnapshotPoint[];
} {
  const sortedSnapshots = [...snapshots].sort((a, b) => a.gameweek - b.gameweek);
  const matchBriefs: MatchBrief[] = [];
  const cardMetas: CardMeta[] = [];
  let cursor = 0;

  for (const s of sortedSnapshots) {
    const dgwParts = parseDgwReason(s.reason);
    if (dgwParts !== null && dgwParts.length >= 2) {
      cardMetas.push({ isDgw: true, dgwParts, orderA: cursor, orderB: cursor + 1 });
      for (const part of dgwParts) {
        matchBriefs.push({ matchOrder: cursor, delta: part.delta, gameweek: s.gameweek });
        cursor++;
      }
    } else {
      cardMetas.push({ isDgw: false, orderA: cursor, orderB: null });
      matchBriefs.push({ matchOrder: cursor, delta: s.delta, gameweek: s.gameweek });
      cursor++;
    }
  }

  return { matchBriefs, cardMetas, sortedSnapshots };
}

/**
 * Horizontal-scrolling strip of match history cards, oldest → newest (left → right).
 * Masked on both edges with a fade so the scroll affordance is clear.
 * Streak levels are computed per-match (not per-GW) so DGW sub-matches each
 * consume one streak step — correctly accelerating streak decay for DGW players.
 */
export function MatchHistoryStrip({
  snapshots,
  selectedGw,
  onSelectGw,
}: MatchHistoryStripProps): JSX.Element {
  if (snapshots.length === 0) {
    return (
      <section aria-label="Match history" className="mt-12">
        <SectionHeader count={0} />
        <p className="text-muted mt-4 text-center text-[13px]">No match history yet.</p>
      </section>
    );
  }

  const { matchBriefs, cardMetas, sortedSnapshots } = buildMatchData(snapshots);

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
          {sortedSnapshots.map((snapshot, i) => {
            const meta = cardMetas[i];
            if (meta === undefined) return null;
            const isSelected = selectedGw === snapshot.gameweek;
            const clickProps = onSelectGw
              ? {
                  onClick: () => {
                    onSelectGw(snapshot.gameweek);
                  },
                }
              : {};
            const streakA = computeHotStreakAtMatch(matchBriefs, meta.orderA);

            return meta.isDgw ? (
              <DgwMatchCard
                key={snapshot.gameweek}
                snapshot={snapshot}
                parts={meta.dgwParts}
                hotStreakA={streakA}
                hotStreakB={computeHotStreakAtMatch(matchBriefs, meta.orderB)}
                isSelected={isSelected}
                {...clickProps}
              />
            ) : (
              <MatchHistoryCard
                key={snapshot.gameweek}
                snapshot={snapshot}
                hotStreak={streakA}
                isSelected={isSelected}
                {...clickProps}
              />
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
