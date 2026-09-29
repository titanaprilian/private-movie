import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import {
  ChunkySelect,
  ChunkySelectContent,
  ChunkySelectItem,
  ChunkySelectTrigger,
  ChunkySelectValue,
} from '@/components/ui/chunky-select';
import { SeriesCombobox } from '@/components/media/SeriesCombobox';
import { api } from '@/lib/api';
import type { AttachOrphanInput } from './api';

export interface AttachOrphanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileKey: string | null;
  filename?: string;
  onAttach: (input: AttachOrphanInput) => Promise<void>;
}

const QUALITY_PRESETS = ['480p', '720p', '1080p', '1440p', '4K', '8K'];

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

  // Quality options always include the current value
  const qualityOptions = useMemo(
    () => Array.from(new Set([quality, ...QUALITY_PRESETS].filter(Boolean))),
    [quality]
  );

  // Fetch episodes for selected series via api.series[id]
  const { data: seriesDetail, isLoading: isLoadingEpisodes } = useQuery({
    queryKey: ['series', 'detail', selectedSeriesId],
    queryFn: async () => {
      const res = await api.series[selectedSeriesId].get();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = (res.data as any)?.data;
      return raw as
        | { episodes: Array<{ id: string; title: string; order: number }> }
        | undefined;
    },
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
      const msg =
        err instanceof Error ? err.message : 'Failed to attach orphaned file';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ChunkyDialog open={open} onOpenChange={onOpenChange}>
      <ChunkyDialogContent aria-label="Attach orphaned file to episode">
        <ChunkyDialogHeader>
          <ChunkyDialogTitle>Attach Orphaned File to Episode</ChunkyDialogTitle>
          <ChunkyDialogDescription
            className="font-mono truncate"
            title={fileKey}
          >
            File: {filename || fileKey}
          </ChunkyDialogDescription>
        </ChunkyDialogHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <ChunkyDialogBody className="space-y-4">
            {/* Series Selection */}
            <div className="space-y-1.5">
              <span className="font-sans text-[11px] font-extrabold uppercase tracking-wider text-[var(--ink)]">
                1. Select Series
              </span>
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
              <span className="font-sans text-[11px] font-extrabold uppercase tracking-wider text-[var(--ink)]">
                2. Select Episode
              </span>
              {!selectedSeriesId ? (
                <p className="font-sans text-xs font-semibold text-[var(--muted)] italic">
                  Select a series first to view episodes.
                </p>
              ) : isLoadingEpisodes ? (
                <p className="font-mono text-xs font-semibold text-[var(--muted)]">
                  Loading episodes...
                </p>
              ) : episodes.length === 0 ? (
                <p className="font-sans text-xs font-bold text-[var(--gold-dark)]">
                  No episodes found for this series.
                </p>
              ) : (
                <ChunkySelect
                  value={selectedEpisodeId}
                  onValueChange={(val) => setSelectedEpisodeId(val)}
                >
                  <ChunkySelectTrigger
                    id="attach-episode-select"
                    aria-label="Select target episode"
                    data-testid="attach-episode-select"
                  >
                    <ChunkySelectValue placeholder="-- Choose an episode --" />
                  </ChunkySelectTrigger>
                  <ChunkySelectContent>
                    {episodes.map((ep) => (
                      <ChunkySelectItem key={ep.id} value={ep.id}>
                        Ep {ep.order ?? '?'}: {ep.title}
                      </ChunkySelectItem>
                    ))}
                  </ChunkySelectContent>
                </ChunkySelect>
              )}
            </div>

            {/* Label & Quality */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label
                  htmlFor="attach-label"
                  className="font-sans text-[11px] font-extrabold uppercase tracking-wider text-[var(--ink)]"
                >
                  Source Label
                </label>
                <ChunkyInput
                  id="attach-label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. S3 Backup"
                />
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="attach-quality"
                  className="font-sans text-[11px] font-extrabold uppercase tracking-wider text-[var(--ink)]"
                >
                  Quality
                </label>
                <ChunkySelect value={quality} onValueChange={setQuality}>
                  <ChunkySelectTrigger
                    id="attach-quality"
                    aria-label="Select source quality"
                    data-testid="attach-quality-select"
                    className="font-mono"
                  >
                    <ChunkySelectValue placeholder="e.g. 1080p" />
                  </ChunkySelectTrigger>
                  <ChunkySelectContent>
                    {qualityOptions.map((q) => (
                      <ChunkySelectItem key={q} value={q} className="font-mono">
                        {q}
                      </ChunkySelectItem>
                    ))}
                  </ChunkySelectContent>
                </ChunkySelect>
              </div>
            </div>

            {error && (
              <p
                className="font-sans text-xs font-bold text-[var(--red)]"
                data-testid="attach-error"
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
              disabled={isSubmitting || !selectedSeriesId || !selectedEpisodeId}
              data-testid="submit-attach-btn"
            >
              {isSubmitting ? 'Attaching...' : 'Attach File'}
            </ChunkyButton>
          </ChunkyDialogFooter>
        </form>
      </ChunkyDialogContent>
    </ChunkyDialog>
  );
}
