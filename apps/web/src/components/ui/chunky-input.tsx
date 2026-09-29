import * as React from 'react';
import { cn } from '@/lib/utils';

export type ChunkyInputProps =
  React.InputHTMLAttributes<HTMLInputElement>;

const ChunkyInput = React.forwardRef<HTMLInputElement, ChunkyInputProps>(
  ({ className, type = 'text', ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        data-testid="chunky-input"
        className={cn(
          'flex h-11 w-full rounded-2xl border-2 border-b-4 border-[var(--border)] bg-[var(--surface)] px-4 py-2 font-sans text-sm font-bold text-[var(--ink)] shadow-none transition-all placeholder:font-semibold placeholder:text-[var(--muted)] hover:border-[var(--border-strong)] focus-visible:outline-none focus-visible:border-[var(--blue)] focus-visible:ring-2 focus-visible:ring-[var(--blue)]/40 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-[var(--red)]',
          className
        )}
        {...props}
      />
    );
  }
);
ChunkyInput.displayName = 'ChunkyInput';

export { ChunkyInput };
