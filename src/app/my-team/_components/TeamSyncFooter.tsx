import type { JSX } from 'react';

interface TeamSyncFooterProps {
  /** Unix ms timestamp from sync_meta.last_sync. */
  readonly syncedAt: number;
  readonly gameweek: number;
  /** Clears localStorage team ID and returns to the empty state. */
  readonly onChangeTeam: () => void;
}

function formatTimeAgo(syncedAt: number): string {
  const diffMs = Date.now() - syncedAt;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin.toString()} minute${diffMin !== 1 ? 's' : ''} ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr.toString()} hour${diffHr !== 1 ? 's' : ''} ago`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays.toString()} day${diffDays !== 1 ? 's' : ''} ago`;
}

export function TeamSyncFooter({
  syncedAt,
  gameweek,
  onChangeTeam,
}: TeamSyncFooterProps): JSX.Element {
  return (
    <footer className="border-border mt-4 flex items-center justify-between border-t pt-4 pb-12">
      <p className="text-muted font-sans text-[12px]">
        GW{gameweek.toString()} · Confidence data synced {formatTimeAgo(syncedAt)}
      </p>
      <button
        type="button"
        onClick={onChangeTeam}
        className="text-muted hover:text-text focus-visible:ring-accent cursor-pointer font-sans text-[12px] underline underline-offset-2 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        Change team ID
      </button>
    </footer>
  );
}
