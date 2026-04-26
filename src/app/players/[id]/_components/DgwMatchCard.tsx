import type { JSX } from 'react';
import { cn } from '@/lib/utils';
import { classifyReason } from './types';
import type { DgwPart, SnapshotPoint } from './types';
import { formatDelta, getPresentation } from './MatchHistoryCard';

export interface DgwMatchCardProps {
  readonly snapshot: SnapshotPoint;
  readonly parts: readonly DgwPart[];
}

// ── Sub-card for a single DGW match component ─────────────────────────────────

function DgwSubCard({ part }: { readonly part: DgwPart }): JSX.Element {
  const kind = classifyReason(part.reason);
  const { label, icon: Icon, iconClass } = getPresentation(kind, part.delta);
  const deltaColor =
    part.delta > 0 ? 'text-positive' : part.delta < 0 ? 'text-negative' : 'text-neutral';

  return (
    <div className="flex flex-1 flex-col items-center gap-1 py-1">
      <Icon className={cn('h-4 w-4', iconClass)} />
      <span className="text-muted text-center text-[9px] leading-tight font-medium">{label}</span>
      <span
        className={cn('text-[15px] leading-none font-semibold tabular-nums', deltaColor)}
        data-sign={part.delta > 0 ? 'positive' : part.delta < 0 ? 'negative' : 'neutral'}
      >
        {formatDelta(part.delta)}
      </span>
    </div>
  );
}

// ── DGW card — pair of sub-cards in a shared wrapper ─────────────────────────

/**
 * Renders a double-gameweek snapshot as two adjacent mini-cards sharing a
 * GW header and a net-delta footer, connected visually by the wrapper border.
 */
export function DgwMatchCard({ snapshot, parts }: DgwMatchCardProps): JSX.Element | null {
  const part1 = parts[0];
  const part2 = parts[1];
  if (part1 === undefined || part2 === undefined) return null;

  const { gameweek, delta: netDelta } = snapshot;
  const netColor = netDelta > 0 ? 'text-positive' : netDelta < 0 ? 'text-negative' : 'text-neutral';

  const bgClass = netDelta > 0 ? 'bg-positive/8' : netDelta < 0 ? 'bg-negative/8' : 'bg-border/30';

  return (
    <div
      className={cn(
        'border-border relative flex w-[168px] shrink-0 flex-col rounded-[10px] border',
        bgClass,
      )}
      role="listitem"
    >
      {/* Header: GW label + DGW badge */}
      <div className="flex items-center justify-between px-2.5 pt-2.5">
        <span className="text-muted font-mono text-[10px] font-medium tracking-[0.04em] uppercase">
          GW{gameweek.toString()}
        </span>
        <span className="bg-accent/12 text-accent rounded-sm px-1 py-px font-mono text-[8px] font-semibold tracking-[0.05em] uppercase">
          DGW
        </span>
      </div>

      {/* Two sub-cards separated by a hairline */}
      <div className="flex px-1.5 pt-1">
        <DgwSubCard part={part1} />
        <div className="bg-border/60 mx-1 w-px self-stretch" />
        <DgwSubCard part={part2} />
      </div>

      {/* Net delta footer */}
      <div className="border-border/40 mx-2.5 mt-1.5 mb-2.5 border-t border-dashed pt-1.5">
        <div className="flex items-center justify-between">
          <span className="text-muted font-mono text-[9px] tracking-[0.04em] uppercase">Net</span>
          <span
            className={cn('text-[12px] font-semibold tabular-nums', netColor)}
            data-sign={netDelta > 0 ? 'positive' : netDelta < 0 ? 'negative' : 'neutral'}
          >
            {formatDelta(netDelta)}
          </span>
        </div>
      </div>
    </div>
  );
}
