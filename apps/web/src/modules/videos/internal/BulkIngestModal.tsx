import { useEffect } from 'react';
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
import { ChunkyTextarea } from '@/components/ui/chunky-textarea';
import { ChunkyCard } from '@/components/ui/chunky-card';
import { useBulkIngestSources } from './useBulkIngestSources';
import { TargetEpisodeCombobox } from './TargetEpisodeCombobox';
import { formatBytes } from './parseIngestUrl';
import type {
  LocalEpisodeItem,
  SeasonGroupOption,
} from './useBulkScrapeSources';

export interface BulkIngestModalProps {
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

function ProviderBadge({
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className="rounded-full px-2.5 py-1 text-xs font-extrabold border-2 border-[var(--purple)] bg-[var(--purple)]/10 text-[var(--purple)]"
      {...props}
    >
      {children}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === 'completed'
      ? 'border-[var(--green)] bg-[var(--green-soft)] text-[var(--green)]'
      : status === 'ingesting'
        ? 'border-[var(--gold-dark)] bg-[var(--gold-tint)] text-[var(--gold)] animate-pulse'
        : status === 'failed'
          ? 'border-[var(--red)] bg-[var(--red)]/10 text-[var(--red)]'
          : 'border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]';
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-extrabold uppercase tracking-wide border-2 ${tone}`}
    >
      {status}
    </span>
  );
}

const labelClassName = 'mb-1.5 block text-sm font-bold text-[var(--ink)]';

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
    storageProviders,
    selectedStorageProviderId,
    setSelectedStorageProviderId,
    reset,
  } = useBulkIngestSources({ seriesId, seasons, localEpisodes, onSuccess });

  const selectedProviderName =
    storageProviders.find((p) => p.id === selectedStorageProviderId)?.name ??
    null;

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
          <ChunkyDialogTitle>Bulk Remote Video Ingest</ChunkyDialogTitle>
          <ChunkyDialogDescription>
            {step === 1
              ? 'Paste multi-line video stream URLs for season ingestion to Backblaze B2/S3 storage.'
              : step === 2
                ? 'Review matched episodes, manually assign unmatched URLs, and customize labels/qualities.'
                : 'Sequential ingestion progress and transfer status log.'}
          </ChunkyDialogDescription>
        </ChunkyDialogHeader>

        {/* STEP 1: Input URLs & Defaults */}
        {step === 1 && (
          <form
            onSubmit={handleStep1Submit}
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            <ChunkyDialogBody className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="bulk-ingest-urls" className={labelClassName}>
                  Video URLs (One per line)
                </label>
                <ChunkyTextarea
                  id="bulk-ingest-urls"
                  data-testid="bulk-ingest-urls-textarea"
                  rows={6}
                  placeholder={`https://example.com/videos/Teach.You.a.Lesson.E01.1080p.mp4\nhttps://example.com/videos/Teach.You.a.Lesson.E02.1080p.mp4`}
                  value={rawUrlsText}
                  onChange={(e) => setRawUrlsText(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="bulk-ingest-target-season" className={labelClassName}>
                    Target Season
                  </label>
                  <ChunkySelect
                    value={selectedSeasonId || (seasonOptions.length === 0 ? 'empty' : undefined)}
                    onValueChange={(val) => {
                      if (val !== 'empty') {
                        setSelectedSeasonId(val);
                      }
                    }}
                    disabled={seasonOptions.length === 0}
                  >
                    <ChunkySelectTrigger
                      id="bulk-ingest-target-season"
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
                        <ChunkySelectItem value="empty">-- Default Season --</ChunkySelectItem>
                      )}
                    </ChunkySelectContent>
                  </ChunkySelect>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="bulk-ingest-default-quality" className={labelClassName}>
                    Default Quality
                  </label>
                  <ChunkySelect
                    value={defaultQuality || 'auto'}
                    onValueChange={(val) => setDefaultQuality(val === 'auto' ? '' : val)}
                  >
                    <ChunkySelectTrigger
                      id="bulk-ingest-default-quality"
                      aria-label="Default Quality"
                    >
                      <ChunkySelectValue placeholder="Select default quality" />
                    </ChunkySelectTrigger>
                    <ChunkySelectContent>
                      <ChunkySelectItem value="auto">Auto / Extracted</ChunkySelectItem>
                      <ChunkySelectItem value="2160p">2160p (4K)</ChunkySelectItem>
                      <ChunkySelectItem value="1080p">1080p</ChunkySelectItem>
                      <ChunkySelectItem value="720p">720p</ChunkySelectItem>
                      <ChunkySelectItem value="480p">480p</ChunkySelectItem>
                      <ChunkySelectItem value="360p">360p</ChunkySelectItem>
                    </ChunkySelectContent>
                  </ChunkySelect>
                </div>
              </div>

              {/* Target S3 Storage Provider (Conditional) */}
              {storageProviders.length > 0 && (
                <div className="space-y-1.5">
                  <label htmlFor="bulk-ingest-storage-provider" className={labelClassName}>
                    Target S3 Storage Provider
                  </label>
                  <ChunkySelect
                    value={selectedStorageProviderId}
                    onValueChange={(val) => setSelectedStorageProviderId(val)}
                    disabled={isProcessing}
                  >
                    <ChunkySelectTrigger
                      id="bulk-ingest-storage-provider"
                      data-testid="bulk-ingest-storage-provider-select"
                      aria-label="Target S3 Storage Provider"
                    >
                      <ChunkySelectValue placeholder="Select storage provider" />
                    </ChunkySelectTrigger>
                    <ChunkySelectContent>
                      {storageProviders.map((provider) => (
                        <ChunkySelectItem key={provider.id} value={provider.id}>
                          {provider.name}
                          {provider.isDefault ? ' (Default)' : ''}
                        </ChunkySelectItem>
                      ))}
                    </ChunkySelectContent>
                  </ChunkySelect>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="bulk-ingest-default-label" className={labelClassName}>
                    Default Source Label
                  </label>
                  <ChunkyInput
                    id="bulk-ingest-default-label"
                    type="text"
                    placeholder="S3 Video"
                    value={defaultLabel}
                    onChange={(e) => setDefaultLabel(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="bulk-ingest-referer" className={labelClassName}>
                    Shared HTTP Referer{' '}
                    <span className="text-[var(--muted)] font-semibold">(Optional)</span>
                  </label>
                  <ChunkyInput
                    id="bulk-ingest-referer"
                    type="text"
                    placeholder="https://referer-site.com"
                    value={sharedReferer}
                    onChange={(e) => setSharedReferer(e.target.value)}
                  />
                </div>
              </div>
            </ChunkyDialogBody>

            <ChunkyDialogFooter>
              <ChunkyButton
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </ChunkyButton>
              <ChunkyButton type="submit" variant="primary" data-testid="bulk-ingest-parse-btn">
                Parse & Review URLs
              </ChunkyButton>
            </ChunkyDialogFooter>
          </form>
        )}

        {/* STEP 2: Review & Manual Episode Combobox Matching */}
        {step === 2 && (
          <>
            <ChunkyDialogBody className="space-y-4">
              {/* Header counters */}
              <ChunkyCard className="flex items-center justify-between gap-2 flex-wrap p-3 text-sm font-bold text-[var(--muted)]">
                <div className="flex items-center gap-4 flex-wrap">
                  <span>
                    Total URLs: <strong className="text-[var(--ink)]">{totalCount}</strong>
                  </span>
                  <span>
                    Matched:{' '}
                    <strong className="text-[var(--green)]">
                      {matchedCount}
                    </strong>
                  </span>
                  <span>
                    Needs Review:{' '}
                    <strong className="text-[var(--gold)]">
                      {needsReviewCount}
                    </strong>
                  </span>
                </div>
                {selectedProviderName && (
                  <ProviderBadge data-testid="bulk-ingest-target-provider-badge">
                    Target: {selectedProviderName}
                  </ProviderBadge>
                )}
              </ChunkyCard>

              {/* List of URLs for matching & editing */}
              <div className="grid grid-cols-1 gap-2 max-h-[380px] overflow-y-auto pr-1">
                {items.map((item, index) => (
                  <ChunkyCard
                    key={item.id}
                    data-testid={`bulk-ingest-row-${index}`}
                    className={`p-3 flex flex-col gap-2.5 text-sm ${
                      item.isIgnored ? 'opacity-50' : ''
                    }`}
                  >
                    {/* Top line: Filename & Status Badges */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap min-w-0 flex-1">
                        <span
                          className="font-bold text-[var(--ink)] truncate max-w-sm"
                          title={item.url}
                        >
                          {item.filename}
                        </span>
                        {item.detectedEpisodeNumber !== null && (
                          <PillBadge>
                            Detected Ep #{item.detectedEpisodeNumber}
                          </PillBadge>
                        )}
                        {item.needsReview && !item.isIgnored && (
                          <WarningBadge>Needs Review</WarningBadge>
                        )}
                        {item.isIgnored && (
                          <PillBadge>Ignored</PillBadge>
                        )}
                      </div>

                      <ChunkyButton
                        type="button"
                        variant={item.isIgnored ? 'outline' : 'blue'}
                        size="sm"
                        onClick={() => toggleIgnore(index)}
                        className="shrink-0"
                      >
                        {item.isIgnored ? 'Include' : 'Ignore'}
                      </ChunkyButton>
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
                        <ChunkyInput
                          type="text"
                          aria-label={`Label for ${item.filename}`}
                          placeholder="Label"
                          value={item.label}
                          onChange={(e) => updateLabel(index, e.target.value)}
                          disabled={item.isIgnored}
                        />
                      </div>

                      <div>
                        <ChunkyInput
                          type="text"
                          aria-label={`Quality for ${item.filename}`}
                          placeholder="Quality (e.g. 1080p)"
                          value={item.quality || ''}
                          onChange={(e) => updateQuality(index, e.target.value)}
                          disabled={item.isIgnored}
                        />
                      </div>
                    </div>
                  </ChunkyCard>
                ))}
              </div>
            </ChunkyDialogBody>

            <ChunkyDialogFooter>
              <ChunkyButton
                type="button"
                variant="outline"
                onClick={() => setStep(1)}
              >
                Back
              </ChunkyButton>
              <ChunkyButton
                type="button"
                variant="primary"
                data-testid="bulk-ingest-start-btn"
                onClick={startIngestQueue}
              >
                Start Bulk Ingestion ({matchedCount})
              </ChunkyButton>
            </ChunkyDialogFooter>
          </>
        )}

        {/* STEP 3: Sequential Processing Queue */}
        {step === 3 && (
          <>
            <ChunkyDialogBody className="space-y-4">
              {/* Progress Bar & Counter */}
              <ChunkyCard className="space-y-2 p-3">
                <div className="flex items-center justify-between font-sans text-sm font-bold text-[var(--muted)]">
                  <span>
                    Processing: Item <strong className="text-[var(--ink)]">{completedCount}</strong> of{' '}
                    {totalCount} ({progressPercentage}%)
                  </span>
                  <span className="font-extrabold text-[var(--green)]">
                    {progressPercentage}%
                  </span>
                </div>
                <div
                  className="w-full rounded-full border-2 border-[var(--border)] bg-[var(--bg)] h-5 overflow-hidden p-1 shadow-[inset_0_2px_0_rgba(0,0,0,0.15)]"
                  role="progressbar"
                  aria-valuenow={progressPercentage}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="bg-[var(--green)] h-full rounded-full border-r-2 border-[var(--green-dark)] shadow-[0_2px_0_var(--green-dark)] transition-all duration-300"
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>

                {/* Target Provider & Active Transfer Details */}
                <ChunkyCard className="flex items-center justify-between gap-2 flex-wrap p-2 font-sans text-xs font-bold text-[var(--muted)]">
                  {selectedProviderName && (
                    <span data-testid="bulk-ingest-progress-provider">
                      Target Provider:{' '}
                      <strong className="text-[var(--ink)]">
                        {selectedProviderName}
                      </strong>
                    </span>
                  )}
                  {activeItem?.progress && (
                    <span className="ml-auto">
                      {activeItem.progress.percent}% -{' '}
                      {formatBytes(activeItem.progress.loaded)}{' '}
                      {activeItem.progress.total > 0
                        ? `/ ${formatBytes(activeItem.progress.total)}`
                        : ''}
                    </span>
                  )}
                </ChunkyCard>
                {activeItem?.progress && (
                  <div className="font-sans text-xs font-bold text-[var(--muted)] truncate max-w-md">
                    Ingesting: {activeItem.filename}
                  </div>
                )}
              </ChunkyCard>

              {/* Status Log Table */}
              <div className="space-y-2">
                <span className="font-sans text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">
                  Transfer Queue Log
                </span>
                <ChunkyCard
                  className="p-3 max-h-[300px] overflow-y-auto space-y-2 font-sans text-sm font-bold"
                  data-testid="bulk-ingest-logs"
                >
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-1.5 border-b-2 border-[var(--border)] last:border-0"
                    >
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="font-bold text-[var(--ink)] truncate">
                          {item.filename}
                        </span>
                        {item.errorMessage && (
                          <span className="text-xs font-bold text-[var(--red)] truncate">
                            {item.errorMessage}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <StatusBadge status={item.status} />
                      </div>
                    </div>
                  ))}
                </ChunkyCard>
              </div>
            </ChunkyDialogBody>

            <ChunkyDialogFooter>
              {isProcessing ? (
                <ChunkyButton
                  type="button"
                  variant="danger"
                  data-testid="cancel-queue-btn"
                  onClick={cancelQueue}
                >
                  Cancel Queue
                </ChunkyButton>
              ) : (
                <ChunkyButton
                  type="button"
                  variant="primary"
                  data-testid="bulk-ingest-close-btn"
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
  );
}
