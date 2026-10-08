import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Selected Episodes</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete {selectedEpisodeCount}{' '}
            {selectedEpisodeCount === 1 ? 'episode' : 'episodes'}? This action cannot be undone and will delete all associated video sources.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirmDelete}
            disabled={isPending || selectedEpisodeCount === 0}
          >
            {isPending ? 'Deleting...' : `Delete ${selectedEpisodeCount} ${selectedEpisodeCount === 1 ? 'Episode' : 'Episodes'}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
