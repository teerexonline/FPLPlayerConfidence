'use client';

import { useRouter } from 'next/navigation';
import type { JSX } from 'react';

export function EmptyFilterState(): JSX.Element {
  const router = useRouter();

  function clearFilters(): void {
    router.push('/players', { scroll: false });
  }

  return (
    <div className="flex flex-col items-center py-24 text-center" role="status">
      <div className="border-border bg-surface mb-5 flex h-12 w-12 items-center justify-center rounded-full border">
        <svg
          width={20}
          height={20}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          className="text-muted"
          aria-hidden="true"
        >
          <circle cx={11} cy={11} r={8} />
          <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
          <path d="M8 11h6" strokeLinecap="round" />
        </svg>
      </div>

      <p className="text-text text-[14px] font-semibold">No players match your filters</p>
      <p className="text-muted mt-1.5 max-w-[260px] text-[13px] leading-relaxed">
        Try broadening your search or adjusting the position and confidence filters.
      </p>

      <button
        type="button"
        onClick={clearFilters}
        className="border-border bg-surface text-text hover:border-accent/40 focus-visible:ring-accent mt-5 h-8 rounded-[6px] border px-4 text-[13px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none active:opacity-80"
      >
        Clear all filters
      </button>
    </div>
  );
}
