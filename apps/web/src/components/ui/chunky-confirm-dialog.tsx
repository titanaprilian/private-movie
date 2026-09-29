import * as React from 'react';
import { Loader2, TriangleAlert } from 'lucide-react';
import {
  ChunkyDialog,
  ChunkyDialogContent,
  ChunkyDialogDescription,
  ChunkyDialogFooter,
  ChunkyDialogHeader,
  ChunkyDialogTitle,
} from '@/components/ui/chunky-dialog';
import { ChunkyButton } from '@/components/ui/chunky-button';

export type ChunkyConfirmVariant = 'danger' | 'primary' | 'blue' | 'gold';

export interface ChunkyConfirmDialogProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: ChunkyConfirmVariant;
  isPending?: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
  /** Optional test id for the confirm button. */
  confirmButtonTestId?: string;
  /** Optional test id for the cancel button. */
  cancelButtonTestId?: string;
}

export function ChunkyConfirmDialog({
  open,
  defaultOpen,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  confirmVariant = 'danger',
  isPending = false,
  onConfirm,
  onCancel,
  confirmButtonTestId,
  cancelButtonTestId,
}: ChunkyConfirmDialogProps) {
  const handleCancel = () => {
    if (isPending) return;
    onCancel?.();
    onOpenChange?.(false);
  };

  const handleConfirm = () => {
    if (isPending) return;
    onConfirm?.();
  };

  return (
    <ChunkyDialog
      open={open}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange}
    >
      <ChunkyDialogContent data-testid="chunky-confirm-dialog">
        <ChunkyDialogHeader>
          <div className="flex items-start gap-3">
            {confirmVariant === 'danger' && (
              <span
                data-testid="chunky-confirm-badge"
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border-2 border-[var(--red-dark)] bg-[var(--red)] text-white shadow-[0_4px_0_var(--red-dark)] [&_svg]:size-5"
              >
                <TriangleAlert aria-hidden="true" />
              </span>
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <ChunkyDialogTitle>{title}</ChunkyDialogTitle>
              {typeof description === 'string' ? (
                <ChunkyDialogDescription>{description}</ChunkyDialogDescription>
              ) : (
                description != null && (
                  <div className="font-sans text-sm font-semibold text-[var(--muted)]">
                    {description}
                  </div>
                )
              )}
            </div>
          </div>
        </ChunkyDialogHeader>
        <ChunkyDialogFooter>
          <ChunkyButton
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={isPending}
            data-testid={cancelButtonTestId}
          >
            {cancelLabel}
          </ChunkyButton>
          <ChunkyButton
            type="button"
            variant={confirmVariant}
            onClick={handleConfirm}
            disabled={isPending}
            aria-busy={isPending || undefined}
            data-testid={confirmButtonTestId}
          >
            {isPending && (
              <Loader2
                aria-hidden="true"
                data-testid="chunky-confirm-spinner"
                className="animate-spin"
              />
            )}
            {confirmLabel}
          </ChunkyButton>
        </ChunkyDialogFooter>
      </ChunkyDialogContent>
    </ChunkyDialog>
  );
}
