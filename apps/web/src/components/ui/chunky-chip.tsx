import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const chunkyChipVariants = cva(
  'inline-flex items-center justify-center gap-2 h-11 min-h-11 px-3.5 rounded-[14px] border-2 border-b-4 font-extrabold text-[13px] uppercase tracking-[0.7px] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)] disabled:pointer-events-none disabled:opacity-50 cursor-pointer active:translate-y-[2px] active:border-b-2 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-[var(--bg)] border-[var(--border)] text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--ink)]',
        active:
          'bg-[var(--green-soft)] border-[var(--green)] text-[var(--green)]',
        blue: 'bg-[var(--blue-soft)] border-[var(--blue)] text-[var(--blue)]',
        danger:
          'bg-[var(--red)]/10 border-[var(--red)] text-[var(--red)] hover:bg-[var(--red)]/20',
        gold: 'bg-[var(--gold-tint)] border-[var(--gold-dark)] text-[var(--gold)] hover:bg-[var(--gold-tint-hover)]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface ChunkyChipProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof chunkyChipVariants> {
  asChild?: boolean;
  pressed?: boolean;
}

const ChunkyChip = React.forwardRef<HTMLButtonElement, ChunkyChipProps>(
  ({ className, variant, asChild = false, pressed, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(chunkyChipVariants({ variant, className }))}
        aria-pressed={pressed}
        ref={ref}
        {...props}
      />
    );
  }
);
ChunkyChip.displayName = 'ChunkyChip';

// eslint-disable-next-line react-refresh/only-export-components
export { ChunkyChip, chunkyChipVariants };
