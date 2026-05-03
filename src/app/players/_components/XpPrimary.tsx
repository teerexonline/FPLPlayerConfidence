import type { JSX } from 'react';

interface XpPrimaryProps {
  /** Projected xP for the next gameweek. Null when no fixture or no data. */
  readonly nextGwXp: number | null;
  /**
   * Optional confidence (raw, [-5, +5]) — used only for the aria-label so
   * screen-reader users still hear the underlying signal even though it's
   * intentionally not rendered visually. The detail page is where confidence
   * lives in the visual hierarchy.
   */
  readonly confidence?: number;
}

/**
 * xP-only display: the projected expected-points value, integer rounded.
 *
 * Confidence is no longer shown on list views — it's the model's transparency
 * layer, surfaced only on the player detail page. This keeps every list row
 * focused on the single number that drives FPL decisions: projected points.
 */
export function XpPrimary({ nextGwXp, confidence }: XpPrimaryProps): JSX.Element {
  const sign = confidence !== undefined && confidence > 0 ? '+' : '';
  const ariaLabel =
    nextGwXp === null
      ? confidence !== undefined
        ? `No projected xP. Confidence ${sign}${confidence.toString()}`
        : 'No projected xP'
      : confidence !== undefined
        ? `Projected ${Math.round(nextGwXp).toString()} xP, confidence ${sign}${confidence.toString()}`
        : `Projected ${Math.round(nextGwXp).toString()} xP`;
  return (
    <span
      className="inline-flex items-baseline gap-0.5 tabular-nums"
      title="Projected expected points for the next gameweek"
      aria-label={ariaLabel}
    >
      {nextGwXp === null ? (
        <span className="text-muted/60 font-mono text-[12px]">—</span>
      ) : (
        <>
          <span className="text-text font-sans text-[16px] font-semibold">
            {Math.round(nextGwXp).toString()}
          </span>
          <span className="text-muted text-[10px] font-medium">xP</span>
        </>
      )}
    </span>
  );
}
