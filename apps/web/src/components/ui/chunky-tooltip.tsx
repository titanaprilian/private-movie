import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cn } from '@/lib/utils';

const ChunkyTooltipProvider = TooltipPrimitive.Provider;

const ChunkyTooltipRoot = TooltipPrimitive.Root;

const ChunkyTooltipTrigger = TooltipPrimitive.Trigger;

const ChunkyTooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(
  (
    { className, side = 'top', align = 'center', sideOffset = 4, ...props },
    ref
  ) => (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        ref={ref}
        side={side}
        align={align}
        sideOffset={sideOffset}
        data-testid="chunky-tooltip-content"
        className={cn(
          'z-50 max-w-xs overflow-hidden bg-[var(--surface-raised)] border-2 border-[var(--border)] text-[var(--ink)] font-sans font-bold text-xs rounded-xl shadow-lg px-2.5 py-1.5 outline-none data-[state=delayed-open]:animate-in data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
          className
        )}
        {...props}
      />
    </TooltipPrimitive.Portal>
  )
);
ChunkyTooltipContent.displayName = TooltipPrimitive.Content.displayName;

export interface ChunkyTooltipProps
  extends Omit<
    React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Root>,
    'children'
  > {
  /** Tooltip body text or node. */
  content: React.ReactNode;
  /** Trigger element — rendered as-child so hover/focus handlers attach to it. */
  children: React.ReactElement;
  /** Extra classes for the floating content panel. */
  contentClassName?: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  sideOffset?: number;
}

/**
 * Convenient shorthand: wraps `children` in a hover/focus tooltip showing
 * `content`. For full control, compose Provider + Root + Trigger + Content.
 */
function ChunkyTooltip({
  content,
  children,
  contentClassName,
  side = 'top',
  align = 'center',
  sideOffset = 4,
  delayDuration = 200,
  ...rootProps
}: ChunkyTooltipProps) {
  return (
    <ChunkyTooltipProvider delayDuration={delayDuration}>
      <ChunkyTooltipRoot delayDuration={delayDuration} {...rootProps}>
        <ChunkyTooltipTrigger asChild>{children}</ChunkyTooltipTrigger>
        <ChunkyTooltipContent
          side={side}
          align={align}
          sideOffset={sideOffset}
          className={contentClassName}
        >
          {content}
        </ChunkyTooltipContent>
      </ChunkyTooltipRoot>
    </ChunkyTooltipProvider>
  );
}

export {
  ChunkyTooltip,
  ChunkyTooltipProvider,
  ChunkyTooltipRoot,
  ChunkyTooltipTrigger,
  ChunkyTooltipContent,
};
