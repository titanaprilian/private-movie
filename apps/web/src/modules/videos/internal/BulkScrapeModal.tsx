import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  ChunkyDialog,
  ChunkyDialogContent,
  ChunkyDialogHeader,
  ChunkyDialogTitle,
  ChunkyDialogDescription,
  ChunkyDialogBody,
  ChunkyDialogFooter,
} from '@/components/ui/chunky-dialog';
import {
  ChunkySelect,
  ChunkySelectContent,
  ChunkySelectItem,
  ChunkySelectTrigger,
  ChunkySelectValue,
} from '@/components/ui/chunky-select';
import { ChunkyButton } from '@/components/ui/chunky-button';
import { ChunkyInput } from '@/components/ui/chunky-input';
import { ChunkyCard } from '@/components/ui/chunky-card';
import {
  useBulkScrapeSources,
  type LocalEpisodeItem,
  type SeasonGroupOption,
} from './useBulkScrapeSources';
import { TargetEpisodeCombobox } from './TargetEpisodeCombobox';

export type { SeasonGroupOption };

export interface BulkScrapeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seriesId: string;
  localEpisodes?: LocalEpisodeItem[];
  seasons?: SeasonGroupOption[];
  onSuccess?: () => void;
}

function PillBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full px-2.5 py-1 text-xs font-extrabold border-2 border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]">
      {children}
    </span>
  );
}

function WarningBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full px-2.5 py-1 text-xs font-extrabold border-2 border-[var(--gold-dark)] bg-[var(--gold-tint)] text-[var(--gold)]">
      {children}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === 'success'
      ? 'border-[var(--green)] bg-[var(--green-soft)] text-[var(--green)]'
      : status === 'processing'
        ? 'border-[var(--gold-dark)] bg-[var(--gold-tint)] text-[var(--gold)] animate-pulse'
        : status === 'error'
          ? 'border-[var(--red)] bg-[var(--red)]/10 text-[var(--red)]'
          : 'border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]';
  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-extrabold uppercase tracking-wide border-2 ${tone}`}
    >
      {status}
    </span>
  );
}

const labelClassName = 'mb-1.5 block text-sm font-bold text-[var(--ink)]';

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
    seasonOffsetHelperText,
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
    isEpisodeHasSources,
    hasOverwriteConflicts,
  } = useBulkScrapeSources({ seriesId, seasons, localEpisodes, onSuccess });

  const [showOverwriteConfirm, setShowOverwriteConfirm] = useState(false);

  useEffect(() => {
    if (!open) {
      reset();
      setShowOverwriteConfirm(false);
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

  const handleSaveClick = () => {
    if (hasOverwriteConflicts) {
      setShowOverwriteConfirm(true);
    } else {
      handleSaveConfirm();
    }
  };

  const handleSaveConfirm = async () => {
    setShowOverwriteConfirm(false);
    try {
      await saveBulkSources(seriesId);
    } catch {
      // Error handled by toast in hook
    }
  };

  return (
    <>
      <ChunkyDialog open={open} onOpenChange={handleOpenChange}>
        <ChunkyDialogContent
          className="max-w-3xl"
          onPointerDownOutside={(e) => {
            if (isProcessing) e.preventDefault();
          }}
          onEscapeKeyDown={(e) => {
            if (isProcessing) e.preventDefault();
          }}
        >
          <ChunkyDialogHeader>
            <ChunkyDialogTitle>Bulk Add Sources</ChunkyDialogTitle>
            <ChunkyDialogDescription>
              {step === 1
                ? 'Enter season source URL and optional offset to match scraped episodes with local TMDB episodes.'
                : step === 2
                ? 'Review matched scraped episodes, assign target local episodes, or ignore items before saving.'
                : 'Sequential batch processing progress and status log.'}
            </ChunkyDialogDescription>
          </ChunkyDialogHeader>

          {step === 1 && (
            <form onSubmit={handlePreviewSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <ChunkyDialogBody className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="bulk-scrape-url" className={labelClassName}>
                    Season / Scraper URL
                  </label>
                  <ChunkyInput
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
                  <div className="space-y-1.5">
                    <label htmlFor="bulk-scrape-source-type" className={labelClassName}>
                      Source Type
                    </label>
                    <ChunkySelect
                      value={sourceType}
                      onValueChange={(val) => setSourceType(val)}
                      disabled={isFetchingPreview}
                    >
                      <ChunkySelectTrigger
                        id="bulk-scrape-source-type"
                        aria-label="Source Type"
                      >
                        <ChunkySelectValue placeholder="Select source type" />
                      </ChunkySelectTrigger>
                      <ChunkySelectContent>
                        <ChunkySelectItem value="otakudesu">Otakudesu</ChunkySelectItem>
                        <ChunkySelectItem value="dramula">Dramula</ChunkySelectItem>
                        <ChunkySelectItem value="direct">Direct Link</ChunkySelectItem>
                        <ChunkySelectItem value="embed">Embed</ChunkySelectItem>
                      </ChunkySelectContent>
                    </ChunkySelect>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="bulk-scrape-target-season" className={labelClassName}>
                      Target Season
                    </label>
                    <ChunkySelect
                      value={selectedSeasonId || (seasonOptions.length === 0 ? 'empty' : undefined)}
                      onValueChange={(val) => {
                        if (val !== 'empty') {
                          selectSeason(val);
                        }
                      }}
                      disabled={isFetchingPreview || seasonOptions.length === 0}
                    >
                      <ChunkySelectTrigger
                        id="bulk-scrape-target-season"
                        aria-label="Target Season"
                      >
                        <ChunkySelectValue placeholder="Select target season" />
                      </ChunkySelectTrigger>
                      <ChunkySelectContent>
                        {seasonOptions.length > 0 ? (
                          seasonOptions.map((season) => (
                            <ChunkySelectItem key={season.id} value={season.id}>
                              {season.label}
                            </ChunkySelectItem>
                          ))
                        ) : (
                          <ChunkySelectItem value="empty">-- No Seasons --</ChunkySelectItem>
                        )}
                      </ChunkySelectContent>
                    </ChunkySelect>
                    {seasonOffsetHelperText && (
                      <p
                        className="text-xs font-bold text-[var(--muted)]"
                        data-testid="bulk-scrape-offset-helper"
                      >
                        {seasonOffsetHelperText}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="bulk-scrape-offset" className={labelClassName}>
                    Episode Offset
                  </label>
                  <ChunkyInput
                    id="bulk-scrape-offset"
                    type="number"
                    placeholder="0"
                    value={episodeOffset}
                    onChange={(e) => setEpisodeOffset(parseInt(e.target.value, 10) || 0)}
                    disabled={isFetchingPreview}
                  />
                </div>
              </ChunkyDialogBody>

              <ChunkyDialogFooter>
                <ChunkyButton
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isFetchingPreview}
                >
                  Cancel
                </ChunkyButton>
                <ChunkyButton type="submit" variant="primary" disabled={isFetchingPreview}>
                  {isFetchingPreview ? 'Fetching Preview...' : 'Preview'}
                </ChunkyButton>
              </ChunkyDialogFooter>
            </form>
          )}

          {step === 2 && (
            <>
              <ChunkyDialogBody className="space-y-4">
                <ChunkyCard className="flex items-center justify-between gap-2 p-3 text-sm font-bold text-[var(--muted)]">
                  <span>
                    Offset: <strong className="text-[var(--green)]">{episodeOffset}</strong>
                  </span>
                  <span>
                    Total Scraped: <strong className="text-[var(--ink)]">{previewItems.length}</strong>
                  </span>
                  <span>
                    Pending Review:{' '}
                    <strong className="text-[var(--gold)]">
                      {previewItems.filter((i) => i.needsReview && !i.isIgnored).length}
                    </strong>
                  </span>
                </ChunkyCard>

                <div className="space-y-2">
                  <div className="grid grid-cols-1 gap-2 max-h-[360px] overflow-y-auto pr-1">
                    {previewItems.map((item, index) => {
                      const isConflict =
                        !item.isIgnored &&
                        Boolean(item.matchedLocalEpisodeId) &&
                        isEpisodeHasSources(item.matchedLocalEpisodeId);

                      return (
                        <ChunkyCard
                          key={item.id}
                          className={`p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-sm ${
                            item.isIgnored ? 'opacity-50' : ''
                          }`}
                        >
                          {/* Left: Scraped Episode Info */}
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-[var(--ink)]">
                                {item.scrapedTitle}
                              </span>
                              <PillBadge>Ep #{item.rawEpisodeNumber}</PillBadge>
                              {item.needsReview && !item.isIgnored && (
                                <WarningBadge>Needs Review</WarningBadge>
                              )}
                              {isConflict && (
                                <WarningBadge>⚠️ Overwrites existing sources</WarningBadge>
                              )}
                              {item.isIgnored && (
                                <PillBadge>Ignored</PillBadge>
                              )}
                            </div>
                          </div>

                          {/* Middle: Target Local Episode Dropdown Combobox */}
                          <div className="w-full sm:w-64">
                            <TargetEpisodeCombobox
                              scrapedTitle={item.scrapedTitle}
                              value={item.matchedLocalEpisodeId}
                              disabled={item.isIgnored || isSaving}
                              onValueChange={(newId) => updateMapping(index, newId)}
                              seasons={seasons}
                              localEpisodes={localEpisodes}
                            />
                          </div>

                          {/* Right: Ignore Toggle */}
                          <ChunkyButton
                            type="button"
                            variant={item.isIgnored ? 'outline' : 'blue'}
                            size="sm"
                            aria-label={`Ignore ${item.scrapedTitle}`}
                            onClick={() => toggleIgnore(index)}
                            disabled={isSaving}
                            className="shrink-0"
                          >
                            {item.isIgnored ? 'Include' : 'Ignore'}
                          </ChunkyButton>
                        </ChunkyCard>
                      );
                    })}
                  </div>
                </div>
              </ChunkyDialogBody>

              <ChunkyDialogFooter>
                <ChunkyButton
                  type="button"
                  variant="outline"
                  onClick={() => setStep(1)}
                  disabled={isSaving}
                >
                  Back
                </ChunkyButton>
                <ChunkyButton type="button" variant="primary" onClick={handleSaveClick} disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save'}
                </ChunkyButton>
              </ChunkyDialogFooter>
            </>
          )}

          {step === 3 && (
            <>
              <ChunkyDialogBody className="space-y-4">
                {/* Progress Bar & Counter */}
                <ChunkyCard className="space-y-2 p-3">
                  <div className="flex items-center justify-between font-sans text-sm font-bold text-[var(--muted)]">
                    <span>
                      Processing: <strong className="text-[var(--ink)]">{completedCount}</strong> / {totalCount} items
                    </span>
                    <span className="font-extrabold text-[var(--green)]">{progress}%</span>
                  </div>
                  <div
                    className="w-full rounded-full border-2 border-[var(--border)] bg-[var(--bg)] h-5 overflow-hidden p-1 shadow-[inset_0_2px_0_rgba(0,0,0,0.15)]"
                    role="progressbar"
                    aria-valuenow={progress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div
                      className="bg-[var(--green)] h-full rounded-full border-r-2 border-[var(--green-dark)] shadow-[0_2px_0_var(--green-dark)] transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </ChunkyCard>

                {/* Item-by-item status log list */}
                <div className="space-y-2">
                  <span className="font-sans text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">
                    Processing Log
                  </span>
                  <ChunkyCard
                    className="p-3 max-h-[300px] overflow-y-auto space-y-1.5 font-sans text-sm font-bold"
                    data-testid="bulk-scrape-logs"
                  >
                    {processingLogs.map((log) => (
                      <div
                        key={log.id}
                        className="flex items-center justify-between gap-2 py-1 border-b-2 border-[var(--border)] last:border-0"
                      >
                        <span className="truncate text-[var(--muted)]">{log.message}</span>
                        <StatusBadge status={log.status} />
                      </div>
                    ))}
                  </ChunkyCard>
                </div>
              </ChunkyDialogBody>

              <ChunkyDialogFooter>
                {isProcessing ? (
                  <ChunkyButton type="button" variant="outline" disabled>
                    Processing...
                  </ChunkyButton>
                ) : (
                  <ChunkyButton
                    type="button"
                    variant="primary"
                    data-testid="bulk-scrape-close-btn"
                    onClick={() => {
                      onOpenChange(false);
                      reset();
                    }}
                  >
                    Close
                  </ChunkyButton>
                )}
              </ChunkyDialogFooter>
            </>
          )}
        </ChunkyDialogContent>
      </ChunkyDialog>

      <ChunkyDialog open={showOverwriteConfirm} onOpenChange={setShowOverwriteConfirm}>
        <ChunkyDialogContent className="sm:max-w-md">
          <ChunkyDialogHeader>
            <ChunkyDialogTitle>Overwrite Existing Sources?</ChunkyDialogTitle>
            <ChunkyDialogDescription>
              One or more mapped local episodes already contain video sources. Proceeding will overwrite their existing video sources. Please double-check your episode offset and target mappings before confirming.
            </ChunkyDialogDescription>
          </ChunkyDialogHeader>
          <ChunkyDialogFooter>
            <ChunkyButton
              type="button"
              variant="outline"
              onClick={() => setShowOverwriteConfirm(false)}
            >
              Cancel
            </ChunkyButton>
            <ChunkyButton
              type="button"
              variant="danger"
              onClick={handleSaveConfirm}
            >
              Confirm & Save
            </ChunkyButton>
          </ChunkyDialogFooter>
        </ChunkyDialogContent>
      </ChunkyDialog>
    </>
  );
}
