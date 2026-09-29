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
import type { VideoSourceMetadata } from './api';

export interface EditSourceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  videoSource: (VideoSourceMetadata & { key?: string }) | null;
  onSave: (
    sourceId: string,
    input: { label: string; quality: string }
  ) => Promise<void>;
}

export function EditSourceModal({
  open,
  onOpenChange,
  videoSource,
  onSave,
}: EditSourceModalProps) {
  const [label, setLabel] = useState('');
  const [quality, setQuality] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && videoSource) {
      setLabel(videoSource.label || '');
      setQuality(videoSource.quality || '1080p');
      setError(null);
    }
  }, [open, videoSource]);

  if (!videoSource) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) {
      setError('Source label is required');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onSave(videoSource.id, {
        label: label.trim(),
        quality: quality.trim(),
      });
      onOpenChange(false);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Failed to update video source';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ChunkyDialog open={open} onOpenChange={onOpenChange}>
      <ChunkyDialogContent aria-label="Edit video source metadata">
        <ChunkyDialogHeader>
          <ChunkyDialogTitle>Edit Video Source Metadata</ChunkyDialogTitle>
          {videoSource.key && (
            <ChunkyDialogDescription
              className="font-mono truncate"
              title={videoSource.key}
            >
              Key: {videoSource.key}
            </ChunkyDialogDescription>
          )}
        </ChunkyDialogHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <ChunkyDialogBody className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="edit-source-label"
                className="font-sans text-[11px] font-extrabold uppercase tracking-wider text-[var(--ink)]"
              >
                Source Label
              </label>
              <ChunkyInput
                id="edit-source-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. S3 Primary 1080p"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="edit-source-quality"
                className="font-sans text-[11px] font-extrabold uppercase tracking-wider text-[var(--ink)]"
              >
                Quality Rating
              </label>
              <ChunkyInput
                id="edit-source-quality"
                value={quality}
                onChange={(e) => setQuality(e.target.value)}
                placeholder="e.g. 1080p, 4K, 720p"
              />
            </div>

            {error && (
              <p
                className="font-sans text-xs font-bold text-[var(--red)]"
                data-testid="edit-source-error"
              >
                {error}
              </p>
            )}
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
              data-testid="save-source-btn"
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </ChunkyButton>
          </ChunkyDialogFooter>
        </form>
      </ChunkyDialogContent>
    </ChunkyDialog>
  );
}
