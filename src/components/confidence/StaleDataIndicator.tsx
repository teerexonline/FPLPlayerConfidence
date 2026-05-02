import type { JSX } from 'react';

interface StaleDataIndicatorProps {
  /** True when the player's last snapshot is more than STALE_GW_THRESHOLD GWs behind current. */
  readonly isStale: boolean;
}

/**
 * A muted clock icon shown when `isStale` is true. Signals that the confidence
 * value may not reflect the player's current form.
 */
export function StaleDataIndicator({ isStale }: StaleDataIndicatorProps): JSX.Element | null {
  if (!isStale) return null;

  const tooltip = 'Confidence data may be stale · May not reflect current form';

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
