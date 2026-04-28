/**
 * Returns the Tailwind color class for a player's name text based on their
 * availability status and data freshness. Priority: injury/suspension > doubtful >
 * stale data > default.
 *
 * Mirrors the color semantics of PlayerStatusIndicator's dot variants so the
 * name color and the dot always agree on severity.
 */
export function getPlayerNameColorClass(status: string, recentAppearances: number): string {
  if (status === 'i' || status === 's') return 'text-status-danger';
  if (status === 'd' || status === 'n') return 'text-status-warning';
  if (status === 'u') return 'text-muted';
  if (recentAppearances < 2) return 'text-muted';
  return 'text-text';
}
