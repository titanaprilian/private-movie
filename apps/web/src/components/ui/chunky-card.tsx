import * as React from 'react';
import { cn } from '@/lib/utils';

export type ChunkyCardListProps = React.HTMLAttributes<HTMLDivElement>;

function ChunkyCardList({ className, ...props }: ChunkyCardListProps) {
  return (
    <div
      className={cn('flex flex-col gap-3', className)}
      {...props}
    />
  );
}

export interface ChunkyCardProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /** Green border + green-tint background for selected rows. */
  selected?: boolean;
  /** Enables hover lift (`translateY(-2px)`) for interactive rows. */
  interactive?: boolean;
}

function ChunkyCard({
  selected = false,
  interactive = false,
  className,
  ...props
}: ChunkyCardProps) {
  return (
    <div
      data-selected={selected || undefined}
      className={cn(
        'rounded-2xl border-2 border-b-4 bg-[var(--surface)] transition-all',
        selected
          ? 'border-[var(--green)] bg-[var(--green-soft)]'
          : 'border-[var(--border)]',
        interactive && 'hover:-translate-y-[2px] hover:shadow-lg cursor-pointer',
        className
      )}
      {...props}
    />
  );
}

export { ChunkyCardList, ChunkyCard };
