import type { JSX } from 'react';
import { cn } from '@/lib/utils';

interface PositionalBreakdownProps {
  readonly defencePercent: number;
  readonly midfieldPercent: number;
  readonly attackPercent: number;
  /** Actual starter counts per line, derived from the squad picks. */
  readonly defenceCount: number;
  readonly midfieldCount: number;
  readonly attackCount: number;
}

type Sign = 'positive' | 'negative' | 'neutral';

function sign(pct: number): Sign {
  if (pct > 50) return 'positive';
  if (pct < 50) return 'negative';
  return 'neutral';
}

const SIGN_COLOR: Record<Sign, string> = {
  positive: 'text-positive',
  negative: 'text-negative',
  neutral: 'text-neutral',
};

interface LineCardProps {
  readonly label: string;
  readonly percent: number;
  readonly playerCount: number;
}

function LineCard({ label, percent, playerCount }: LineCardProps): JSX.Element {
  const s = sign(percent);
  return (
    <div className="border-border bg-surface flex flex-col items-center rounded-[8px] border px-4 py-5">
      <span
        className={cn(
          'font-sans text-[32px] leading-none font-semibold tabular-nums',
          SIGN_COLOR[s],
        )}
        data-sign={s}
      >
        {percent.toFixed(1)}%
      </span>
      <span className="text-text mt-2 font-sans text-[13px] font-medium">{label}</span>
      <span className="text-muted mt-0.5 font-sans text-[11px]">
        {playerCount.toString()} player{playerCount !== 1 ? 's' : ''}
      </span>
    </div>
  );
}

/**
 * Three-card positional breakdown: Defence / Midfield / Attack.
 * Shows each line's confidence as a percent, color-coded relative to 50%.
 */
export function PositionalBreakdown({
  defencePercent,
  midfieldPercent,
  attackPercent,
  defenceCount,
  midfieldCount,
  attackCount,
}: PositionalBreakdownProps): JSX.Element {
  return (
    <section aria-label="Positional breakdown" className="mb-8">
      <h2 className="text-muted mb-3 font-sans text-[11px] font-semibold tracking-[0.06em] uppercase">
        By Position
      </h2>
      <div className="grid grid-cols-3 gap-3">
        <LineCard label="Defence" percent={defencePercent} playerCount={defenceCount} />
        <LineCard label="Midfield" percent={midfieldPercent} playerCount={midfieldCount} />
        <LineCard label="Attack" percent={attackPercent} playerCount={attackCount} />
      </div>
    </section>
  );
}
