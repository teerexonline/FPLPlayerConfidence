import Link from 'next/link';
import type { JSX } from 'react';

export function WatchlistCard(): JSX.Element {
  return (
    <section
      className="border-border bg-surface flex flex-col rounded-[8px] border px-4 pt-5 pb-4"
      aria-label="Watchlist"
    >
      {/* Card header */}
      <h2 className="text-muted mb-4 font-sans text-[11px] font-semibold tracking-[0.06em] uppercase">
        Watchlist
      </h2>

      {/* Empty state — h-[168px] matches BiggestMoversCard's 3-player content height */}
      <div className="flex h-[168px] flex-col items-center justify-center gap-3">
        {/* Pin icon */}
        <svg
          width={28}
          height={28}
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          className="text-border"
        >
          <path
            d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        <div className="text-center">
          <p className="text-text font-sans text-[14px] font-medium">No watchlist yet</p>
          <p className="text-muted mt-1 max-w-[200px] font-sans text-[12px] leading-snug">
            Pin players from the players list to track them here.
          </p>
        </div>

        <Link
          href="/players"
          className="border-border bg-bg text-text hover:border-accent hover:text-accent focus-visible:ring-accent inline-flex h-8 items-center rounded-[6px] border px-3 font-sans text-[12px] font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          Browse players
        </Link>
      </div>
    </section>
  );
}
