import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const chunkyButtonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-extrabold uppercase tracking-[0.8px] text-[13px] rounded-2xl border-2 border-b-4 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)] focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 cursor-pointer active:translate-y-[2px] active:border-b-2 [&_svg]:pointer-events-none [&_svg]:size-5 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary:
          'bg-[var(--green)] border-[var(--green-dark)] text-white hover:brightness-105',
        green:
          'bg-[var(--green)] border-[var(--green-dark)] text-white hover:brightness-105',
        blue: 'bg-[var(--blue)] border-[var(--blue-dark)] text-white hover:brightness-105',
        danger:
          'bg-[var(--red)] border-[var(--red-dark)] text-white hover:brightness-105',
        translucent:
          'bg-white/20 border-white/10 border-b-[rgba(0,0,0,0.35)] text-white backdrop-blur-sm hover:bg-white/30',
        outline:
          'bg-[var(--bg)] border-[var(--border)] text-[var(--ink)] hover:bg-[var(--surface)]',
        gold: 'bg-[var(--gold)] border-[var(--gold-dark)] text-[#201a00] hover:brightness-105',
      },
      size: {
        default: 'h-11 px-5',
        sm: 'h-9 px-4 rounded-xl',
        lg: 'h-14 px-8 text-base',
        icon: 'w-11 h-11 rounded-full p-0 [&_svg]:size-5',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  }
);

export interface ChunkyButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof chunkyButtonVariants> {
  asChild?: boolean;
}

const ChunkyButton = React.forwardRef<HTMLButtonElement, ChunkyButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(chunkyButtonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
ChunkyButton.displayName = 'ChunkyButton';

// eslint-disable-next-line react-refresh/only-export-components
export { ChunkyButton, chunkyButtonVariants };
