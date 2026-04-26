import type { JSX } from 'react';

function Bone({ className }: { readonly className: string }): JSX.Element {
  return <div className={`bg-border animate-pulse rounded-md ${className}`} aria-hidden="true" />;
}

/**
 * Loading skeleton for the player detail page.
 * Matches the final layout exactly to avoid CLS:
 * - header (jersey + name + meta)
 * - hero number + slider
 * - strip (8 card bones)
 * - chart area
 * - two stat blocks
 */
export default function PlayerDetailLoading(): JSX.Element {
  return (
    <div
      className="bg-bg text-text min-h-screen font-sans"
      aria-busy="true"
      aria-label="Loading player"
    >
      <div className="mx-auto max-w-[1280px] px-4 pb-24 sm:px-8">
        {/* Back link */}
        <div className="py-6">
          <Bone className="h-4 w-16" />
        </div>

        {/* Header skeleton */}
        <div className="flex flex-col items-center gap-6 pt-2 sm:flex-row sm:items-end sm:gap-10 sm:pt-4">
          <Bone className="h-[120px] w-[90px] rounded-lg sm:h-[160px]" />
          <div className="space-y-3 text-center sm:text-left">
            <Bone className="mx-auto h-10 w-48 sm:mx-0" />
            <div className="flex items-center gap-2">
              <Bone className="h-4 w-20" />
              <Bone className="h-6 w-10 rounded-full" />
              <Bone className="h-4 w-12" />
            </div>
            <Bone className="mx-auto h-3 w-28 sm:mx-0" />
          </div>
        </div>

        {/* Confidence hero skeleton */}
        <div className="mt-12 flex flex-col items-center gap-6 py-10">
          <Bone className="h-24 w-32" />
          <Bone className="h-7 w-full max-w-[320px] rounded-full" />
          <Bone className="h-4 w-48" />
        </div>

        {/* Match history strip skeleton */}
        <div className="mt-12">
          <Bone className="mb-4 h-4 w-28" />
          <div className="flex gap-2.5 overflow-hidden pb-4">
            {Array.from({ length: 8 }, (_, i) => (
              <Bone key={i} className="h-[140px] w-20 shrink-0 rounded-[10px]" />
            ))}
          </div>
        </div>

        {/* Chart skeleton */}
        <div className="mt-12">
          <Bone className="mb-4 h-4 w-40" />
          <Bone className="h-[220px] w-full rounded-lg" />
        </div>

        {/* Breakdown skeleton */}
        <div className="mt-12">
          <Bone className="mb-4 h-4 w-44" />
          <div className="flex gap-3">
            <Bone className="h-28 flex-1 rounded-[10px]" />
            <Bone className="h-28 flex-1 rounded-[10px]" />
          </div>
        </div>
      </div>
    </div>
  );
}
