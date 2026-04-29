import type { JSX } from 'react';
import { Flame } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { HotStreakInfo, HotStreakLevel } from '@/lib/confidence/hotStreak';

// ── Constants ───────────────────────────────────────────────────────────────

const LEVEL_META: Record<HotStreakLevel, { label: string; colorClass: string }> = {
  hot: { label: 'Hot', colorClass: 'text-[#f43f5e]' },
  warm: { label: 'Warm', colorClass: 'text-[#fb923c]' },
  mild: { label: 'Mild', colorClass: 'text-[#94a3b8]' },
};

// ── Props ───────────────────────────────────────────────────────────────────

export interface HotStreakIndicatorProps {
  readonly hotStreak: HotStreakInfo | null;
  /**
   * 'sm' — 12px flame icon + hover tooltip; used inline in player list rows.
   * 'lg' — 16px flame + stacked text label + boost-GW sublabel; used in headers.
   */
  readonly size?: 'sm' | 'lg';
  readonly className?: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function buildTooltip(hotStreak: HotStreakInfo): string {
  const sign = hotStreak.boostDelta > 0 ? '+' : '';
  const base = `Hot streak: ${sign}${hotStreak.boostDelta.toString()} boost`;
  return hotStreak.boostGw !== null ? `${base} in GW${hotStreak.boostGw.toString()}` : base;
}

// ── Component ───────────────────────────────────────────────────────────────

/**
 * Thermal signal indicator for a player's hot streak.
 *
 * Color encodes boost magnitude (not recency) — hot/warm/mild stays constant
 * across all 3 matches in the streak window. At `lg` size, `hot` adds
 * animate-pulse and shows the boost GW as a sublabel.
 *
 * Returns null when hotStreak is null (player is cold).
 */
export function HotStreakIndicator({
  hotStreak,
  size = 'sm',
  className,
}: HotStreakIndicatorProps): JSX.Element | null {
  if (hotStreak === null) return null;

  const meta = LEVEL_META[hotStreak.level];
  const tooltip = buildTooltip(hotStreak);
  const gwText = hotStreak.boostGw !== null ? `GW${hotStreak.boostGw.toString()}` : null;

  if (size === 'sm') {
    return (
      <span
        role="img"
        aria-label={tooltip}
        title={tooltip}
        className={cn('inline-flex shrink-0 items-center', className)}
      >
        <Flame aria-hidden="true" className={cn('h-3 w-3', meta.colorClass)} />
      </span>
    );
  }

  // lg variant
  const isPulsing = hotStreak.level === 'hot';

  return (
    <span
      role="img"
      aria-label={tooltip}
      className={cn('inline-flex shrink-0 items-center gap-1.5', className)}
    >
      <Flame
        aria-hidden="true"
        className={cn('h-4 w-4', meta.colorClass, isPulsing && 'animate-pulse')}
      />

      {/* Stacked label: magnitude name + boost GW context */}
      <span aria-hidden="true" className="flex flex-col items-start">
        <span className="font-mono text-[10px] font-semibold tracking-[0.06em] uppercase">
          {meta.label}
        </span>
        {gwText !== null && (
          <span className="text-muted font-mono text-[9px] leading-none font-medium">{gwText}</span>
        )}
      </span>
    </span>
  );
}
