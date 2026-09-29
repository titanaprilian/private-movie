import * as React from 'react';
import { cn } from '@/lib/utils';

export type ChunkyTextareaProps =
  React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const ChunkyTextarea = React.forwardRef<
  HTMLTextAreaElement,
  ChunkyTextareaProps
>(({ className, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      data-testid="chunky-textarea"
      className={cn(
        'flex min-h-[96px] w-full rounded-2xl border-2 border-b-4 border-[var(--border)] bg-[var(--surface)] px-4 py-2 font-sans text-sm font-bold text-[var(--ink)] shadow-none transition-all placeholder:font-semibold placeholder:text-[var(--muted)] hover:border-[var(--border-strong)] focus-visible:outline-none focus-visible:border-[var(--blue)] focus-visible:ring-2 focus-visible:ring-[var(--blue)]/40 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-[var(--red)]',
        className
      )}
      {...props}
    />
  );
});
ChunkyTextarea.displayName = 'ChunkyTextarea';

export { ChunkyTextarea };
