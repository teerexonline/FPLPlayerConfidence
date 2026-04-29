'use client';

import type { JSX } from 'react';
import { HotStreakIndicator } from './HotStreakIndicator';
import type { HotStreakInfo } from '@/lib/confidence/hotStreak';

export interface LivePlayerStreakIndicatorProps {
  readonly hotStreak: HotStreakInfo | null;
  /** FPL status code: 'a'=available, 'd'=doubtful, 'i'=injured, 's'=suspended, etc. */
  readonly status: string;
  /** True when the player has < 2 snapshots in the recent 3-GW window. */
  readonly isStale: boolean;
  readonly size?: 'sm' | 'lg';
  readonly className?: string;
}

/**
 * Conditional wrapper around HotStreakIndicator for live player surfaces.
 *
 * Hides the flame when the player is unavailable (any non-'a' status) or has
 * stale data, because the streak signal becomes misleading — an injured or
 * data-stale player is not a good pick regardless of past form.
 *
 * Match History cards bypass this and use HotStreakIndicator directly; those
 * flames describe what was true at the time of each match, not the live state.
 */
export function LivePlayerStreakIndicator({
  hotStreak,
  status,
  isStale,
  size = 'sm',
  className,
}: LivePlayerStreakIndicatorProps): JSX.Element | null {
  if (status !== 'a' && status !== '') return null;
  if (isStale) return null;
  return (
    <HotStreakIndicator
      hotStreak={hotStreak}
      size={size}
      {...(className !== undefined ? { className } : {})}
    />
  );
}
