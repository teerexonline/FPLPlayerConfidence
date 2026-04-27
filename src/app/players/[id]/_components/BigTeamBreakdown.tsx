import type { JSX } from 'react';
import { cn } from '@/lib/utils';
import type { SnapshotPoint } from './types';

interface FdrBreakdownProps {
  readonly snapshots: readonly SnapshotPoint[];
}

type FdrTier = 'favorable' | 'neutral' | 'tough';

function extractFdr(reason: string): number | null {
  const match = /vs FDR (\d) opponent/.exec(reason);
  return match?.[1] !== undefined ? parseInt(match[1], 10) : null;
}

function classifyFdrTier(fdr: number): FdrTier {
  if (fdr <= 2) return 'favorable';
  if (fdr === 3) return 'neutral';
  return 'tough';
}

const TIER_CONFIG: Record<
  FdrTier,
  { label: string; range: string; dotClass: string; labelClass: string }
> = {
  favorable: {
    label: 'Favorable',
    range: 'FDR 1–2',
    dotClass: 'bg-positive',
    labelClass: 'text-positive',
  },
  neutral: {
    label: 'Neutral',
    range: 'FDR 3',
    dotClass: 'bg-neutral',
    labelClass: 'text-muted',
  },
  tough: {
    label: 'Tough',
    range: 'FDR 4–5',
    dotClass: 'bg-negative',
    labelClass: 'text-negative',
  },
};

interface Bucket {
  readonly count: number;
  readonly avgDelta: number;
}

function computeBucket(snaps: readonly SnapshotPoint[]): Bucket {
  if (snaps.length === 0) return { count: 0, avgDelta: 0 };
  const total = snaps.reduce((sum, s) => sum + s.delta, 0);
  return {
    count: snaps.length,
    avgDelta: Math.round((total / snaps.length) * 10) / 10,
  };
}

function formatAvg(avg: number): string {
  if (avg > 0) return `+${avg.toFixed(1)}`;
  if (avg < 0) return `−${Math.abs(avg).toFixed(1)}`; // Unicode minus
  return '0.0';
}

interface StatBlockProps {
  readonly tier: FdrTier;
  readonly bucket: Bucket;
}

function StatBlock({ tier, bucket }: StatBlockProps): JSX.Element {
  const config = TIER_CONFIG[tier];
  const deltaColor =
    bucket.avgDelta > 0 ? 'text-positive' : bucket.avgDelta < 0 ? 'text-negative' : 'text-neutral';
  const isEmpty = bucket.count === 0;

  return (
    <div className="border-border bg-surface flex-1 rounded-[10px] border p-4 dark:shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
      <div className="flex items-center gap-1.5">
        <span
          className={cn('h-[6px] w-[6px] shrink-0 rounded-full', config.dotClass)}
          aria-hidden="true"
        />
        <p
          className={cn('text-[10px] font-semibold tracking-[0.06em] uppercase', config.labelClass)}
        >
          {config.label}
        </p>
      </div>
      <p className="text-muted mt-0.5 text-[10px]">{config.range}</p>
      <div className="mt-3 flex items-end gap-1.5">
        <span
          className={cn(
            'text-[26px] leading-none font-semibold tabular-nums',
            isEmpty ? 'text-muted' : deltaColor,
          )}
          data-sign={
            bucket.avgDelta > 0 ? 'positive' : bucket.avgDelta < 0 ? 'negative' : 'neutral'
          }
        >
          {isEmpty ? '—' : formatAvg(bucket.avgDelta)}
        </span>
        <span className="text-muted mb-0.5 text-[11px]">avg / match</span>
      </div>
      <p className="text-muted mt-1.5 text-[12px] tabular-nums">
        {isEmpty
          ? 'No matches'
          : `${bucket.count.toString()} match${bucket.count === 1 ? '' : 'es'}`}
      </p>
    </div>
  );
}

/**
 * Three-bucket FDR breakdown of average confidence delta by opponent difficulty.
 * Classifies each snapshot's opponent by parsing the "vs FDR X opponent" token
 * embedded in all reason strings, then buckets into:
 *   FDR 1–2 → Favorable (green), FDR 3 → Neutral (gray), FDR 4–5 → Tough (red).
 * DGW snapshots are classified by the first match in the compound reason string.
 * Snapshots with no parsable FDR token (edge case) are excluded from all buckets.
 */
export function FdrBreakdown({ snapshots }: FdrBreakdownProps): JSX.Element {
  const bucketMap: Record<FdrTier, SnapshotPoint[]> = {
    favorable: [],
    neutral: [],
    tough: [],
  };

  for (const snap of snapshots) {
    const fdr = extractFdr(snap.reason);
    if (fdr === null) continue;
    const tier = classifyFdrTier(fdr);
    bucketMap[tier].push(snap);
  }

  return (
    <section aria-label="FDR performance breakdown" className="mt-12">
      <h2 className="text-muted text-[13px] font-medium tracking-[0.06em] uppercase">
        Performance breakdown
      </h2>
      <div className="mt-4 flex gap-3">
        <StatBlock tier="favorable" bucket={computeBucket(bucketMap.favorable)} />
        <StatBlock tier="neutral" bucket={computeBucket(bucketMap.neutral)} />
        <StatBlock tier="tough" bucket={computeBucket(bucketMap.tough)} />
      </div>
    </section>
  );
}
