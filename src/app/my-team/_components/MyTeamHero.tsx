'use client';

import { useEffect, useRef, useState } from 'react';
import {
  animate,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
} from 'motion/react';
import type { JSX } from 'react';
import { cn } from '@/lib/utils';
import type { MyTeamViewMode } from './types';

interface MyTeamHeroProps {
  /** `historical` shows percent; `projected` shows xP. */
  readonly viewMode?: MyTeamViewMode;
  /** Team Confidence %, 0–100 rounded to 2 dp. Used in `historical` mode. */
  readonly percent: number;
  readonly defencePercent: number;
  readonly midfieldPercent: number;
  readonly attackPercent: number;
  /** Projected team xP. Required in `projected` mode; ignored in `historical`. */
  readonly projectedTeamXp?: number | null;
  /** Viewed gameweek — shown next to the projection so the user knows what they are seeing. */
  readonly gameweek?: number;
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

function formatXp(v: number): string {
  return v.toFixed(1);
}

/**
 * Hero section for the My Team page.
 *
 * `historical` mode (default): renders Team Confidence % at 96px with a
 * count-up from 50% on mount, followed by the three positional line percents.
 *
 * `projected` mode: renders projected team xP for the viewed gameweek with the
 * same scale and animation. The positional breakdown stays in % terms because
 * a per-line xP would be misleading without normalising for the number of
 * fixtures each line has.
 */
export function MyTeamHero({
  viewMode = 'historical',
  percent,
  defencePercent,
  midfieldPercent,
  attackPercent,
  projectedTeamXp,
  gameweek,
}: MyTeamHeroProps): JSX.Element {
  const isProjected = viewMode === 'projected';
  const targetValue = isProjected ? (projectedTeamXp ?? 0) : percent;
  const fallbackStart = isProjected ? 0 : 50;

  const prefersReducedMotion = useReducedMotion() ?? false;
  const motionValue = useMotionValue(prefersReducedMotion ? targetValue : fallbackStart);
  // Mirror the motion value into React state so the text node is typed as a ReactNode
  // (rendering MotionValue<string> directly is supported at runtime but not by motion's types).
  const [animValue, setAnimValue] = useState<number>(() => motionValue.get());
  useMotionValueEvent(motionValue, 'change', setAnimValue);
  const displayText = isProjected ? formatXp(animValue) : formatPct(animValue);
  const mounted = useRef(false);

  useEffect(() => {
    if (mounted.current) {
      // GW scrubber or mode changed — snap without animation.
      motionValue.set(targetValue);
      return;
    }
    mounted.current = true;
    if (prefersReducedMotion) {
      motionValue.set(targetValue);
    } else {
      void animate(motionValue, targetValue, { duration: 0.7, ease: 'easeOut' });
    }
  }, [targetValue, prefersReducedMotion, motionValue]);

  const heroSign = isProjected ? 'positive' : sign(percent);
  const heroLabel = isProjected
    ? `Projected ${formatXp(projectedTeamXp ?? 0)} expected points${
        gameweek !== undefined ? ` for GW${gameweek.toString()}` : ''
      }`
    : `Team Confidence: ${formatPct(percent)}`;

  return (
    <div className="flex flex-col items-center py-10 text-center">
      {/* Big number */}
      <motion.span
        className={cn(
          'font-sans text-[96px] leading-none font-semibold tracking-[-0.02em] tabular-nums',
          isProjected ? 'text-text' : SIGN_COLOR[heroSign],
        )}
        aria-label={heroLabel}
        data-sign={heroSign}
      >
        {displayText}
        {isProjected && (
          <span className="text-muted ml-1.5 align-text-bottom font-sans text-[24px] font-medium">
            xP
          </span>
        )}
      </motion.span>

      <p className="text-muted mt-2 font-sans text-[12px] font-medium tracking-[0.06em] uppercase">
        {isProjected
          ? `Projected GW${gameweek !== undefined ? gameweek.toString() : ''} Points`
          : 'Team Confidence'}
      </p>

      {/* Positional breakdown — stays as % in both modes (line-level xP would be noisy) */}
      <div className="text-muted mt-5 flex flex-col gap-1 font-sans text-[13px]">
        <LinePercent label="Defence" value={defencePercent} />
        <LinePercent label="Midfield" value={midfieldPercent} />
        <LinePercent label="Attack" value={attackPercent} />
      </div>
    </div>
  );
}
