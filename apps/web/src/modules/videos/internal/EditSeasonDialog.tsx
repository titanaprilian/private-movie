import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { updateSeason, type SeasonDetails } from './api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface EditSeasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  season: SeasonDetails;
}

function detectProviderFromUrl(url: string): 'otakudesu' | 'dramula' | null {
  if (!url) return null;
  const lower = url.toLowerCase();
  if (lower.includes('otakudesu')) return 'otakudesu';
  if (lower.includes('dramula')) return 'dramula';
  return null;
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Season</DialogTitle>
          <DialogDescription>
            Update this season&apos;s metadata to correct scraped data or configure ongoing automated scraping.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="edit-season-title">Title</Label>
            <Input
              id="edit-season-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Season 1"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-season-description">Description</Label>
            <textarea
              id="edit-season-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              className="flex w-full rounded border border-c bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-season-status">Status</Label>
            <Select
              value={status}
              onValueChange={(val) => setStatus(val as 'completed' | 'ongoing' | 'pending')}
            >
              <SelectTrigger id="edit-season-status">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="ongoing">Ongoing</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="pt-2 border-t border-c space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted">Scraper Configuration</h4>
            <div className="space-y-1.5">
              <Label htmlFor="edit-season-scraper-url">Scraper URL</Label>
              <Input
                id="edit-season-scraper-url"
                type="url"
                value={scraperUrl}
                onChange={(e) => handleScraperUrlChange(e.target.value)}
                placeholder="https://otakudesu.cloud/anime/... or https://dramula.com/watch/..."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-season-source">Provider Source</Label>
                <Select
                  value={source}
                  onValueChange={(val) => setSource(val)}
                >
                  <SelectTrigger id="edit-season-source">
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="otakudesu">Otakudesu</SelectItem>
                    <SelectItem value="dramula">Dramula</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-season-episode-offset">Episode Offset</Label>
                <Input
                  id="edit-season-episode-offset"
                  type="number"
                  value={episodeOffset}
                  onChange={(e) => setEpisodeOffset(parseInt(e.target.value, 10) || 0)}
                  placeholder="0"
                />
              </div>
            </div>

            {(season.lastScrapedAt || season.lastScrapeError) && (
              <div className="rounded border border-c bg-muted/20 p-2.5 space-y-1 text-xs">
                {season.lastScrapedAt && (
                  <div className="text-muted">
                    <span className="font-medium text-foreground">Last Scraped:</span>{' '}
                    {new Date(season.lastScrapedAt).toLocaleString()}
                  </div>
                )}
                {season.lastScrapeError && (
                  <div className="text-destructive font-mono text-[11px] break-words">
                    <span className="font-semibold">Last Error:</span> {season.lastScrapeError}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!title.trim() || updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
