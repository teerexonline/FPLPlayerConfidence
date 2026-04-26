'use client';

import { useEffect, useRef } from 'react';
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react';
import type { JSX } from 'react';
import { cn } from '@/lib/utils';

interface MyTeamHeroProps {
  /** Team Confidence %, 0–100 rounded to 2 dp. */
  readonly percent: number;
  readonly defencePercent: number;
  readonly midfieldPercent: number;
  readonly attackPercent: number;
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

function formatPct(v: number): string {
  return `${v.toFixed(1)}%`;
}

function LinePercent({ label, value }: { label: string; value: number }): JSX.Element {
  const s = sign(value);
  return (
    <span className="tabular-nums">
      <span className="text-muted">{label} · </span>
      <span className={cn('font-medium', SIGN_COLOR[s])}>{formatPct(value)}</span>
    </span>
  );
}

/**
 * Hero section for the My Team page.
 * Renders Team Confidence % at 96px with a count-up from 50% on mount,
 * followed by the three positional line percents.
 */
export function MyTeamHero({
  percent,
  defencePercent,
  midfieldPercent,
  attackPercent,
}: MyTeamHeroProps): JSX.Element {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const motionValue = useMotionValue(prefersReducedMotion ? percent : 50);
  const displayText = useTransform(motionValue, (v) => formatPct(v));
  const mounted = useRef(false);

  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    if (!prefersReducedMotion) {
      void animate(motionValue, percent, { duration: 0.7, ease: 'easeOut' });
    }
  }, [percent, prefersReducedMotion, motionValue]);

  const heroSign = sign(percent);

  return (
    <div className="flex flex-col items-center py-10 text-center">
      {/* Big percentage */}
      <motion.span
        className={cn(
          'font-sans text-[96px] leading-none font-semibold tracking-[-0.02em] tabular-nums',
          SIGN_COLOR[heroSign],
        )}
        aria-label={`Team Confidence: ${formatPct(percent)}`}
        data-sign={heroSign}
      >
        {displayText}
      </motion.span>

      <p className="text-muted mt-2 font-sans text-[12px] font-medium tracking-[0.06em] uppercase">
        Team Confidence
      </p>

      {/* Positional breakdown */}
      <div className="text-muted mt-5 flex flex-col gap-1 font-sans text-[13px]">
        <LinePercent label="Defence" value={defencePercent} />
        <LinePercent label="Midfield" value={midfieldPercent} />
        <LinePercent label="Attack" value={attackPercent} />
      </div>
    </div>
  );
}
