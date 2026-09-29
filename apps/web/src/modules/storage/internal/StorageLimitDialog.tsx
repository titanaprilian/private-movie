import { useState, useEffect } from 'react';
import {
  ChunkyDialog,
  ChunkyDialogContent,
  ChunkyDialogHeader,
  ChunkyDialogTitle,
  ChunkyDialogDescription,
  ChunkyDialogBody,
  ChunkyDialogFooter,
} from '@/components/ui/chunky-dialog';
import { ChunkyButton } from '@/components/ui/chunky-button';
import { ChunkyInput } from '@/components/ui/chunky-input';

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
  const [limitGbInput, setLimitGbInput] = useState<string>(
    String(currentLimitGb)
  );
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
      const msg =
        err instanceof Error ? err.message : 'Failed to update storage limit';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ChunkyDialog open={open} onOpenChange={onOpenChange}>
      <ChunkyDialogContent aria-label="Configure storage capacity limit">
        <ChunkyDialogHeader>
          <ChunkyDialogTitle>
            Configure Storage Capacity Limit
          </ChunkyDialogTitle>
          <ChunkyDialogDescription>
            Set maximum S3 storage threshold in gigabytes (GB) for visual
            capacity meters.
          </ChunkyDialogDescription>
        </ChunkyDialogHeader>

        <form
          noValidate
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col"
        >
          <ChunkyDialogBody>
            <div className="space-y-1.5">
              <label
                htmlFor="storage-limit-input"
                className="font-sans text-[11px] font-extrabold uppercase tracking-wider text-[var(--ink)]"
              >
                Capacity Limit (GB)
              </label>
              <ChunkyInput
                id="storage-limit-input"
                type="number"
                min={1}
                step={1}
                value={limitGbInput}
                onChange={(e) => setLimitGbInput(e.target.value)}
                placeholder="e.g. 50"
                className="font-mono"
                autoFocus
              />
              {error && (
                <p
                  className="font-sans text-xs font-bold text-[var(--red)]"
                  data-testid="limit-error-msg"
                >
                  {error}
                </p>
              )}
            </div>
          </ChunkyDialogBody>

          <ChunkyDialogFooter>
            <ChunkyButton
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </ChunkyButton>
            <ChunkyButton
              type="submit"
              size="sm"
              disabled={isSubmitting}
              data-testid="save-limit-btn"
            >
              {isSubmitting ? 'Saving...' : 'Save Storage Limit'}
            </ChunkyButton>
          </ChunkyDialogFooter>
        </form>
      </ChunkyDialogContent>
    </ChunkyDialog>
  );
}
