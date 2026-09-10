import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface StorageLimitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentLimitGb: number;
  onSave: (limitGb: number) => Promise<void>;
}

export function StorageLimitDialog({
  open,
  onOpenChange,
  currentLimitGb,
  onSave,
}: StorageLimitDialogProps) {
  const [limitGbInput, setLimitGbInput] = useState<string>(String(currentLimitGb));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setLimitGbInput(String(currentLimitGb || 50));
      setError(null);
    }
  }, [open, currentLimitGb]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(limitGbInput);
    if (isNaN(parsed) || parsed <= 0) {
      setError('Please enter a valid capacity limit greater than 0 GB');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onSave(parsed);
      onOpenChange(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update storage limit';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[95vw] bg-card border-c rounded sm:rounded p-5">
        <DialogHeader className="pb-2 border-b border-c">
          <DialogTitle className="text-base font-semibold text-fg">
            Configure Storage Capacity Limit
          </DialogTitle>
          <p className="text-xs text-muted">
            Set maximum S3 storage threshold in gigabytes (GB) for visual capacity meters.
          </p>
        </DialogHeader>

        <form noValidate onSubmit={handleSubmit} className="space-y-4 pt-3">
          <div className="space-y-1.5">
            <Label htmlFor="storage-limit-input" className="text-xs mono uppercase tracking-wide">
              Capacity Limit (GB)
            </Label>
            <Input
              id="storage-limit-input"
              type="number"
              min="1"
              step="1"
              value={limitGbInput}
              onChange={(e) => setLimitGbInput(e.target.value)}
              placeholder="e.g. 50"
              className="mono text-sm"
              autoFocus
            />
            {error && (
              <p className="text-xs text-red-600 dark:text-red-400 font-medium" data-testid="limit-error-msg">
                {error}
              </p>
            )}
          </div>

          <DialogFooter className="pt-2 gap-2 flex justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting} data-testid="save-limit-btn">
              {isSubmitting ? 'Saving...' : 'Save Storage Limit'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
