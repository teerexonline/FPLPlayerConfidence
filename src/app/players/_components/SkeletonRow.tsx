import type { JSX } from 'react';
import { cn } from '@/lib/utils';

export function SkeletonRow(): JSX.Element {
  return (
    <div
      aria-hidden="true"
      className="border-border grid h-14 grid-cols-[1fr_88px_60px_72px_56px_72px_96px_36px] items-center border-b px-4 last:border-0"
    >
      {/* Player: avatar + name stack */}
      <div className="flex items-center gap-3">
        <Bone className="h-8 w-8 rounded-full" />
        <div className="flex flex-col gap-1.5">
          <Bone className="h-3 w-28 rounded" />
          <Bone className="h-2.5 w-16 rounded" />
        </div>
      </div>
      {/* Team */}
      <div className="flex items-center gap-2">
        <Bone className="h-5 w-5 rounded-sm" />
        <Bone className="h-3 w-9 rounded" />
      </div>
      {/* Position chip */}
      <Bone className="h-5 w-10 rounded-full" />
      {/* Price */}
      <Bone className="h-3.5 w-12 rounded" />
      {/* Status indicators */}
      <Bone className="h-3 w-8 rounded" />
      {/* xP */}
      <Bone className="ml-auto h-4 w-10 rounded" />
      {/* Trend */}
      <Bone className="h-3.5 w-16 rounded" />
      {/* Star */}
      <Bone className="h-4 w-4 rounded" />
    </div>
  );
}

function Bone({ className }: { readonly className: string }): JSX.Element {
  return <div className={cn('bg-border animate-pulse', className)} />;
}
