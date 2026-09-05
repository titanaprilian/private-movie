import { useEffect } from 'react';
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
  useBulkIngestSources,
} from './useBulkIngestSources';
import { TargetEpisodeCombobox } from './TargetEpisodeCombobox';
import { formatBytes } from './parseIngestUrl';
import type { LocalEpisodeItem, SeasonGroupOption } from './useBulkScrapeSources';

export interface BulkIngestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seriesId: string;
  localEpisodes?: LocalEpisodeItem[];
  seasons?: SeasonGroupOption[];
  onSuccess?: () => void;
}

export function BulkIngestModal({
  open,
  onOpenChange,
  seriesId,
  localEpisodes = [],
  seasons = [],
  onSuccess,
}: BulkIngestModalProps) {
  const {
    step,
    setStep,
    rawUrlsText,
    setRawUrlsText,
    defaultLabel,
    setDefaultLabel,
    defaultQuality,
    setDefaultQuality,
    sharedReferer,
    setSharedReferer,
    selectedSeasonId,
    setSelectedSeasonId,
    seasonOptions,
    items,
    parseUrls,
    updateMapping,
    updateLabel,
    updateQuality,
    toggleIgnore,
    totalCount,
    matchedCount,
    needsReviewCount,
    startIngestQueue,
    cancelQueue,
    isProcessing,
    completedCount,
    progressPercentage,
    activeItem,
    reset,
  } = useBulkIngestSources({ seriesId, seasons, localEpisodes, onSuccess });

  useEffect(() => {
    if (!open) {
      reset();
    }
  }, [open, reset]);

  const handleOpenChange = (openState: boolean) => {
    if (isProcessing) return;
    onOpenChange(openState);
  };

  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    parseUrls();
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
          <DialogTitle>Bulk Remote Video Ingest</DialogTitle>
          <DialogDescription>
            {step === 1
              ? 'Paste multi-line video stream URLs for season ingestion to Backblaze B2/S3 storage.'
              : step === 2
              ? 'Review matched episodes, manually assign unmatched URLs, and customize labels/qualities.'
              : 'Sequential ingestion progress and transfer status log.'}
          </DialogDescription>
        </DialogHeader>

        {/* STEP 1: Input URLs & Defaults */}
        {step === 1 && (
          <form onSubmit={handleStep1Submit} className="space-y-4 py-2 flex-1 overflow-y-auto pr-1">
            <div className="space-y-2">
              <Label htmlFor="bulk-ingest-urls">Video URLs (One per line)</Label>
              <textarea
                id="bulk-ingest-urls"
                data-testid="bulk-ingest-urls-textarea"
                rows={6}
                placeholder={`https://example.com/videos/Teach.You.a.Lesson.E01.1080p.mp4\nhttps://example.com/videos/Teach.You.a.Lesson.E02.1080p.mp4`}
                value={rawUrlsText}
                onChange={(e) => setRawUrlsText(e.target.value)}
                required
                className="flex w-full rounded border border-c bg-transparent px-3 py-2 text-xs mono shadow-sm transition-colors placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bulk-ingest-target-season">Target Season</Label>
                <select
                  id="bulk-ingest-target-season"
                  aria-label="Target Season"
                  value={selectedSeasonId}
                  onChange={(e) => setSelectedSeasonId(e.target.value)}
                  disabled={seasonOptions.length === 0}
                  className="w-full px-3 py-2 rounded border border-c bg-card text-fg text-sm focus:outline-none focus:border-primary disabled:opacity-50"
                >
                  {seasonOptions.length > 0 ? (
                    seasonOptions.map((season) => (
                      <option key={season.id} value={season.id}>
                        {season.label}
                      </option>
                    ))
                  ) : (
                    <option value="">-- Default Season --</option>
                  )}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bulk-ingest-default-quality">Default Quality</Label>
                <select
                  id="bulk-ingest-default-quality"
                  aria-label="Default Quality"
                  value={defaultQuality}
                  onChange={(e) => setDefaultQuality(e.target.value)}
                  className="w-full px-3 py-2 rounded border border-c bg-card text-fg text-sm focus:outline-none focus:border-primary"
                >
                  <option value="">Auto / Extracted</option>
                  <option value="2160p">2160p (4K)</option>
                  <option value="1080p">1080p</option>
                  <option value="720p">720p</option>
                  <option value="480p">480p</option>
                  <option value="360p">360p</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bulk-ingest-default-label">Default Source Label</Label>
                <Input
                  id="bulk-ingest-default-label"
                  type="text"
                  placeholder="S3 Video"
                  value={defaultLabel}
                  onChange={(e) => setDefaultLabel(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bulk-ingest-referer">
                  Shared HTTP Referer <span className="text-muted font-normal">(Optional)</span>
                </Label>
                <Input
                  id="bulk-ingest-referer"
                  type="text"
                  placeholder="https://referer-site.com"
                  value={sharedReferer}
                  onChange={(e) => setSharedReferer(e.target.value)}
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
              <Button type="submit" data-testid="bulk-ingest-parse-btn">
                Parse & Review URLs
              </Button>
            </DialogFooter>
          </form>
        )}

        {/* STEP 2: Review & Manual Episode Combobox Matching */}
        {step === 2 && (
          <div className="space-y-4 py-2 overflow-y-auto flex-1 pr-1">
            {/* Header counters */}
            <div className="flex items-center justify-between text-xs mono p-2.5 rounded border border-c bg-sidebar">
              <span>
                Total URLs: <strong>{totalCount}</strong>
              </span>
              <span>
                Matched:{' '}
                <strong className="text-green-600 dark:text-green-400">
                  {matchedCount}
                </strong>
              </span>
              <span>
                Needs Review:{' '}
                <strong className="text-amber-600 dark:text-amber-400">
                  {needsReviewCount}
                </strong>
              </span>
            </div>

            {/* List of URLs for matching & editing */}
            <div className="divide-y divide-[var(--border)] border border-c rounded max-h-[380px] overflow-y-auto bg-card">
              {items.map((item, index) => (
                <div
                  key={item.id}
                  data-testid={`bulk-ingest-row-${index}`}
                  className={`p-3 flex flex-col gap-2.5 text-xs ${
                    item.isIgnored ? 'opacity-50 bg-muted/20' : 'hover-bg'
                  }`}
                >
                  {/* Top line: Filename & Status Badges */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap min-w-0 flex-1">
                      <span className="font-medium text-current truncate max-w-sm" title={item.url}>
                        {item.filename}
                      </span>
                      {item.detectedEpisodeNumber !== null && (
                        <span className="mono text-[10px] px-1.5 py-0.5 rounded border border-c bg-sidebar text-muted">
                          Detected Ep #{item.detectedEpisodeNumber}
                        </span>
                      )}
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

                    <Button
                      type="button"
                      variant={item.isIgnored ? 'outline' : 'secondary'}
                      size="sm"
                      onClick={() => toggleIgnore(index)}
                      className="shrink-0 text-xs h-7 px-2.5"
                    >
                      {item.isIgnored ? 'Include' : 'Ignore'}
                    </Button>
                  </div>

                  {/* Bottom line: Target Episode Combobox + Label + Quality */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center">
                    <div>
                      <TargetEpisodeCombobox
                        scrapedTitle={item.filename}
                        value={item.matchedLocalEpisodeId}
                        disabled={item.isIgnored}
                        onValueChange={(newId) => updateMapping(index, newId)}
                        seasons={seasons}
                        localEpisodes={localEpisodes}
                      />
                    </div>

                    <div>
                      <Input
                        type="text"
                        aria-label={`Label for ${item.filename}`}
                        placeholder="Label"
                        value={item.label}
                        onChange={(e) => updateLabel(index, e.target.value)}
                        disabled={item.isIgnored}
                        className="h-8 text-xs"
                      />
                    </div>

                    <div>
                      <Input
                        type="text"
                        aria-label={`Quality for ${item.filename}`}
                        placeholder="Quality (e.g. 1080p)"
                        value={item.quality || ''}
                        onChange={(e) => updateQuality(index, e.target.value)}
                        disabled={item.isIgnored}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(1)}
              >
                Back
              </Button>
              <Button
                type="button"
                data-testid="bulk-ingest-start-btn"
                onClick={startIngestQueue}
              >
                Start Bulk Ingestion ({matchedCount})
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* STEP 3: Sequential Processing Queue */}
        {step === 3 && (
          <div className="space-y-4 py-2 overflow-y-auto flex-1 pr-1">
            {/* Progress Bar & Counter */}
            <div className="space-y-2 p-3 rounded border border-c bg-sidebar">
              <div className="flex items-center justify-between text-xs mono">
                <span>
                  Processing: Item <strong>{completedCount}</strong> of {totalCount} ({progressPercentage}%)
                </span>
                <span className="font-semibold text-primary">{progressPercentage}%</span>
              </div>
              <div
                className="w-full bg-card border border-c rounded-full h-3 overflow-hidden p-0.5"
                role="progressbar"
                aria-valuenow={progressPercentage}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="bg-primary h-full rounded-full transition-all duration-300"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>

              {/* Active Transfer Details */}
              {activeItem?.progress && (
                <div className="text-[11px] mono text-muted flex items-center justify-between pt-1">
                  <span className="truncate max-w-md">Ingesting: {activeItem.filename}</span>
                  <span>
                    {activeItem.progress.percent}% - {formatBytes(activeItem.progress.loaded)}{' '}
                    {activeItem.progress.total > 0 ? `/ ${formatBytes(activeItem.progress.total)}` : ''}
                  </span>
                </div>
              )}
            </div>

            {/* Status Log Table */}
            <div className="space-y-2">
              <Label className="text-xs mono uppercase tracking-wide text-muted">
                Transfer Queue Log
              </Label>
              <div
                className="border border-c rounded p-3 bg-card max-h-[300px] overflow-y-auto space-y-2 mono text-xs"
                data-testid="bulk-ingest-logs"
              >
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-1.5 border-b border-c last:border-0"
                  >
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="font-medium text-current truncate">
                        {item.filename}
                      </span>
                      {item.errorMessage && (
                        <span className="text-[10px] text-red-500 truncate">
                          {item.errorMessage}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                          item.status === 'completed'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : item.status === 'ingesting'
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 animate-pulse'
                            : item.status === 'failed'
                            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter className="pt-4">
              {isProcessing ? (
                <Button
                  type="button"
                  variant="destructive"
                  data-testid="cancel-queue-btn"
                  onClick={cancelQueue}
                >
                  Cancel Queue
                </Button>
              ) : (
                <Button
                  type="button"
                  data-testid="bulk-ingest-close-btn"
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
