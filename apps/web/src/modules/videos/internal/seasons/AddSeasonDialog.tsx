import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { createSeason, type SeasonDetails } from '../api';
import { getNextSeasonNumber, detectProviderFromUrl } from './seasonUtils';
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

export interface AddSeasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seriesId: string;
  seasons: SeasonDetails[];
}

export function AddSeasonDialog({
  open,
  onOpenChange,
  seriesId,
  seasons,
}: AddSeasonDialogProps) {
  const queryClient = useQueryClient();
  const nextSeasonNumber = getNextSeasonNumber(seasons);

  const [seasonNumber, setSeasonNumber] = useState(nextSeasonNumber);
  const [title, setTitle] = useState(`Season ${nextSeasonNumber}`);
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'completed' | 'ongoing' | 'pending'>('completed');
  const [scraperUrl, setScraperUrl] = useState('');
  const [source, setSource] = useState<string>('none');
  const [episodeOffset, setEpisodeOffset] = useState<number>(0);
  const [titleTouched, setTitleTouched] = useState(false);

  useEffect(() => {
    if (open) {
      const next = getNextSeasonNumber(seasons);
      setSeasonNumber(next);
      setTitle(`Season ${next}`);
      setTitleTouched(false);
      setDescription('');
      setStatus('completed');
      setScraperUrl('');
      setSource('none');
      setEpisodeOffset(0);
    }
  }, [open, seasons]);

  const handleSeasonNumberChange = (value: number) => {
    setSeasonNumber(value);
    if (!titleTouched && Number.isFinite(value)) {
      setTitle(`Season ${value}`);
    }
  };

  const handleScraperUrlChange = (value: string) => {
    setScraperUrl(value);
    const detected = detectProviderFromUrl(value);
    if (detected) {
      setSource(detected);
    }
  };

  const createMutation = useMutation({
    mutationFn: () =>
      createSeason(seriesId, {
        title: title.trim(),
        seasonNumber,
        description: description.trim() || null,
        status,
        scraperUrl: scraperUrl.trim() || null,
        source: source === 'none' ? null : source,
        episodeOffset: Number.isFinite(Number(episodeOffset)) ? Number(episodeOffset) : 0,
      }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['series', seriesId] });
      queryClient.invalidateQueries({ queryKey: ['series'] });
      toast.success('Season created successfully', {
        description: created.title,
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create season');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (!Number.isInteger(seasonNumber) || seasonNumber < 0) return;
    createMutation.mutate();
  };

  const isValid =
    title.trim().length > 0 &&
    Number.isInteger(seasonNumber) &&
    seasonNumber >= 0;

  return (
    <ChunkyDialog open={open} onOpenChange={onOpenChange}>
      <ChunkyDialogContent className="max-w-md">
        <ChunkyDialogHeader>
          <ChunkyDialogTitle>Add Season</ChunkyDialogTitle>
          <ChunkyDialogDescription>
            Create a new season for this series. The season number is suggested
            from the highest existing season.
          </ChunkyDialogDescription>
        </ChunkyDialogHeader>
        <ChunkyDialogBody>
          <form
            id="add-season-form"
            onSubmit={handleSubmit}
            className="space-y-4 py-2"
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label
                  htmlFor="add-season-number"
                  className="text-sm font-extrabold text-[var(--ink)]"
                >
                  Season Number
                </label>
                <ChunkyInput
                  id="add-season-number"
                  type="number"
                  min={0}
                  step={1}
                  value={seasonNumber}
                  onChange={(e) =>
                    handleSeasonNumberChange(parseInt(e.target.value, 10))
                  }
                  placeholder="e.g. 2"
                  required
                  aria-label="Season Number"
                />
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="add-season-status"
                  className="text-sm font-extrabold text-[var(--ink)]"
                >
                  Status
                </label>
                <ChunkySelect
                  value={status}
                  onValueChange={(val) =>
                    setStatus(val as 'completed' | 'ongoing' | 'pending')
                  }
                >
                  <ChunkySelectTrigger id="add-season-status" aria-label="Status">
                    <ChunkySelectValue placeholder="Select status" />
                  </ChunkySelectTrigger>
                  <ChunkySelectContent>
                    <ChunkySelectItem value="completed">Completed</ChunkySelectItem>
                    <ChunkySelectItem value="ongoing">Ongoing</ChunkySelectItem>
                    <ChunkySelectItem value="pending">Pending</ChunkySelectItem>
                  </ChunkySelectContent>
                </ChunkySelect>
              </div>
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="add-season-title"
                className="text-sm font-extrabold text-[var(--ink)]"
              >
                Title
              </label>
              <ChunkyInput
                id="add-season-title"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setTitleTouched(true);
                }}
                placeholder="e.g. Season 2"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="add-season-description"
                className="text-sm font-extrabold text-[var(--ink)]"
              >
                Description
              </label>
              <ChunkyTextarea
                id="add-season-description"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
              />
            </div>

            <div className="pt-2 border-t-2 border-[var(--border)] space-y-3">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">
                Scraper Configuration
              </h4>
              <div className="space-y-1.5">
                <label
                  htmlFor="add-season-scraper-url"
                  className="text-sm font-extrabold text-[var(--ink)]"
                >
                  Scraper URL
                </label>
                <ChunkyInput
                  id="add-season-scraper-url"
                  type="url"
                  value={scraperUrl}
                  onChange={(e) => handleScraperUrlChange(e.target.value)}
                  placeholder="https://otakudesu.cloud/anime/... or https://dramula.com/watch/..."
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label
                    htmlFor="add-season-source"
                    className="text-sm font-extrabold text-[var(--ink)]"
                  >
                    Provider Source
                  </label>
                  <ChunkySelect
                    value={source}
                    onValueChange={(val) => setSource(val)}
                  >
                    <ChunkySelectTrigger
                      id="add-season-source"
                      aria-label="Provider Source"
                    >
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
                    htmlFor="add-season-episode-offset"
                    className="text-sm font-extrabold text-[var(--ink)]"
                  >
                    Episode Offset
                  </label>
                  <ChunkyInput
                    id="add-season-episode-offset"
                    type="number"
                    value={episodeOffset}
                    onChange={(e) =>
                      setEpisodeOffset(parseInt(e.target.value, 10) || 0)
                    }
                    placeholder="0"
                  />
                </div>
              </div>
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
            form="add-season-form"
            disabled={!isValid || createMutation.isPending}
          >
            {createMutation.isPending ? 'Creating...' : 'Create Season'}
          </ChunkyButton>
        </ChunkyDialogFooter>
      </ChunkyDialogContent>
    </ChunkyDialog>
  );
}
