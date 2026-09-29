import * as React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

const ChunkySelect = SelectPrimitive.Root;
const ChunkySelectGroup = SelectPrimitive.Group;
const ChunkySelectValue = SelectPrimitive.Value;

const ChunkySelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    data-testid="chunky-select-trigger"
    className={cn(
      'flex h-11 w-full items-center justify-between gap-2 rounded-2xl border-2 border-b-4 border-[var(--border)] bg-[var(--surface)] px-4 py-2 font-sans text-sm font-bold text-[var(--ink)] shadow-none transition-all placeholder:text-[var(--muted)] hover:border-[var(--border-strong)] focus-visible:outline-none focus-visible:border-[var(--blue)] focus-visible:ring-2 focus-visible:ring-[var(--blue)]/40 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 data-[placeholder]:font-semibold data-[placeholder]:text-[var(--muted)] [&>span]:line-clamp-1',
      className
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 shrink-0 opacity-60" aria-hidden="true" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
ChunkySelectTrigger.displayName = 'ChunkySelectTrigger';

const ChunkySelectScrollUpButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollUpButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollUpButton
    ref={ref}
    className={cn(
      'flex cursor-default items-center justify-center py-1 text-[var(--muted)]',
      className
    )}
    {...props}
  >
    <ChevronUp className="h-4 w-4" aria-hidden="true" />
  </SelectPrimitive.ScrollUpButton>
));
ChunkySelectScrollUpButton.displayName =
  SelectPrimitive.ScrollUpButton.displayName;

const ChunkySelectScrollDownButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollDownButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollDownButton
    ref={ref}
    className={cn(
      'flex cursor-default items-center justify-center py-1 text-[var(--muted)]',
      className
    )}
    {...props}
  >
    <ChevronDown className="h-4 w-4" aria-hidden="true" />
  </SelectPrimitive.ScrollDownButton>
));
ChunkySelectScrollDownButton.displayName =
  SelectPrimitive.ScrollDownButton.displayName;

const ChunkySelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = 'popper', ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      className={cn(
        'relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-2xl border-2 border-[var(--border)] bg-[var(--surface)] p-1.5 font-sans text-sm font-bold text-[var(--ink)] shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
        position === 'popper' &&
          'data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1',
        className
      )}
      position={position}
      {...props}
    >
      <ChunkySelectScrollUpButton />
      <SelectPrimitive.Viewport
        className={cn(
          'p-1',
          position === 'popper' &&
            'h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]'
        )}
      >
        {children}
      </SelectPrimitive.Viewport>
      <ChunkySelectScrollDownButton />
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
ChunkySelectContent.displayName = 'ChunkySelectContent';

const ChunkySelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn(
      'py-1.5 pl-8 pr-2 font-sans text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]',
      className
    )}
    {...props}
  />
));
ChunkySelectLabel.displayName = 'ChunkySelectLabel';

const ChunkySelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex w-full cursor-pointer select-none items-center rounded-xl py-2.5 pl-8 pr-2 font-sans text-sm font-bold outline-none transition-colors focus:bg-[var(--surface-raised)] focus:text-[var(--ink)] data-[highlighted]:bg-[var(--surface-raised)] data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      className
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-4 w-4 text-[var(--green)]" aria-hidden="true" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
));
ChunkySelectItem.displayName = 'ChunkySelectItem';

const ChunkySelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn('-mx-1 my-1 h-px bg-[var(--border)]', className)}
    {...props}
  />
));
ChunkySelectSeparator.displayName = 'ChunkySelectSeparator';

export {
  ChunkySelect,
  ChunkySelectGroup,
  ChunkySelectValue,
  ChunkySelectTrigger,
  ChunkySelectContent,
  ChunkySelectLabel,
  ChunkySelectItem,
  ChunkySelectSeparator,
  ChunkySelectScrollUpButton,
  ChunkySelectScrollDownButton,
};
