import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

const ChunkyDialog = DialogPrimitive.Root;

const ChunkyDialogTrigger = DialogPrimitive.Trigger;

const ChunkyDialogClose = DialogPrimitive.Close;

const ChunkyDialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    data-testid="chunky-dialog-overlay"
    className={cn(
      'fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className
    )}
    {...props}
  />
));
ChunkyDialogOverlay.displayName = 'ChunkyDialogOverlay';

const ChunkyDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <ChunkyDialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      data-testid="chunky-dialog-content"
      className={cn(
        'fixed left-[50%] top-[50%] z-50 flex max-h-[85vh] w-[calc(100%-2rem)] max-w-lg translate-x-[-50%] translate-y-[-50%] flex-col gap-0 overflow-hidden rounded-[24px] border-2 border-b-4 border-[var(--border)] bg-[var(--surface)] shadow-2xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]',
        className
      )}
      {...props}
    >
      {children}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
ChunkyDialogContent.displayName = 'ChunkyDialogContent';

interface ChunkyDialogHeaderProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /** Hides the built-in close button (e.g. for forced-choice dialogs). */
  hideClose?: boolean;
}

function ChunkyDialogHeader({
  hideClose = false,
  className,
  children,
  ...props
}: ChunkyDialogHeaderProps) {
  return (
    <div
      data-testid="chunky-dialog-header"
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
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-[var(--border)] bg-[var(--bg)] text-[var(--ink)] shadow-[0_4px_0_rgba(0,0,0,0.15)] transition-all hover:border-[var(--yellow-dark)] hover:bg-[var(--yellow)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)] focus-visible:ring-offset-1 active:translate-y-[3px] active:shadow-[0_1px_0_rgba(0,0,0,0.15)] [&_svg]:size-5"
        >
          <X aria-hidden="true" />
        </DialogPrimitive.Close>
      )}
    </div>
  );
}

const ChunkyDialogTitle = React.forwardRef<
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
ChunkyDialogTitle.displayName = 'ChunkyDialogTitle';

const ChunkyDialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn(
      'font-sans text-sm font-semibold text-[var(--muted)]',
      className
    )}
    {...props}
  />
));
ChunkyDialogDescription.displayName = 'ChunkyDialogDescription';

function ChunkyDialogBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-testid="chunky-dialog-body"
      className={cn('flex-1 overflow-y-auto px-5 py-4', className)}
      {...props}
    />
  );
}

function ChunkyDialogFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-testid="chunky-dialog-footer"
      className={cn(
        'flex flex-col gap-3 border-t-2 border-[var(--border)] bg-[var(--surface)] px-5 py-4 sm:flex-row sm:items-center sm:justify-end',
        className
      )}
      {...props}
    />
  );
}

export {
  ChunkyDialog,
  ChunkyDialogTrigger,
  ChunkyDialogClose,
  ChunkyDialogOverlay,
  ChunkyDialogContent,
  ChunkyDialogHeader,
  ChunkyDialogTitle,
  ChunkyDialogDescription,
  ChunkyDialogBody,
  ChunkyDialogFooter,
};
