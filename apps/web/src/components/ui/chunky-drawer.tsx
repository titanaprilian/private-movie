import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

const ChunkyDrawer = DialogPrimitive.Root;

const ChunkyDrawerTrigger = DialogPrimitive.Trigger;

const ChunkyDrawerClose = DialogPrimitive.Close;

const ChunkyDrawerOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    data-testid="chunky-drawer-overlay"
    className={cn(
      'fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className
    )}
    {...props}
  />
));
ChunkyDrawerOverlay.displayName = 'ChunkyDrawerOverlay';

const ChunkyDrawerContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <ChunkyDrawerOverlay />
    <DialogPrimitive.Content
      ref={ref}
      data-testid="chunky-drawer-content"
      className={cn(
        'fixed inset-y-0 right-0 z-50 flex h-full w-full max-w-md flex-col gap-0 rounded-l-[20px] border-l-2 border-y-2 border-[var(--border)] bg-[var(--surface)] shadow-2xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right',
        className
      )}
      {...props}
    >
      {children}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
ChunkyDrawerContent.displayName = 'ChunkyDrawerContent';

interface ChunkyDrawerHeaderProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /** Hides the built-in close button (e.g. for forced-choice drawers). */
  hideClose?: boolean;
}

function ChunkyDrawerHeader({
  hideClose = false,
  className,
  children,
  ...props
}: ChunkyDrawerHeaderProps) {
  return (
    <div
      data-testid="chunky-drawer-header"
      className={cn(
        'flex items-start justify-between gap-3 border-b-2 border-[var(--border)] px-5 py-4',
        className
      )}
      {...props}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">{children}</div>
      {!hideClose && (
        <DialogPrimitive.Close
          aria-label="Close"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-[var(--border)] bg-[var(--bg)] text-[var(--ink)] shadow-[0_4px_0_rgba(0,0,0,0.15)] transition-all hover:bg-[var(--yellow)] hover:border-[var(--yellow-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)] focus-visible:ring-offset-1 active:translate-y-[3px] active:shadow-[0_1px_0_rgba(0,0,0,0.15)] [&_svg]:size-5"
        >
          <X aria-hidden="true" />
        </DialogPrimitive.Close>
      )}
    </div>
  );
}

const ChunkyDrawerTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      'font-display text-xl font-bold text-[var(--ink)]',
      className
    )}
    {...props}
  />
));
ChunkyDrawerTitle.displayName = 'ChunkyDrawerTitle';

const ChunkyDrawerDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('font-sans text-sm font-semibold text-[var(--muted)]', className)}
    {...props}
  />
));
ChunkyDrawerDescription.displayName = 'ChunkyDrawerDescription';

function ChunkyDrawerBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-testid="chunky-drawer-body"
      className={cn('flex-1 overflow-y-auto px-5 py-4', className)}
      {...props}
    />
  );
}

function ChunkyDrawerFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-testid="chunky-drawer-footer"
      className={cn(
        'flex flex-col gap-3 border-t-2 border-[var(--border)] bg-[var(--surface)] px-5 py-4 sm:flex-row sm:items-center sm:justify-end',
        className
      )}
      {...props}
    />
  );
}

export {
  ChunkyDrawer,
  ChunkyDrawerTrigger,
  ChunkyDrawerClose,
  ChunkyDrawerOverlay,
  ChunkyDrawerContent,
  ChunkyDrawerHeader,
  ChunkyDrawerTitle,
  ChunkyDrawerDescription,
  ChunkyDrawerBody,
  ChunkyDrawerFooter,
};
