import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const chunkySpinnerSizes = {
  xs: 'h-3 w-3',
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-8 w-8',
} as const;

export type ChunkySpinnerSize = keyof typeof chunkySpinnerSizes;

export interface ChunkySpinnerProps extends React.HTMLAttributes<SVGSVGElement> {
  size?: ChunkySpinnerSize;
}

/**
 * Standardized loading spinner wrapping Lucide's Loader2.
 * Always spins and is hidden from assistive tech (pair it with
 * adjacent loading text or an aria-live region instead).
 */
export function ChunkySpinner({ size = 'md', className, ...props }: ChunkySpinnerProps) {
  return (
    <Loader2
      aria-hidden="true"
      className={cn('animate-spin shrink-0', chunkySpinnerSizes[size], className)}
      {...props}
    />
  );
}
