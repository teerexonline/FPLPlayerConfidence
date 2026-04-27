'use client';

import { useEffect } from 'react';
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react';
import type { JSX } from 'react';
import { createLogger } from '@/lib/logger';
import { clamp, confidenceToPercent } from '@/lib/utils/math';
import { cn } from '@/lib/utils';

const logger = createLogger('ConfidenceNumber');

const CONFIDENCE_MIN = -4;
const CONFIDENCE_MAX = 5;

export interface ConfidenceNumberProps {
  /**
   * In mode="c" (default): integer in [-4, +5] — values outside range are clamped.
   * In mode="g" / mode="a": raw probability in [0, 1].
   */
  value: number;
  /** Controls color treatment and number formatting. Default: 'c' (Confidence). */
  mode?: 'c' | 'g' | 'a';
  size?: 'sm' | 'md' | 'xl';
  /** When true (default), counts up from 0 on mount and from old value on change. */
  animated?: boolean;
  className?: string;
}

type Sign = 'positive' | 'negative' | 'neutral' | 'accent';

/**
 * Maps a raw confidence integer (potentially mid-animation float) to the
 * percentage display string. No decimal — individual player values are
 * integer-derived so the fractional part is only transient during animation.
 */
function formatConfidence(v: number): string {
  return `${Math.round(confidenceToPercent(v)).toString()}%`;
}

/** Formats a raw probability [0, 1] as a rounded integer percentage. */
function formatProbability(v: number): string {
  return `${Math.round(v * 100).toString()}%`;
}

const SIZE_CLASSES: Record<NonNullable<ConfidenceNumberProps['size']>, string> = {
  xl: 'text-[96px] leading-none font-semibold tracking-[-0.02em]',
  md: 'text-[32px] leading-none font-semibold',
  sm: 'text-[16px] leading-none font-semibold',
};

const SIGN_COLOR_CLASSES: Record<Sign, string> = {
  positive: 'text-positive',
  negative: 'text-negative',
  neutral: 'text-neutral',
  accent: 'text-accent',
};

const ARIA_LABEL_PREFIX: Record<NonNullable<ConfidenceNumberProps['mode']>, string> = {
  c: 'Confidence',
  g: 'Goal probability',
  a: 'Assist probability',
};

/**
 * The hero number component. Renders a metric value as a percentage with
 * semantic color, three sizes, and an optional count-up animation.
 *
 * mode="c" (default): Confidence — ≥50% green, <50% red, =50% neutral.
 * mode="g" / mode="a": Probability — accent color, no sign prefix.
 *
 * Respects the prefers-reduced-motion media query.
 */
export function ConfidenceNumber({
  value,
  mode = 'c',
  size = 'md',
  animated = true,
  className,
}: ConfidenceNumberProps): JSX.Element {
  const isProbMode = mode !== 'c';

  // C mode: clamp to [-4, 5] confidence range.
  // G/A mode: clamp to [0, 1] probability range.
  const clampedValue = isProbMode
    ? clamp(value, 0, 1)
    : clamp(value, CONFIDENCE_MIN, CONFIDENCE_MAX);

  const sign: Sign = isProbMode
    ? 'accent'
    : clampedValue > 0
      ? 'positive'
      : clampedValue < 0
        ? 'negative'
        : 'neutral';

  const formatFn = isProbMode ? formatProbability : formatConfidence;

  const prefersReducedMotion = useReducedMotion() ?? false;
  const shouldAnimate = animated && !prefersReducedMotion;

  const motionValue = useMotionValue(shouldAnimate ? 0 : clampedValue);
  const displayText = useTransform(motionValue, formatFn);

  useEffect(() => {
    if (!isProbMode && value !== clampedValue) {
      logger.warn('ConfidenceNumber: value outside [-4, +5] — clamped', {
        received: value,
        clamped: clampedValue,
      });
    }
  }, [value, clampedValue, isProbMode]);

  useEffect(() => {
    if (shouldAnimate) {
      void animate(motionValue, clampedValue, { duration: 0.6, ease: 'easeOut' });
    } else {
      motionValue.set(clampedValue);
    }
  }, [clampedValue, shouldAnimate, motionValue]);

  const displayPercent = Math.round(
    isProbMode ? clampedValue * 100 : confidenceToPercent(clampedValue),
  );

  const sharedProps = {
    className: cn(
      'font-sans tabular-nums',
      SIZE_CLASSES[size],
      SIGN_COLOR_CLASSES[sign],
      className,
    ),
    'data-sign': sign,
    'data-size': size,
    'aria-label': `${ARIA_LABEL_PREFIX[mode]}: ${displayPercent.toString()}%`,
  };

  if (!shouldAnimate) {
    return <span {...sharedProps}>{formatFn(clampedValue)}</span>;
  }

  return <motion.span {...sharedProps}>{displayText}</motion.span>;
}
