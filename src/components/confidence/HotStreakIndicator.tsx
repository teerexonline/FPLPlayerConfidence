import type { JSX } from 'react';
import { cn } from '@/lib/utils';
import type { HotStreakLevel } from '@/lib/confidence/hotStreak';

// ── Constants ───────────────────────────────────────────────────────────────

const LEVEL_META: Record<HotStreakLevel, { label: string; dotClass: string; ringClass: string }> = {
  red_hot: {
    label: 'Red hot — boost in last 1 GW',
    dotClass: 'bg-[#f43f5e]',
    ringClass: 'bg-[#f43f5e]',
  },
  med_hot: {
    label: 'Hot — boost 2 GWs ago',
    dotClass: 'bg-[#fb923c]',
    ringClass: 'bg-[#fb923c]',
  },
  low_hot: {
    label: 'Warm — boost 3 GWs ago',
    dotClass: 'bg-[#f59e0b]',
    ringClass: 'bg-[#f59e0b]',
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
   * 'sm' — 6px dot only; used inline in player list rows.
   * 'lg' — 10px dot + pulse ring (red_hot only) + text label; used in headers.
   */
  readonly size?: 'sm' | 'lg';
  readonly className?: string;
}

// ── Component ───────────────────────────────────────────────────────────────

/**
 * Thermal signal indicator for a player's hot streak level.
 *
 * Renders a filled dot whose color encodes heat intensity. At `lg` size,
 * red_hot adds a pulsing ring (Tailwind animate-ping) so the signal is never
 * color-only: ring presence/absence provides a second axis.
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
        <span
          aria-hidden="true"
          className={cn('block h-[6px] w-[6px] rounded-full', meta.dotClass)}
        />
      </span>
    );
  }

  // lg variant
  const hasRing = level === 'red_hot';

  return (
    <span
      role="img"
      aria-label={label}
      className={cn('inline-flex shrink-0 items-center gap-1.5', className)}
    >
      {/* Dot with optional pulse ring */}
      <span
        aria-hidden="true"
        className="relative flex h-[10px] w-[10px] shrink-0 items-center justify-center"
      >
        {hasRing && (
          <span
            className={cn(
              'absolute inline-flex h-full w-full animate-ping rounded-full opacity-60',
              meta.ringClass,
            )}
          />
        )}
        <span className={cn('relative block h-[10px] w-[10px] rounded-full', meta.dotClass)} />
      </span>

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
