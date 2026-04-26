import type { JSX } from 'react';

interface PlayerStatusIndicatorProps {
  /** FPL status code: 'a'=available, 'd'=doubtful, 'i'=injured, 's'=suspended, 'n'=not available, 'u'=unavailable. */
  readonly status: string;
  readonly chanceOfPlaying: number | null;
  readonly news: string;
}

type DotVariant = 'amber' | 'red' | 'gray';

function dotVariant(status: string): DotVariant | null {
  if (status === 'a' || status === '') return null;
  if (status === 'd' || status === 'n') return 'amber';
  if (status === 'i' || status === 's') return 'red';
  if (status === 'u') return 'gray';
  return 'amber'; // unknown status — flag conservatively
}

const DOT_CLASSES: Record<DotVariant, string> = {
  amber: 'bg-status-warning',
  red: 'bg-status-danger',
  gray: 'bg-status-muted',
};

/**
 * A small colored status dot shown when a player has a non-available FPL status.
 * Returns null for status='a' (available) — no icon shown.
 * Tooltip combines news text and chance-of-playing percentage when present.
 */
export function PlayerStatusIndicator({
  status,
  chanceOfPlaying,
  news,
}: PlayerStatusIndicatorProps): JSX.Element | null {
  const variant = dotVariant(status);
  if (variant === null) return null;

  const parts: string[] = [];
  if (news) parts.push(news);
  if (chanceOfPlaying !== null) parts.push(`${chanceOfPlaying.toString()}% chance to play`);
  const tooltip = parts.join(' · ');

  return (
    <span
      className={`inline-block h-[6px] w-[6px] shrink-0 rounded-full ${DOT_CLASSES[variant]}`}
      title={tooltip || undefined}
      aria-label={tooltip || `Player status: ${status}`}
      role="img"
    />
  );
}
