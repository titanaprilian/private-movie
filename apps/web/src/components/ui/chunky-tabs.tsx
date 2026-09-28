import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '@/lib/utils';

const ChunkyTabs = TabsPrimitive.Root;

const ChunkyTabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    role="tablist"
    className={cn('inline-flex items-center gap-2', className)}
    {...props}
  />
));
ChunkyTabsList.displayName = 'ChunkyTabsList';

const ChunkyTabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    role="tab"
    className={cn(
      'inline-flex items-center justify-center gap-2 h-11 px-3.5 rounded-[14px] border-2 border-b-4 font-extrabold text-[13px] uppercase tracking-[0.7px] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)] disabled:pointer-events-none disabled:opacity-50 active:translate-y-[2px] active:border-b-2',
      'bg-[var(--bg)] border-[var(--border)] text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--ink)]',
      'data-[state=active]:bg-[var(--green-soft)] data-[state=active]:border-[var(--green)] data-[state=active]:text-[var(--green)]',
      className
    )}
    {...props}
  />
));
ChunkyTabsTrigger.displayName = 'ChunkyTabsTrigger';

const ChunkyTabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      'mt-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)]',
      className
    )}
    {...props}
  />
));
ChunkyTabsContent.displayName = 'ChunkyTabsContent';

export { ChunkyTabs, ChunkyTabsList, ChunkyTabsTrigger, ChunkyTabsContent };
