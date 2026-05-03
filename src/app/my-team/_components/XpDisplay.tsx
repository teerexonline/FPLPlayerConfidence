import type { JSX } from 'react';

interface XpDisplayProps {
  /** Raw expected-points value from the API. Rounded to integer for display. */
  readonly value: number;
}

/**
 * Renders an integer expected-points value with an "xP" suffix. Used in both
 * StartingXIList and BenchSection to keep the projection-mode rendering
 * consistent across starters and bench.
 */
export function XpDisplay({ value }: XpDisplayProps): JSX.Element {
  const rounded = Math.round(value);
  return (
    <span
      className="text-text font-sans text-[13px] font-semibold tabular-nums"
      aria-label={`Projected ${rounded.toString()} expected points`}
      title="Expected points"
    >
      {rounded.toString()}
      <span className="text-muted ml-0.5 text-[10px] font-medium">xP</span>
    </span>
  );
}
