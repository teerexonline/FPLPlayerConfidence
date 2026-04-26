'use client';

import { useRef, useEffect } from 'react';
import { motion, animate, useMotionValue, useTransform } from 'motion/react';
import type { JSX } from 'react';
import { cn } from '@/lib/utils';

export interface ConfidenceSliderProps {
  /** Integer in [−4, +5]. */
  readonly value: number;
  /**
   * When true, fires a brief scale pulse on the pill — used by ConfidenceHero
   * to signal after the count-up animation completes.
   */
  readonly pulsed?: boolean;
  readonly className?: string;
}

// Percentage tick marks — five clean reference points along the 0–100% axis.
const TICKS = [0, 25, 50, 75, 100] as const;

/**
 * Maps a confidence integer to a track position [0%, 100%] using the piecewise
 * formula. The track is geometrically consistent with the percentage display:
 * 0-mark sits at 50%, −4 at 0%, +5 at 100%.
 */
function toPercent(v: number): number {
  if (v >= 0) return 50 + (v / 5) * 50;
  return 50 + (v / 4) * 50;
}

/**
 * Horizontal track with an animated pill marker and semantic fill.
 * Tick labels show 0%, 25%, 50%, 75%, 100% — the percentage scale.
 * The pill displays the player's current percentage value.
 * Animates from 0 on mount; pulses when `pulsed` fires.
 */
export function ConfidenceSlider({
  value,
  pulsed = false,
  className,
}: ConfidenceSliderProps): JSX.Element {
  const clamped = Math.max(-4, Math.min(5, Math.round(value)));
  const sign = clamped > 0 ? 'positive' : clamped < 0 ? 'negative' : 'neutral';
  const currentPercent = Math.round(toPercent(clamped));

  const pillRef = useRef<HTMLDivElement>(null);

  const animatedValue = useMotionValue(0);
  const pillLeft = useTransform(animatedValue, (v) => `${toPercent(v).toString()}%`);
  const pillText = useTransform(animatedValue, (v) => `${Math.round(toPercent(v)).toString()}%`);

  const fillLeft = useTransform(animatedValue, (v) => {
    const pct = toPercent(v);
    return `${Math.min(pct, 50).toString()}%`;
  });
  const fillWidth = useTransform(animatedValue, (v) => {
    const pct = toPercent(v);
    return `${Math.abs(pct - 50).toString()}%`;
  });

  useEffect(() => {
    void animate(animatedValue, clamped, { duration: 0.6, ease: 'easeOut' });
  }, [clamped, animatedValue]);

  useEffect(() => {
    if (pulsed && pillRef.current) {
      void animate(pillRef.current, { scale: [1, 1.18, 1] }, { duration: 0.25, ease: 'easeOut' });
    }
  }, [pulsed]);

  const fillColorClass =
    sign === 'positive' ? 'bg-positive' : sign === 'negative' ? 'bg-negative' : 'bg-neutral';

  return (
    <div
      role="meter"
      aria-valuemin={-4}
      aria-valuemax={5}
      aria-valuenow={clamped}
      aria-label={`Confidence: ${currentPercent.toString()}%`}
      className={cn('w-full', className)}
    >
      {/* Track */}
      <div className="bg-border/50 relative mx-auto h-2 w-full max-w-[320px] rounded-full">
        {/* Zero-mark hairline at 50% */}
        <div
          aria-hidden="true"
          className="bg-border/80 absolute top-1/2 left-1/2 h-3 w-px -translate-x-1/2 -translate-y-1/2"
        />

        {/* Animated fill */}
        <motion.div
          aria-hidden="true"
          className={cn('absolute top-0 h-full rounded-full opacity-70', fillColorClass)}
          style={{ left: fillLeft, width: fillWidth }}
        />

        {/* Pill marker */}
        <motion.div
          ref={pillRef}
          aria-hidden="true"
          style={{ left: pillLeft, translateX: '-50%', translateY: '-50%' }}
          className={cn(
            'border-border bg-surface absolute top-1/2 flex h-7 min-w-[44px] items-center justify-center rounded-full border px-2.5 shadow-sm',
          )}
        >
          <motion.span
            className={cn(
              'text-[11px] font-semibold tabular-nums',
              sign === 'positive' && 'text-positive',
              sign === 'negative' && 'text-negative',
              sign === 'neutral' && 'text-neutral',
            )}
          >
            {pillText}
          </motion.span>
        </motion.div>
      </div>

      {/* Tick labels — five percentage reference points */}
      <div
        className="mx-auto mt-3 flex w-full max-w-[320px] justify-between px-0.5"
        aria-hidden="true"
      >
        {TICKS.map((pct) => (
          <span
            key={pct}
            className={cn('text-[9px] tabular-nums', pct === 50 ? 'text-muted' : 'text-muted/50')}
          >
            {pct.toString()}%
          </span>
        ))}
      </div>
    </div>
  );
}
