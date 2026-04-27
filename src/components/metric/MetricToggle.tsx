'use client';

import type { JSX } from 'react';
import { cn } from '@/lib/utils';
import type { MetricMode } from './useMetricMode';
import { METRIC_MODES, useMetricMode } from './useMetricMode';

const LABELS: Record<MetricMode, string> = {
  c: 'Confidence',
  g: 'P(Goal)',
  a: 'P(Assist)',
};

/**
 * Three-pill mode selector wired to ?metric= URL state.
 * Active pill: accent fill. Inactive: etched/muted. No animation — instant snap.
 * Place in the page header of any surface that respects the metric toggle.
 */
export function MetricToggle(): JSX.Element {
  const { mode, setMode } = useMetricMode();

  return (
    <div
      role="group"
      aria-label="Display metric"
      className={cn(
        // Recessed tray: inset border + dim background, like a physical mode switch
        'inline-flex items-center gap-px',
        'border-border bg-bg rounded-[6px] border p-0.5',
        'shadow-[inset_0_1px_2px_rgba(0,0,0,0.08)]',
      )}
    >
      {METRIC_MODES.map((m) => {
        const active = m === mode;
        return (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
            }}
            aria-pressed={active}
            aria-label={LABELS[m]}
            className={cn(
              // Base: compact square pill, monospaced-weight text
              'inline-flex h-[26px] w-8 items-center justify-center rounded-[4px]',
              'text-[11px] font-bold tracking-[0.06em] uppercase',
              // Focus ring
              'focus-visible:ring-accent focus-visible:ring-offset-bg focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none',
              // Active: accent fill, high contrast
              active && 'bg-accent text-white shadow-[0_1px_2px_rgba(0,0,0,0.2)]',
              // Inactive: muted, subtle hover
              !active && 'text-muted hover:bg-surface hover:text-text',
            )}
          >
            {m.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
