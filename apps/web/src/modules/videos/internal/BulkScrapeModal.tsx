import { useEffect } from 'react';
import { toast } from 'sonner';
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
  useBulkScrapeSources,
  type LocalEpisodeItem,
} from './useBulkScrapeSources';

export interface SeasonGroupOption {
  id: string;
  title?: string | null;
  tmdbSeason?: number | null;
  episodes?: Array<{ id: string; title: string; order?: number }>;
}

export interface BulkScrapeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seriesId: string;
  localEpisodes?: LocalEpisodeItem[];
  seasons?: SeasonGroupOption[];
}

export function BulkScrapeModal({
  open,
  onOpenChange,
  seriesId,
  localEpisodes = [],
  seasons = [],
}: BulkScrapeModalProps) {
  const {
    step,
    setStep,
    sourceUrl,
    setSourceUrl,
    sourceType,
    setSourceType,
    episodeOffset,
    setEpisodeOffset,
    previewItems,
    fetchPreview,
    updateMapping,
    toggleIgnore,
    reset,
  } = useBulkScrapeSources();

  useEffect(() => {
    if (!open) {
      reset();
    }
  }, [open, reset]);

  const handlePreviewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceUrl.trim()) {
      toast.error('Source URL required', {
        description: 'Please enter a valid scraper season URL.',
      });
      return;
    }
    fetchPreview(localEpisodes);
  };

  const handleSave = () => {
    const validMappings = previewItems
      .filter((item) => !item.isIgnored)
      .map((item) => ({
        episodeId: item.matchedLocalEpisodeId,
        scrapedTitle: item.scrapedTitle,
        videoSources: item.videoSources,
      }));

    console.log('[BulkScrapeModal] Saving bulk sources for series:', seriesId, {
      sourceUrl,
      sourceType,
      episodeOffset,
      mappings: validMappings,
    });

    toast.success('Bulk sources saved', {
      description: `Successfully processed ${validMappings.length} episode sources.`,
    });

    onOpenChange(false);
    reset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Bulk Add Sources</DialogTitle>
          <DialogDescription>
            {step === 1
              ? 'Enter season source URL and optional offset to match scraped episodes with local TMDB episodes.'
              : 'Review matched scraped episodes, assign target local episodes, or ignore items before saving.'}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <form onSubmit={handlePreviewSubmit} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="bulk-scrape-url">Season / Scraper URL</Label>
              <Input
                id="bulk-scrape-url"
                type="url"
                placeholder="https://otakudesu.cloud/anime/example-season"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bulk-scrape-source-type">Source Type</Label>
                <select
                  id="bulk-scrape-source-type"
                  aria-label="Source Type"
                  value={sourceType}
                  onChange={(e) => setSourceType(e.target.value)}
                  className="w-full px-3 py-2 rounded border border-c bg-card text-fg text-sm focus:outline-none focus:border-primary"
                >
                  <option value="otakudesu">Otakudesu</option>
                  <option value="direct">Direct Link</option>
                  <option value="embed">Embed</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bulk-scrape-offset">Episode Offset</Label>
                <Input
                  id="bulk-scrape-offset"
                  type="number"
                  placeholder="0"
                  value={episodeOffset}
                  onChange={(e) => setEpisodeOffset(parseInt(e.target.value, 10) || 0)}
                />
              </div>
            </div>

            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Preview</Button>
            </DialogFooter>
          </form>
        )}

        {step === 2 && (
          <div className="space-y-4 py-2 overflow-y-auto flex-1 pr-1">
            <div className="flex items-center justify-between text-xs mono p-2.5 rounded border border-c bg-sidebar">
              <span>
                Offset: <strong className="text-primary">{episodeOffset}</strong>
              </span>
              <span>
                Total Scraped: <strong>{previewItems.length}</strong>
              </span>
              <span>
                Pending Review:{' '}
                <strong className="text-amber-600 dark:text-amber-400">
                  {previewItems.filter((i) => i.needsReview && !i.isIgnored).length}
                </strong>
              </span>
            </div>

            <div className="space-y-2">
              <div className="divide-y divide-[var(--border)] border border-c rounded max-h-[360px] overflow-y-auto bg-card">
                {previewItems.map((item, index) => {
                  return (
                    <div
                      key={item.id}
                      className={`p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs ${
                        item.isIgnored ? 'opacity-50 bg-muted/20' : 'hover-bg'
                      }`}
                    >
                      {/* Left: Scraped Episode Info */}
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-current text-sm">
                            {item.scrapedTitle}
                          </span>
                          <span className="mono text-[10px] px-1.5 py-0.5 rounded border border-c bg-sidebar text-muted">
                            Ep #{item.rawEpisodeNumber}
                          </span>
                          {item.needsReview && !item.isIgnored && (
                            <span className="mono text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 font-semibold">
                              Needs Review
                            </span>
                          )}
                          {item.isIgnored && (
                            <span className="mono text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                              Ignored
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Middle: Target Local Episode Dropdown Combobox */}
                      <div className="w-full sm:w-64">
                        <select
                          aria-label={`Target episode for ${item.scrapedTitle}`}
                          value={item.matchedLocalEpisodeId ?? ''}
                          disabled={item.isIgnored}
                          onChange={(e) =>
                            updateMapping(
                              index,
                              e.target.value ? e.target.value : null
                            )
                          }
                          className="w-full px-2.5 py-1.5 rounded border border-c bg-card text-fg text-xs focus:outline-none focus:border-primary disabled:opacity-50"
                        >
                          <option value="">-- Skip / Unmapped --</option>
                          {seasons.length > 0
                            ? seasons.map((season) => (
                                <optgroup
                                  key={season.id}
                                  label={season.title || `Season ${season.tmdbSeason ?? ''}`}
                                >
                                  {(season.episodes ?? []).map((ep) => (
                                    <option key={ep.id} value={ep.id}>
                                      Ep {ep.order ?? '?'}: {ep.title}
                                    </option>
                                  ))}
                                </optgroup>
                              ))
                            : localEpisodes.map((ep) => (
                                <option key={ep.id} value={ep.id}>
                                  Ep {ep.order ?? '?'}: {ep.title}
                                </option>
                              ))}
                        </select>
                      </div>

                      {/* Right: Ignore Toggle */}
                      <Button
                        type="button"
                        variant={item.isIgnored ? 'outline' : 'secondary'}
                        size="sm"
                        aria-label={`Ignore ${item.scrapedTitle}`}
                        onClick={() => toggleIgnore(index)}
                        className="shrink-0 text-xs h-8"
                      >
                        {item.isIgnored ? 'Include' : 'Ignore'}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>

            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(1)}
              >
                Back
              </Button>
              <Button type="button" onClick={handleSave}>
                Save
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
