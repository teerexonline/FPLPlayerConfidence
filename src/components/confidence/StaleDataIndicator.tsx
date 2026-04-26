import type { JSX } from 'react';

interface StaleDataIndicatorProps {
  /** Count of snapshots in the last 3 GW window (0–3). */
  readonly recentAppearances: number;
}

/**
 * A muted clock icon shown when a player has fewer than 2 snapshots in the
 * most recent 3-gameweek window. Signals that the confidence value may not
 * reflect the player's current form.
 *
 * Returns null when recentAppearances >= 2 (signal is considered fresh).
 */
export function StaleDataIndicator({
  recentAppearances,
}: StaleDataIndicatorProps): JSX.Element | null {
  if (recentAppearances >= 2) return null;

  const tooltip = `Played ${recentAppearances.toString()}/3 recent gameweeks · Confidence may not reflect current form`;

  return (
    <span
      title={tooltip}
      aria-label={tooltip}
      role="img"
      className="text-muted/50 inline-flex shrink-0 items-center"
    >
      {/* Clock icon — inline SVG avoids lucide-react dependency */}
      <svg
        width={10}
        height={10}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx={12} cy={12} r={10} />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    </span>
  );
}
