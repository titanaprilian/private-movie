import * as React from 'react';
import { cn } from '@/lib/utils';

export type ChunkyTableProps = React.HTMLAttributes<HTMLDivElement>;

function ChunkyTable({ className, ...props }: ChunkyTableProps) {
  return (
    <div className={cn('space-y-4', className)} {...props} />
  );
}

export type ChunkyTableToolbarProps =
  React.HTMLAttributes<HTMLDivElement>;

function ChunkyTableToolbar({ className, ...props }: ChunkyTableToolbarProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border-2 border-b-4 border-[var(--border)] bg-[var(--surface)] p-3 sm:p-4',
        className
      )}
      {...props}
    />
  );
}

export type ChunkyTableHeaderProps =
  React.HTMLAttributes<HTMLDivElement>;

function ChunkyTableHeader({ className, ...props }: ChunkyTableHeaderProps) {
  return (
    <div
      className={cn(
        'hidden items-center gap-3.5 px-4 pb-2 lg:grid font-sans text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]',
        className
      )}
      {...props}
    />
  );
}

export type ChunkyTableSortDirection = 'asc' | 'desc' | null;

export interface ChunkyTableHeaderCellProps
  extends React.HTMLAttributes<HTMLSpanElement> {
  /** Renders a clickable sort button with a direction indicator. */
  sortable?: boolean;
  /** Current sort direction; null renders the neutral ↕ indicator. */
  sortDirection?: ChunkyTableSortDirection;
  /** Fired when a sortable header cell is clicked. */
  onSort?: () => void;
}

const SORT_ARROWS: Record<'asc' | 'desc' | 'neutral', string> = {
  asc: '↑',
  desc: '↓',
  neutral: '↕',
};

function ChunkyTableHeaderCell({
  sortable = false,
  sortDirection = null,
  onSort,
  className,
  children,
  ...props
}: ChunkyTableHeaderCellProps) {
  if (!sortable) {
    return (
      <span className={cn('truncate', className)} {...props}>
        {children}
      </span>
    );
  }
  const arrow =
    sortDirection === 'asc'
      ? SORT_ARROWS.asc
      : sortDirection === 'desc'
        ? SORT_ARROWS.desc
        : SORT_ARROWS.neutral;
  return (
    <span className={cn('truncate', className)} {...props}>
      <button
        type="button"
        onClick={onSort}
        aria-sort={
          sortDirection === 'asc'
            ? 'ascending'
            : sortDirection === 'desc'
              ? 'descending'
              : 'none'
        }
        className="inline-flex cursor-pointer items-center gap-1 uppercase tracking-wider transition-colors hover:text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)]"
      >
        <span className="truncate">{children}</span>
        <span aria-hidden="true">{arrow}</span>
      </button>
    </span>
  );
}

export type ChunkyTableBodyProps = React.HTMLAttributes<HTMLDivElement>;

function ChunkyTableBody({ className, ...props }: ChunkyTableBodyProps) {
  return (
    <div className={cn('flex flex-col gap-3', className)} {...props} />
  );
}

export interface ChunkyTableRowProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /** Green border + green-tint background for selected rows. */
  selected?: boolean;
  /** Enables hover lift (`translateY(-2px)`) for interactive rows. */
  interactive?: boolean;
  /** Elevated shadow + slight transparency while drag-and-drop reordering. */
  dragging?: boolean;
}

const ChunkyTableRow = React.forwardRef<HTMLDivElement, ChunkyTableRowProps>(
  (
    { selected = false, interactive = false, dragging = false, className, ...props },
    ref
  ) => {
    return (
      <div
        ref={ref}
        data-selected={selected || undefined}
        data-dragging={dragging || undefined}
        className={cn(
          'rounded-2xl border-2 border-b-4 bg-[var(--bg)] transition-all',
          selected
            ? 'border-[var(--green)] bg-[var(--green-soft)]'
            : 'border-[var(--border)]',
          interactive &&
            'hover:-translate-y-[2px] hover:shadow-lg cursor-pointer',
          dragging && 'shadow-lg opacity-90 scale-[1.01]',
          className
        )}
        {...props}
      />
    );
  }
);
ChunkyTableRow.displayName = 'ChunkyTableRow';

export type ChunkyTableCellProps = React.HTMLAttributes<HTMLDivElement>;

function ChunkyTableCell({ className, ...props }: ChunkyTableCellProps) {
  return <div className={cn('min-w-0', className)} {...props} />;
}

export interface ChunkyTableIndexBadgeProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /** 1-based row number to display. */
  index: number;
}

function ChunkyTableIndexBadge({
  index,
  className,
  ...props
}: ChunkyTableIndexBadgeProps) {
  return (
    <div
      className={cn(
        'grid h-10 w-10 shrink-0 place-items-center rounded-xl border-2 border-b-4 border-[var(--border)] bg-[var(--surface)] text-[15px] font-extrabold text-[var(--blue)]',
        className
      )}
      {...props}
    >
      {index}
    </div>
  );
}

export {
  ChunkyTable,
  ChunkyTableToolbar,
  ChunkyTableHeader,
  ChunkyTableHeaderCell,
  ChunkyTableBody,
  ChunkyTableRow,
  ChunkyTableCell,
  ChunkyTableIndexBadge,
};
