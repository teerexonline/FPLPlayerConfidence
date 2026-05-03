import type { JSX } from 'react';
import { cn } from '@/lib/utils';
import { confidenceToPercent } from '@/lib/team-confidence';

interface XpPrimaryProps {
  /** Projected xP for the next gameweek. Null when no fixture or no data. */
  readonly nextGwXp: number | null;
  /** Raw confidence in [-5, +5]. Shown as a small colored sub-line. */
  readonly confidence: number;
}

function confidenceTone(c: number): string {
  if (c > 0) return 'text-positive';
  if (c < 0) return 'text-negative';
  return 'text-muted';
}

/**
 * xP-first display: the projected expected-points value is the visual focus,
 * with the underlying confidence percentage as a small colored sub-line.
 *
 * Rationale: xP is what the user is actually planning around (how many points
 * will this player score?). Confidence is the upstream signal feeding xP, so
 * showing both at equal prominence is redundant — but keeping confidence as
 * a small colored hint preserves the green/red form signal.
 */
export function XpPrimary({ nextGwXp, confidence }: XpPrimaryProps): JSX.Element {
  const pct = Math.round(confidenceToPercent(confidence));
  const sign = confidence > 0 ? '+' : '';
  return (
    <span
      className="inline-flex flex-col items-end leading-tight tabular-nums"
      title={`Projected xP for next GW. Confidence ${sign}${confidence.toString()} (${pct.toString()}%)`}
      aria-label={
        nextGwXp === null
          ? `Confidence ${sign}${confidence.toString()}`
          : `Projected ${Math.round(nextGwXp).toString()} xP, confidence ${sign}${confidence.toString()}`
      }
    >
      {nextGwXp === null ? (
        <span className="text-muted/60 font-mono text-[12px]">—</span>
      ) : (
        <span className="text-text font-sans text-[16px] font-semibold">
          {Math.round(nextGwXp).toString()}
          <span className="text-muted ml-0.5 text-[10px] font-medium">xP</span>
        </span>
      )}
      <span className={cn('font-sans text-[10px] font-medium', confidenceTone(confidence))}>
        {pct.toString()}%
      </span>
    </span>
  );
}
