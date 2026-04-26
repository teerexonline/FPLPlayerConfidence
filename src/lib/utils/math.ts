/** Clamps `value` to the inclusive range [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Piecewise linear map from confidence [-4, +5] to percentage [0, 100].
 * The 0-point anchors at 50% regardless of the asymmetric integer scale:
 *   v ≥ 0 → 50 + (v / 5) × 50   (+5 → 100%, 0 → 50%)
 *   v < 0 → 50 + (v / 4) × 50   (−4 → 0%, −2 → 25%)
 */
export function confidenceToPercent(value: number): number {
  if (value >= 0) return 50 + (value / 5) * 50;
  return 50 + (value / 4) * 50;
}
