import * as React from 'react';
import { cn } from '@/lib/utils';

export type ChunkySkeletonProps = React.HTMLAttributes<HTMLDivElement>;

function ChunkySkeleton({ className, ...props }: ChunkySkeletonProps) {
  return (
    <div
      data-testid="chunky-skeleton"
      aria-hidden="true"
      className={cn(
        'animate-pulse rounded-2xl bg-[var(--surface-raised)] border border-[var(--border)]',
        className
      )}
      {...props}
    />
  );
}

export { ChunkySkeleton };
