import { ChunkyConfirmDialog } from '@/components/ui/chunky-confirm-dialog';

export interface BatchDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedEpisodeCount: number;
  onConfirmDelete: () => void;
  isPending?: boolean;
}

export function BatchDeleteDialog({
  open,
  onOpenChange,
  selectedEpisodeCount,
  onConfirmDelete,
  isPending = false,
}: BatchDeleteDialogProps) {
  return (
    <ChunkyConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Delete Selected Episodes"
      description={`Are you sure you want to delete ${selectedEpisodeCount} ${selectedEpisodeCount === 1 ? 'episode' : 'episodes'}? This action cannot be undone and will delete all associated video sources.`}
      confirmLabel={
        isPending
          ? 'Deleting...'
          : `Delete ${selectedEpisodeCount} ${selectedEpisodeCount === 1 ? 'Episode' : 'Episodes'}`
      }
      cancelLabel="Cancel"
      confirmVariant="danger"
      isPending={isPending}
      onConfirm={onConfirmDelete}
      confirmButtonTestId="confirm-batch-delete"
    />
  );
}
