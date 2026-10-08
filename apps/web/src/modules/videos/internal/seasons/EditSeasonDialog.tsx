import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { updateSeason, type SeasonDetails } from '../api';
import { detectProviderFromUrl } from './seasonUtils';
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
import { ChunkyTextarea } from '@/components/ui/chunky-textarea';
import {
  ChunkySelect,
  ChunkySelectContent,
  ChunkySelectItem,
  ChunkySelectTrigger,
  ChunkySelectValue,
} from '@/components/ui/chunky-select';

export interface EditSeasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  season: SeasonDetails;
}

export function EditSeasonDialog({
  open,
  onOpenChange,
  season,
}: EditSeasonDialogProps) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'completed' | 'ongoing' | 'pending'>('completed');
  const [scraperUrl, setScraperUrl] = useState('');
  const [source, setSource] = useState<string>('none');
  const [episodeOffset, setEpisodeOffset] = useState<number>(0);

  useEffect(() => {
    if (open) {
      setTitle(season.title);
      setDescription(season.description ?? '');
      setStatus(
        season.status === 'ongoing' || season.status === 'pending'
          ? season.status
          : 'completed'
      );
      setScraperUrl(season.scraperUrl ?? '');
      setSource(season.source ?? (season.scraperUrl ? detectProviderFromUrl(season.scraperUrl) ?? 'none' : 'none'));
      setEpisodeOffset(season.episodeOffset ?? 0);
    }
  }, [open, season]);

  const handleScraperUrlChange = (value: string) => {
    setScraperUrl(value);
    const detected = detectProviderFromUrl(value);
    if (detected) {
      setSource(detected);
    }
  };

  const updateMutation = useMutation({
    mutationFn: (params: {
      title: string;
      description: string | null;
      status: 'completed' | 'ongoing' | 'pending';
      scraperUrl: string | null;
      source: string | null;
      episodeOffset: number;
    }) => updateSeason(season.id, params),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['series', season.seriesId] });
      toast.success('Season updated successfully', {
        description: updated.title,
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update season');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    updateMutation.mutate({
      title: title.trim(),
      description: description.trim() || null,
      status,
      scraperUrl: scraperUrl.trim() || null,
      source: source === 'none' ? null : source,
      episodeOffset: Number.isFinite(Number(episodeOffset)) ? Number(episodeOffset) : 0,
    });
  };

  return (
    <ChunkyDialog open={open} onOpenChange={onOpenChange}>
      <ChunkyDialogContent className="max-w-md">
        <ChunkyDialogHeader>
          <ChunkyDialogTitle>Edit Season</ChunkyDialogTitle>
          <ChunkyDialogDescription>
            Update this season&apos;s metadata to correct scraped data or configure ongoing automated scraping.
          </ChunkyDialogDescription>
        </ChunkyDialogHeader>
        <ChunkyDialogBody>
          <form id="edit-season-form" onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label
                htmlFor="edit-season-title"
                className="text-sm font-extrabold text-[var(--ink)]"
              >
                Title
              </label>
              <ChunkyInput
                id="edit-season-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Season 1"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="edit-season-description"
                className="text-sm font-extrabold text-[var(--ink)]"
              >
                Description
              </label>
              <ChunkyTextarea
                id="edit-season-description"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="edit-season-status"
                className="text-sm font-extrabold text-[var(--ink)]"
              >
                Status
              </label>
              <ChunkySelect
                value={status}
                onValueChange={(val) => setStatus(val as 'completed' | 'ongoing' | 'pending')}
              >
                <ChunkySelectTrigger id="edit-season-status" aria-label="Status">
                  <ChunkySelectValue placeholder="Select status" />
                </ChunkySelectTrigger>
                <ChunkySelectContent>
                  <ChunkySelectItem value="completed">Completed</ChunkySelectItem>
                  <ChunkySelectItem value="ongoing">Ongoing</ChunkySelectItem>
                  <ChunkySelectItem value="pending">Pending</ChunkySelectItem>
                </ChunkySelectContent>
              </ChunkySelect>
            </div>

            <div className="pt-2 border-t-2 border-[var(--border)] space-y-3">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">Scraper Configuration</h4>
              <div className="space-y-1.5">
                <label
                  htmlFor="edit-season-scraper-url"
                  className="text-sm font-extrabold text-[var(--ink)]"
                >
                  Scraper URL
                </label>
                <ChunkyInput
                  id="edit-season-scraper-url"
                  type="url"
                  value={scraperUrl}
                  onChange={(e) => handleScraperUrlChange(e.target.value)}
                  placeholder="https://otakudesu.cloud/anime/... or https://dramula.com/watch/..."
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label
                    htmlFor="edit-season-source"
                    className="text-sm font-extrabold text-[var(--ink)]"
                  >
                    Provider Source
                  </label>
                  <ChunkySelect
                    value={source}
                    onValueChange={(val) => setSource(val)}
                  >
                    <ChunkySelectTrigger id="edit-season-source" aria-label="Provider Source">
                      <ChunkySelectValue placeholder="Select provider" />
                    </ChunkySelectTrigger>
                    <ChunkySelectContent>
                      <ChunkySelectItem value="none">None</ChunkySelectItem>
                      <ChunkySelectItem value="otakudesu">Otakudesu</ChunkySelectItem>
                      <ChunkySelectItem value="dramula">Dramula</ChunkySelectItem>
                    </ChunkySelectContent>
                  </ChunkySelect>
                </div>
                <div className="space-y-1.5">
                  <label
                    htmlFor="edit-season-episode-offset"
                    className="text-sm font-extrabold text-[var(--ink)]"
                  >
                    Episode Offset
                  </label>
                  <ChunkyInput
                    id="edit-season-episode-offset"
                    type="number"
                    value={episodeOffset}
                    onChange={(e) => setEpisodeOffset(parseInt(e.target.value, 10) || 0)}
                    placeholder="0"
                  />
                </div>
              </div>

              {(season.lastScrapedAt || season.lastScrapeError) && (
                <div className="rounded-2xl border-2 border-[var(--border)] bg-[var(--bg)] p-2.5 space-y-1 text-xs">
                  {season.lastScrapedAt && (
                    <div className="text-[var(--muted)]">
                      <span className="font-extrabold text-[var(--ink)]">Last Scraped:</span>{' '}
                      {new Date(season.lastScrapedAt).toLocaleString()}
                    </div>
                  )}
                  {season.lastScrapeError && (
                    <div className="text-[var(--red)] font-mono text-[11px] break-words">
                      <span className="font-semibold">Last Error:</span> {season.lastScrapeError}
                    </div>
                  )}
                </div>
              )}
            </div>
          </form>
        </ChunkyDialogBody>
        <ChunkyDialogFooter>
          <ChunkyButton
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </ChunkyButton>
          <ChunkyButton
            type="submit"
            form="edit-season-form"
            disabled={!title.trim() || updateMutation.isPending}
          >
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </ChunkyButton>
        </ChunkyDialogFooter>
      </ChunkyDialogContent>
    </ChunkyDialog>
  );
}
