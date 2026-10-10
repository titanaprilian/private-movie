import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ChunkyChip } from '@/components/ui/chunky-chip';
import { cn } from '@/lib/utils';

export interface ChunkyPaginationBarProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
  className?: string;
}

export function ChunkyPaginationBar({
  currentPage,
  totalPages,
  onPageChange,
  disabled = false,
  className,
}: ChunkyPaginationBarProps) {
  if (totalPages <= 1) {
    return null;
  }

  const isFirstPage = currentPage <= 1 || disabled;
  const isLastPage = currentPage >= totalPages || disabled;
  const displayPage = Math.min(Math.max(currentPage, 1), totalPages);

  return (
    <nav
      aria-label="Pagination"
      className={cn(
        'mt-7 flex items-center justify-center gap-4',
        className
      )}
    >
      <ChunkyChip
        type="button"
        variant="default"
        disabled={isFirstPage}
        onClick={() => onPageChange(currentPage - 1)}
        aria-label="Previous page"
        className="disabled:cursor-not-allowed disabled:opacity-40 disabled:active:translate-y-0 disabled:active:border-b-4"
      >
        <ChevronLeft aria-hidden="true" />
        Previous
      </ChunkyChip>
      <span
        aria-live="polite"
        className="font-extrabold text-[14px] text-[var(--muted)] min-w-[120px] text-center"
      >
        Page {displayPage} of {totalPages}
      </span>
      <ChunkyChip
        type="button"
        variant="default"
        disabled={isLastPage}
        onClick={() => onPageChange(currentPage + 1)}
        aria-label="Next page"
        className="disabled:cursor-not-allowed disabled:opacity-40 disabled:active:translate-y-0 disabled:active:border-b-4"
      >
        Next
        <ChevronRight aria-hidden="true" />
      </ChunkyChip>
    </nav>
  );
}
