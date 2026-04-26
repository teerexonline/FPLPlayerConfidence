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
  /** Integer in [-4, +5]. Values outside this range are clamped defensively. */
  value: number;
  size?: 'sm' | 'md' | 'xl';
  /** When true (default), counts up from 0 on mount and from old value on change. */
  animated?: boolean;
  className?: string;
}

type Sign = 'positive' | 'negative' | 'neutral';

/**
 * Maps a raw confidence integer (potentially mid-animation float) to the
 * percentage display string. No decimal — individual player values are
 * integer-derived so the fractional part is only transient during animation.
 */
function formatConfidence(v: number): string {
  return `${Math.round(confidenceToPercent(v)).toString()}%`;
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
};

/**
 * The hero number component. Renders a confidence value as a percentage with
 * semantic color, three sizes, and an optional count-up animation.
 * ≥50% → green, <50% → red, exactly 50% → neutral.
 * Respects the prefers-reduced-motion media query.
 */
export function ConfidenceNumber({
  value,
  size = 'md',
  animated = true,
  className,
}: ConfidenceNumberProps): JSX.Element {
  const clampedValue = clamp(value, CONFIDENCE_MIN, CONFIDENCE_MAX);
  // Integer sign maps 1:1 to the percentage threshold: >0 → >50%, <0 → <50%, =0 → 50%
  const sign: Sign = clampedValue > 0 ? 'positive' : clampedValue < 0 ? 'negative' : 'neutral';

  const prefersReducedMotion = useReducedMotion() ?? false;
  const shouldAnimate = animated && !prefersReducedMotion;

  const motionValue = useMotionValue(shouldAnimate ? 0 : clampedValue);
  const displayText = useTransform(motionValue, formatConfidence);

  useEffect(() => {
    if (value !== clampedValue) {
      logger.warn('ConfidenceNumber: value outside [-4, +5] — clamped', {
        received: value,
        clamped: clampedValue,
      });
    }
  }, [value, clampedValue]);

  useEffect(() => {
    if (shouldAnimate) {
      void animate(motionValue, clampedValue, { duration: 0.6, ease: 'easeOut' });
    } else {
      motionValue.set(clampedValue);
    }
  }, [clampedValue, shouldAnimate, motionValue]);

  const percent = Math.round(confidenceToPercent(clampedValue));

  const sharedProps = {
    className: cn(
      'font-sans tabular-nums',
      SIZE_CLASSES[size],
      SIGN_COLOR_CLASSES[sign],
      className,
    ),
    'data-sign': sign,
    'data-size': size,
    'aria-label': `Confidence: ${percent.toString()}%`,
  };

  if (!shouldAnimate) {
    return <span {...sharedProps}>{formatConfidence(clampedValue)}</span>;
  }

  return <motion.span {...sharedProps}>{displayText}</motion.span>;
}
