import type { JSX } from 'react';
import { Flame } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { HotStreakLevel } from '@/lib/confidence/hotStreak';

// ── Constants ───────────────────────────────────────────────────────────────

const LEVEL_META: Record<HotStreakLevel, { label: string; colorClass: string }> = {
  red_hot: {
    label: 'Red hot — boost in last 1 GW',
    colorClass: 'text-[#f43f5e]',
  },
  med_hot: {
    label: 'Hot — boost 2 GWs ago',
    colorClass: 'text-[#fb923c]',
  },
  low_hot: {
    label: 'Warm — boost 3 GWs ago',
    colorClass: 'text-[#f59e0b]',
  },
};

const LEVEL_TEXT: Record<HotStreakLevel, string> = {
  red_hot: 'Red hot',
  med_hot: 'Hot',
  low_hot: 'Warm',
};

// ── Props ───────────────────────────────────────────────────────────────────

export interface HotStreakIndicatorProps {
  readonly level: HotStreakLevel | null;
  /**
   * 'sm' — 12px flame icon only; used inline in player list rows.
   * 'lg' — 16px flame + text label; red_hot adds animate-pulse; used in headers.
   */
  readonly size?: 'sm' | 'lg';
  readonly className?: string;
}

// ── Component ───────────────────────────────────────────────────────────────

/**
 * Thermal signal indicator for a player's hot streak level.
 *
 * Renders a Flame icon whose color encodes heat intensity. At `lg` size,
 * red_hot adds animate-pulse so the signal is never color-only: animation
 * presence/absence provides a second axis.
 *
 * Returns null when level is null (player is cold).
 */
export function HotStreakIndicator({
  level,
  size = 'sm',
  className,
}: HotStreakIndicatorProps): JSX.Element | null {
  if (level === null) return null;

  const meta = LEVEL_META[level];
  const label = meta.label;

  if (size === 'sm') {
    return (
      <span
        role="img"
        aria-label={label}
        className={cn('inline-flex shrink-0 items-center', className)}
      >
        <Flame aria-hidden="true" className={cn('h-3 w-3', meta.colorClass)} />
      </span>
    );
  }

  // lg variant
  const isPulsing = level === 'red_hot';

  return (
    <span
      role="img"
      aria-label={label}
      className={cn('inline-flex shrink-0 items-center gap-1.5', className)}
    >
      <Flame
        aria-hidden="true"
        className={cn('h-4 w-4', meta.colorClass, isPulsing && 'animate-pulse')}
      />

      {/* Text label */}
      <span
        aria-hidden="true"
        className="font-mono text-[10px] font-semibold tracking-[0.06em] uppercase"
        style={{ color: 'currentColor' }}
      >
        {LEVEL_TEXT[level]}
      </span>
    </span>
  );
}
