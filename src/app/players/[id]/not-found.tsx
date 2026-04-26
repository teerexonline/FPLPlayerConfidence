import type { JSX } from 'react';
import Link from 'next/link';

export default function PlayerNotFound(): JSX.Element {
  return (
    <div className="bg-bg text-text flex min-h-screen flex-col items-center justify-center px-4 font-sans">
      <div className="w-full max-w-sm text-center">
        {/* Ghost jersey illustration */}
        <div className="mb-8 flex justify-center">
          <svg width="80" height="100" viewBox="0 0 80 100" fill="none" aria-hidden="true">
            <path
              d="M16 6 L6 24 L18 26 L18 90 L62 90 L62 26 L74 24 L64 6 L52 10 C50 18 30 18 28 10 Z"
              className="fill-border stroke-border"
              strokeWidth="1"
            />
            <path
              d="M16 6 L6 24 L18 26 L18 90 L62 90 L62 26 L74 24 L64 6 L52 10 C50 18 30 18 28 10 Z"
              fill="none"
              className="stroke-muted/20"
              strokeWidth="1"
              strokeDasharray="4 3"
            />
          </svg>
        </div>

        <h1 className="text-text text-[22px] font-semibold tracking-[-0.01em]">Player not found</h1>
        <p className="text-muted mt-3 text-[14px] leading-relaxed">
          They may have been transferred out of the league, or this ID doesn&rsquo;t exist in our
          database.
        </p>

        <Link
          href="/players"
          className="bg-accent text-surface focus-visible:ring-accent mt-8 inline-flex h-9 items-center rounded-[6px] px-4 text-[14px] font-medium transition-colors hover:opacity-90 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          Back to players
        </Link>
      </div>
    </div>
  );
}
