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
import type { VideoSourceMetadata } from './api';

export interface EditSourceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  videoSource: (VideoSourceMetadata & { key?: string }) | null;
  onSave: (sourceId: string, input: { label: string; quality: string }) => Promise<void>;
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
      const msg = err instanceof Error ? err.message : 'Failed to update video source';
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
            Edit Video Source Metadata
          </DialogTitle>
          {videoSource.key && (
            <p className="text-xs mono text-muted truncate mt-0.5" title={videoSource.key}>
              Key: {videoSource.key}
            </p>
          )}
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-3">
          <div className="space-y-1.5">
            <Label htmlFor="edit-source-label" className="text-xs font-medium">
              Source Label
            </Label>
            <Input
              id="edit-source-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. S3 Primary 1080p"
              className="text-sm"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-source-quality" className="text-xs font-medium">
              Quality Rating
            </Label>
            <Input
              id="edit-source-quality"
              value={quality}
              onChange={(e) => setQuality(e.target.value)}
              placeholder="e.g. 1080p, 4K, 720p"
              className="text-sm"
            />
          </div>

          {error && (
            <p className="text-xs text-red-600 dark:text-red-400 font-medium" data-testid="edit-source-error">
              {error}
            </p>
          )}

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
            <Button type="submit" size="sm" disabled={isSubmitting} data-testid="save-source-btn">
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
