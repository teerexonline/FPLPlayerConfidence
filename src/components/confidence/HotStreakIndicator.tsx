import type { JSX } from 'react';
import { Flame } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { HotStreakLevel } from '@/lib/confidence/hotStreak';

// ── Constants ───────────────────────────────────────────────────────────────

const LEVEL_META: Record<
  HotStreakLevel,
  { label: string; streakLabel: string; colorClass: string }
> = {
  red_hot: {
    label: 'Fresh',
    streakLabel: 'Fresh streak',
    colorClass: 'text-[#f43f5e]',
  },
  med_hot: {
    label: 'Recent',
    streakLabel: 'Recent streak',
    colorClass: 'text-[#fb923c]',
  },
  low_hot: {
    label: 'Fading',
    streakLabel: 'Fading streak',
    colorClass: 'text-[#f59e0b]',
  },
};

// ── Props ───────────────────────────────────────────────────────────────────

export interface HotStreakIndicatorProps {
  readonly level: HotStreakLevel | null;
  /**
   * The gameweek whose streak state this indicator represents.
   * Used in the GW label (lg) and tooltip (sm) so the user always knows
   * which gameweek context they are looking at — especially important
   * when scrubbing historical GWs on the My Team page.
   */
  readonly currentGW: number;
  /**
   * 'sm' — 12px flame icon + hover tooltip; used inline in player list rows.
   * 'lg' — 16px flame + stacked text label + GW sublabel; used in headers.
   */
  readonly size?: 'sm' | 'lg';
  readonly className?: string;
}

// ── Component ───────────────────────────────────────────────────────────────

/**
 * Thermal signal indicator for a player's hot streak level.
 *
 * Renders a Flame icon whose color encodes heat intensity. At `lg` size,
 * red_hot adds animate-pulse and a stacked GW sublabel so the signal is
 * contextual and never color-only.
 *
 * Returns null when level is null (player is cold).
 */
export function HotStreakIndicator({
  level,
  currentGW,
  size = 'sm',
  className,
}: HotStreakIndicatorProps): JSX.Element | null {
  if (level === null) return null;

  const meta = LEVEL_META[level];
  const gwText = `GW${currentGW.toString()}`;
  const ariaLabel = `${meta.streakLabel} · ${gwText}`;

  if (size === 'sm') {
    return (
      <span
        role="img"
        aria-label={ariaLabel}
        title={ariaLabel}
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
      aria-label={ariaLabel}
      className={cn('inline-flex shrink-0 items-center gap-1.5', className)}
    >
      <Flame
        aria-hidden="true"
        className={cn('h-4 w-4', meta.colorClass, isPulsing && 'animate-pulse')}
      />

      {/* Stacked label: level name + GW context */}
      <span aria-hidden="true" className="flex flex-col items-start">
        <span className="font-mono text-[10px] font-semibold tracking-[0.06em] uppercase">
          {meta.label}
        </span>
        <span className="text-muted font-mono text-[9px] leading-none font-medium">{gwText}</span>
      </span>
    </span>
  );
}
