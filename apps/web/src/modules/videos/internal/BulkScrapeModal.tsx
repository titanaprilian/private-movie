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
  type SeasonGroupOption,
} from './useBulkScrapeSources';

export type { SeasonGroupOption };

export interface BulkScrapeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seriesId: string;
  localEpisodes?: LocalEpisodeItem[];
  seasons?: SeasonGroupOption[];
  onSuccess?: () => void;
}

export function BulkScrapeModal({
  open,
  onOpenChange,
  seriesId,
  localEpisodes = [],
  seasons = [],
  onSuccess,
}: BulkScrapeModalProps) {
  const {
    step,
    setStep,
    sourceUrl,
    setSourceUrl,
    sourceType,
    setSourceType,
    selectedSeasonId,
    selectSeason,
    seasonOptions,
    episodeOffset,
    setEpisodeOffset,
    previewItems,
    fetchPreview,
    saveBulkSources,
    isFetchingPreview,
    isSaving,
    isProcessing,
    processingLogs,
    progress,
    completedCount,
    totalCount,
    updateMapping,
    toggleIgnore,
    reset,
  } = useBulkScrapeSources({ seriesId, seasons, localEpisodes, onSuccess });

  useEffect(() => {
    if (!open) {
      reset();
    }
  }, [open, reset]);

  const handleOpenChange = (openState: boolean) => {
    if (isProcessing) return;
    onOpenChange(openState);
  };

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

  const handleSave = async () => {
    try {
      await saveBulkSources(seriesId);
    } catch {
      // Error handled by toast in hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-3xl max-h-[85vh] flex flex-col"
        onPointerDownOutside={(e) => {
          if (isProcessing) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (isProcessing) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>Bulk Add Sources</DialogTitle>
          <DialogDescription>
            {step === 1
              ? 'Enter season source URL and optional offset to match scraped episodes with local TMDB episodes.'
              : step === 2
              ? 'Review matched scraped episodes, assign target local episodes, or ignore items before saving.'
              : 'Sequential batch processing progress and status log.'}
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
                disabled={isFetchingPreview}
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
                  disabled={isFetchingPreview}
                  className="w-full px-3 py-2 rounded border border-c bg-card text-fg text-sm focus:outline-none focus:border-primary disabled:opacity-50"
                >
                  <option value="otakudesu">Otakudesu</option>
                  <option value="direct">Direct Link</option>
                  <option value="embed">Embed</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bulk-scrape-target-season">Target Season</Label>
                <select
                  id="bulk-scrape-target-season"
                  aria-label="Target Season"
                  value={selectedSeasonId}
                  onChange={(e) => selectSeason(e.target.value)}
                  disabled={isFetchingPreview || seasonOptions.length === 0}
                  className="w-full px-3 py-2 rounded border border-c bg-card text-fg text-sm focus:outline-none focus:border-primary disabled:opacity-50"
                >
                  {seasonOptions.length > 0 ? (
                    seasonOptions.map((season) => (
                      <option key={season.id} value={season.id}>
                        {season.label}
                      </option>
                    ))
                  ) : (
                    <option value="">-- No Seasons --</option>
                  )}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bulk-scrape-offset">Episode Offset</Label>
              <Input
                id="bulk-scrape-offset"
                type="number"
                placeholder="0"
                value={episodeOffset}
                onChange={(e) => setEpisodeOffset(parseInt(e.target.value, 10) || 0)}
                disabled={isFetchingPreview}
              />
            </div>

            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isFetchingPreview}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isFetchingPreview}>
                {isFetchingPreview ? 'Fetching Preview...' : 'Preview'}
              </Button>
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
                          disabled={item.isIgnored || isSaving}
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
                        disabled={isSaving}
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
                disabled={isSaving}
              >
                Back
              </Button>
              <Button type="button" onClick={handleSave} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4 py-2 overflow-y-auto flex-1 pr-1">
            {/* Progress Bar & Counter */}
            <div className="space-y-2 p-3 rounded border border-c bg-sidebar">
              <div className="flex items-center justify-between text-xs mono">
                <span>
                  Processing: <strong>{completedCount}</strong> / {totalCount} items
                </span>
                <span className="font-semibold text-primary">{progress}%</span>
              </div>
              <div
                className="w-full bg-card border border-c rounded-full h-3 overflow-hidden p-0.5"
                role="progressbar"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="bg-primary h-full rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Item-by-item status log list */}
            <div className="space-y-2">
              <Label className="text-xs mono uppercase tracking-wide text-muted">
                Processing Log
              </Label>
              <div
                className="border border-c rounded p-3 bg-card max-h-[300px] overflow-y-auto space-y-1.5 mono text-xs"
                data-testid="bulk-scrape-logs"
              >
                {processingLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between gap-2 py-1 border-b border-c last:border-0"
                  >
                    <span className="truncate">{log.message}</span>
                    <span
                      className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                        log.status === 'success'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : log.status === 'processing'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 animate-pulse'
                          : log.status === 'skipped'
                          ? 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                          : log.status === 'error'
                          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                      }`}
                    >
                      {log.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter className="pt-4">
              {isProcessing ? (
                <Button type="button" disabled variant="outline">
                  Processing...
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={() => {
                    onOpenChange(false);
                    reset();
                  }}
                >
                  Close
                </Button>
              )}
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
