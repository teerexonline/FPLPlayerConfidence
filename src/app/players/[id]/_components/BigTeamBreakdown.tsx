import type { JSX } from 'react';
import { cn } from '@/lib/utils';
import { isBigTeamMatch } from './types';
import type { SnapshotPoint } from './types';

interface BigTeamBreakdownProps {
  readonly snapshots: readonly SnapshotPoint[];
}

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
  readonly label: string;
  readonly bucket: Bucket;
}

function StatBlock({ label, bucket }: StatBlockProps): JSX.Element {
  const color =
    bucket.avgDelta > 0 ? 'text-positive' : bucket.avgDelta < 0 ? 'text-negative' : 'text-neutral';
  const isEmpty = bucket.count === 0;

  return (
    <div className="border-border bg-surface flex-1 rounded-[10px] border p-5 dark:shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
      <p className="text-muted text-[11px] font-medium tracking-[0.06em] uppercase">{label}</p>
      <div className="mt-3 flex items-end gap-2">
        <span
          className={cn(
            'text-[28px] leading-none font-semibold tabular-nums',
            isEmpty ? 'text-muted' : color,
          )}
          data-sign={
            bucket.avgDelta > 0 ? 'positive' : bucket.avgDelta < 0 ? 'negative' : 'neutral'
          }
        >
          {isEmpty ? '—' : formatAvg(bucket.avgDelta)}
        </span>
        <span className="text-muted mb-0.5 text-[12px]">avg / match</span>
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
 * Side-by-side breakdown of average confidence delta split by opponent tier.
 * Uses `isBigTeamMatch` to classify each snapshot by its reason string.
 */
export function BigTeamBreakdown({ snapshots }: BigTeamBreakdownProps): JSX.Element {
  const bigTeam = snapshots.filter((s) => isBigTeamMatch(s.reason));
  const others = snapshots.filter((s) => !isBigTeamMatch(s.reason));

  const bigBucket = computeBucket(bigTeam);
  const otherBucket = computeBucket(others);

  return (
    <section aria-label="Big team breakdown" className="mt-12">
      <h2 className="text-muted text-[13px] font-medium tracking-[0.06em] uppercase">
        Performance breakdown
      </h2>
      <div className="mt-4 flex gap-3">
        <StatBlock label="vs Big Teams" bucket={bigBucket} />
        <StatBlock label="vs Others" bucket={otherBucket} />
      </div>
    </section>
  );
}
