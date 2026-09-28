import * as React from 'react';
import { Check, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ChunkyCheckboxProps
  extends Omit<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    'onChange' | 'checked' | 'value'
  > {
  /** Controlled checked state. */
  checked?: boolean;
  /** Indeterminate (mixed) state. Rendered with a dash; sets `aria-checked="mixed"`. */
  indeterminate?: boolean;
  /** Fired with the next checked value on click / spacebar activation. */
  onCheckedChange?: (checked: boolean) => void;
}

const ChunkyCheckbox = React.forwardRef<
  HTMLButtonElement,
  ChunkyCheckboxProps
>(
  (
    {
      checked = false,
      indeterminate = false,
      onCheckedChange,
      onClick,
      disabled,
      className,
      type = 'button',
      ...props
    },
    ref
  ) => {
    const isChecked = indeterminate ? false : checked;

    const handleClick: React.MouseEventHandler<HTMLButtonElement> = (e) => {
      onClick?.(e);
      if (e.defaultPrevented || disabled) return;
      onCheckedChange?.(!checked);
    };

    return (
      <button
        ref={ref}
        type={type}
        role="checkbox"
        aria-checked={indeterminate ? 'mixed' : checked}
        aria-label={props['aria-label'] ?? 'Checkbox'}
        data-state={indeterminate ? 'indeterminate' : checked ? 'checked' : 'unchecked'}
        disabled={disabled}
        onClick={handleClick}
        className={cn(
          'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[8px] border-2 border-b-4 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)] focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 active:translate-y-[2px] active:border-b-2',
          isChecked || indeterminate
            ? 'bg-[var(--green)] border-[var(--green-dark)] text-white'
            : 'bg-[var(--surface)] border-[var(--border)] text-transparent hover:border-[var(--border-strong)]',
          className
        )}
        {...props}
      >
        {indeterminate ? (
          <Minus className="h-4 w-4 stroke-[3]" aria-hidden="true" />
        ) : (
          <Check
            className={cn(
              'h-4 w-4 stroke-[3]',
              !isChecked && 'opacity-0'
            )}
            aria-hidden="true"
          />
        )}
      </button>
    );
  }
);
ChunkyCheckbox.displayName = 'ChunkyCheckbox';

export { ChunkyCheckbox };
