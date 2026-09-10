import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import { SeriesCombobox, seriesDetailQueryOptions } from '@/modules/videos';
import type { AttachOrphanInput } from './api';

export interface AttachOrphanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileKey: string | null;
  filename?: string;
  onAttach: (input: AttachOrphanInput) => Promise<void>;
}

export function AttachOrphanDialog({
  open,
  onOpenChange,
  fileKey,
  filename,
  onAttach,
}: AttachOrphanDialogProps) {
  const [selectedSeriesId, setSelectedSeriesId] = useState<string>('');
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<string>('');
  const [label, setLabel] = useState('');
  const [quality, setQuality] = useState('1080p');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch episodes for selected series via seriesDetailQueryOptions
  const { data: seriesDetail, isLoading: isLoadingEpisodes } = useQuery({
    ...seriesDetailQueryOptions(selectedSeriesId),
    enabled: Boolean(selectedSeriesId),
  });

  const episodes = seriesDetail?.episodes ?? [];

  useEffect(() => {
    if (open) {
      setSelectedSeriesId('');
      setSelectedEpisodeId('');
      setLabel(filename || 'S3 Source');
      setQuality('1080p');
      setError(null);
    }
  }, [open, filename]);

  if (!fileKey) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSeriesId) {
      setError('Please select a parent Series');
      return;
    }
    if (!selectedEpisodeId) {
      setError('Please select a target Episode');
      return;
    }
    if (!label.trim()) {
      setError('Label is required');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onAttach({
        key: fileKey,
        episodeId: selectedEpisodeId,
        label: label.trim(),
        quality: quality.trim(),
      });
      onOpenChange(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to attach orphaned file';
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
            Attach Orphaned File to Episode
          </DialogTitle>
          <p className="text-xs mono text-muted truncate mt-0.5" title={fileKey}>
            File: {filename || fileKey}
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-3">
          {/* Series Selection */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">1. Select Series</Label>
            <SeriesCombobox
              value={selectedSeriesId}
              onValueChange={(val) => {
                setSelectedSeriesId(val);
                setSelectedEpisodeId('');
              }}
              aria-label="Select target series"
            />
          </div>

          {/* Episode Selection */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">2. Select Episode</Label>
            {!selectedSeriesId ? (
              <p className="text-xs text-muted italic">Select a series first to view episodes.</p>
            ) : isLoadingEpisodes ? (
              <p className="text-xs text-muted mono">Loading episodes...</p>
            ) : episodes.length === 0 ? (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                No episodes found for this series.
              </p>
            ) : (
              <select
                id="attach-episode-select"
                aria-label="Select target episode"
                value={selectedEpisodeId}
                onChange={(e) => setSelectedEpisodeId(e.target.value)}
                className="w-full h-9 px-3 py-1 rounded border border-c bg-transparent text-xs text-fg focus:outline-none focus:border-primary"
                data-testid="attach-episode-select"
              >
                <option value="" disabled className="bg-card text-muted">
                  -- Choose an episode --
                </option>
                {episodes.map((ep) => (
                  <option key={ep.id} value={ep.id} className="bg-card text-fg">
                    Ep {ep.order ?? '?'}: {ep.title}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Label & Quality */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="attach-label" className="text-xs font-medium">
                Source Label
              </Label>
              <Input
                id="attach-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. S3 Backup"
                className="text-xs h-8"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="attach-quality" className="text-xs font-medium">
                Quality
              </Label>
              <Input
                id="attach-quality"
                value={quality}
                onChange={(e) => setQuality(e.target.value)}
                placeholder="e.g. 1080p"
                className="text-xs h-8"
              />
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-600 dark:text-red-400 font-medium" data-testid="attach-error">
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
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || !selectedSeriesId || !selectedEpisodeId}
              data-testid="submit-attach-btn"
            >
              {isSubmitting ? 'Attaching...' : 'Attach File'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
