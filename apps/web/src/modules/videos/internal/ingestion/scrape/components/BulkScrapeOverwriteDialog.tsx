import {
  ChunkyDialog,
  ChunkyDialogContent,
  ChunkyDialogHeader,
  ChunkyDialogTitle,
  ChunkyDialogDescription,
  ChunkyDialogFooter,
} from '@/components/ui/chunky-dialog';
import { ChunkyButton } from '@/components/ui/chunky-button';

export interface BulkScrapeOverwriteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function BulkScrapeOverwriteDialog({
  open,
  onOpenChange,
  onConfirm,
}: BulkScrapeOverwriteDialogProps) {
  return (
    <ChunkyDialog open={open} onOpenChange={onOpenChange}>
      <ChunkyDialogContent className="sm:max-w-md">
        <ChunkyDialogHeader>
          <ChunkyDialogTitle>Overwrite Existing Sources?</ChunkyDialogTitle>
          <ChunkyDialogDescription>
            One or more mapped local episodes already contain video sources. Proceeding will
            overwrite their existing video sources. Please double-check your target mappings
            before confirming.
          </ChunkyDialogDescription>
        </ChunkyDialogHeader>
        <ChunkyDialogFooter>
          <ChunkyButton type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </ChunkyButton>
          <ChunkyButton type="button" variant="danger" onClick={onConfirm}>
            Confirm & Save
          </ChunkyButton>
        </ChunkyDialogFooter>
      </ChunkyDialogContent>
    </ChunkyDialog>
  );
}
