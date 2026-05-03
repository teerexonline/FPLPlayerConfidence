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
import type { MyTeamViewMode } from './types';

interface MyTeamHeroProps {
  /** Retained for backward compat (callers still pass it); the hero is xP-first regardless. */
  readonly viewMode?: MyTeamViewMode;
  /** Team Confidence %, retained but unused — kept so callers don't need a refactor. */
  readonly percent: number;
  readonly defencePercent: number;
  readonly midfieldPercent: number;
  readonly attackPercent: number;
  /** Per-line xP totals — shown in the breakdown row beneath the hero number. */
  readonly defenceXp: number;
  readonly midfieldXp: number;
  readonly attackXp: number;
  /** Projected team xP. Always shown as the hero number now. */
  readonly projectedTeamXp?: number | null;
  /** Viewed gameweek — shown next to the projection so the user knows what they are seeing. */
  readonly gameweek?: number;
}

type Sign = 'positive' | 'negative' | 'neutral';

function LineXp({ label, value }: { label: string; value: number }): JSX.Element {
  return (
    <span className="tabular-nums">
      <span className="text-muted">{label} · </span>
      <span className="text-text font-medium">{Math.round(value).toString()}</span>
      <span className="text-muted ml-0.5 text-[10px]">xP</span>
    </span>
  );
}

function formatXp(v: number): string {
  return Math.round(v).toString();
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
  defenceXp,
  midfieldXp,
  attackXp,
  projectedTeamXp,
  gameweek,
}: MyTeamHeroProps): JSX.Element {
  // The hero is always xP-first now — Confidence calculations were retired
  // from My Team. The viewMode/percent/percent-breakdown props are still
  // accepted to avoid touching every caller, but they're not rendered.
  const targetValue = projectedTeamXp ?? 0;
  const fallbackStart = 0;

  const prefersReducedMotion = useReducedMotion() ?? false;
  const motionValue = useMotionValue(prefersReducedMotion ? targetValue : fallbackStart);
  // Mirror the motion value into React state so the text node is typed as a ReactNode
  // (rendering MotionValue<string> directly is supported at runtime but not by motion's types).
  const [animValue, setAnimValue] = useState<number>(() => motionValue.get());
  useMotionValueEvent(motionValue, 'change', setAnimValue);
  const displayText = formatXp(animValue);
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

  const heroSign: Sign = 'positive';
  const heroLabel = `Projected ${formatXp(projectedTeamXp ?? 0)} expected points${
    gameweek !== undefined ? ` for GW${gameweek.toString()}` : ''
  }`;

  return (
    <div className="flex flex-col items-center py-10 text-center">
      {/* Big number */}
      <motion.span
        className="text-text font-sans text-[96px] leading-none font-semibold tracking-[-0.02em] tabular-nums"
        aria-label={heroLabel}
        data-sign={heroSign}
      >
        {displayText}
        <span className="text-muted ml-1.5 align-text-bottom font-sans text-[24px] font-medium">
          xP
        </span>
      </motion.span>

      <p className="text-muted mt-2 font-sans text-[12px] font-medium tracking-[0.06em] uppercase">
        Projected GW{gameweek !== undefined ? gameweek.toString() : ''} Points
      </p>

      {/* Positional breakdown — per-line xP totals for the starting XI. */}
      <div className="text-muted mt-5 flex flex-col gap-1 font-sans text-[13px]">
        <LineXp label="Defence" value={defenceXp} />
        <LineXp label="Midfield" value={midfieldXp} />
        <LineXp label="Attack" value={attackXp} />
      </div>
    </div>
  );
}
