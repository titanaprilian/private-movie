import { useEffect, useState } from 'react';
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
import {
  ChunkyTabs,
  ChunkyTabsList,
  ChunkyTabsTrigger,
  ChunkyTabsContent,
} from '@/components/ui/chunky-tabs';
import { useBulkIngestSources } from './useBulkIngestSources';
import { useArchiveIngestSources } from './useArchiveIngestSources';
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

// ─── Shared Badge Components ──────────────────────────────────────────────────

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
      : status === 'ingesting' || status === 'uploading'
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

// ─── Shared Step 1 Storage Provider & Season selectors ───────────────────────

interface StorageProviderSelectProps {
  storageProviders: { id: string; name: string; isDefault: boolean }[];
  selectedStorageProviderId: string;
  setSelectedStorageProviderId: (id: string) => void;
  disabled?: boolean;
}

function StorageProviderSelect({
  storageProviders,
  selectedStorageProviderId,
  setSelectedStorageProviderId,
  disabled,
}: StorageProviderSelectProps) {
  if (storageProviders.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <label htmlFor="bulk-ingest-storage-provider" className={labelClassName}>
        Target S3 Storage Provider
      </label>
      <ChunkySelect
        value={selectedStorageProviderId}
        onValueChange={(val) => setSelectedStorageProviderId(val)}
        disabled={disabled}
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
  );
}

// ─── Archive Tab: Step 1 ──────────────────────────────────────────────────────

interface ArchiveStep1Props {
  archiveUrl: string;
  setArchiveUrl: (v: string) => void;
  archivePassword: string;
  setArchivePassword: (v: string) => void;
  archiveReferer: string;
  setArchiveReferer: (v: string) => void;
  defaultLabel: string;
  setDefaultLabel: (v: string) => void;
  selectedSeasonId: string;
  setSelectedSeasonId: (v: string) => void;
  seasonOptions: { id: string; label: string }[];
  storageProviders: { id: string; name: string; isDefault: boolean }[];
  selectedStorageProviderId: string;
  setSelectedStorageProviderId: (id: string) => void;
  previewPhase: 'idle' | 'downloading' | 'extracting' | 'done' | 'error';
  previewError: string | null;
  downloadProgress: { loaded: number; total?: number | null; percent?: number | null } | null;
  extractProgress: { currentFile: string; totalFiles?: number | null } | null;
  needsPassword?: boolean;
  jobErrorCode?: string | null;
  isSubmitting?: boolean;
  onStartPreview: () => void;
  onCancel: () => void;
  onCancelJob: () => void;
  onRetry: () => void;
}

function ArchiveStep1({
  archiveUrl,
  setArchiveUrl,
  archivePassword,
  setArchivePassword,
  archiveReferer,
  setArchiveReferer,
  defaultLabel,
  setDefaultLabel,
  selectedSeasonId,
  setSelectedSeasonId,
  seasonOptions,
  storageProviders,
  selectedStorageProviderId,
  setSelectedStorageProviderId,
  previewPhase,
  previewError,
  downloadProgress,
  extractProgress,
  needsPassword,
  jobErrorCode,
  isSubmitting,
  onStartPreview,
  onCancel,
  onCancelJob,
  onRetry,
}: ArchiveStep1Props) {
  const isPreviewing = previewPhase === 'downloading' || previewPhase === 'extracting';

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onStartPreview();
      }}
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      <ChunkyDialogBody className="space-y-4">
        {/* Archive URL */}
        <div className="space-y-1.5">
          <label htmlFor="archive-url" className={labelClassName}>
            Archive Download URL
          </label>
          <ChunkyInput
            id="archive-url"
            data-testid="archive-url-input"
            type="url"
            placeholder="https://example.com/season1.zip"
            value={archiveUrl}
            onChange={(e) => setArchiveUrl(e.target.value)}
            required
            disabled={isPreviewing}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Password */}
          <div className="space-y-1.5">
            <label htmlFor="archive-password" className={labelClassName}>
              Archive Password{' '}
              <span className="text-[var(--muted)] font-semibold">(Optional)</span>
            </label>
            <ChunkyInput
              id="archive-password"
              data-testid="archive-password-input"
              type="text"
              placeholder="Password (if encrypted)"
              value={archivePassword}
              onChange={(e) => setArchivePassword(e.target.value)}
              disabled={isPreviewing}
            />
          </div>

          {/* Referer */}
          <div className="space-y-1.5">
            <label htmlFor="archive-referer" className={labelClassName}>
              HTTP Referer{' '}
              <span className="text-[var(--muted)] font-semibold">(Optional)</span>
            </label>
            <ChunkyInput
              id="archive-referer"
              type="text"
              placeholder="https://referer-site.com"
              value={archiveReferer}
              onChange={(e) => setArchiveReferer(e.target.value)}
              disabled={isPreviewing}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Target Season */}
          <div className="space-y-1.5">
            <label htmlFor="archive-target-season" className={labelClassName}>
              Target Season
            </label>
            <ChunkySelect
              value={selectedSeasonId || (seasonOptions.length === 0 ? 'empty' : undefined)}
              onValueChange={(val) => {
                if (val !== 'empty') setSelectedSeasonId(val);
              }}
              disabled={seasonOptions.length === 0 || isPreviewing}
            >
              <ChunkySelectTrigger
                id="archive-target-season"
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

          {/* Default Label */}
          <div className="space-y-1.5">
            <label htmlFor="archive-default-label" className={labelClassName}>
              Default Source Label
            </label>
            <ChunkyInput
              id="archive-default-label"
              type="text"
              placeholder="S3 Video"
              value={defaultLabel}
              onChange={(e) => setDefaultLabel(e.target.value)}
              disabled={isPreviewing}
            />
          </div>
        </div>

        {/* Storage Provider */}
        <StorageProviderSelect
          storageProviders={storageProviders}
          selectedStorageProviderId={selectedStorageProviderId}
          setSelectedStorageProviderId={setSelectedStorageProviderId}
          disabled={isPreviewing}
        />

        {/* Progress indicator during preview */}
        {isPreviewing && (
          <ChunkyCard
            className="space-y-2 p-3"
            data-testid="archive-preview-progress"
          >
            {previewPhase === 'downloading' && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-sm font-bold text-[var(--muted)]">
                  <span>Downloading archive…</span>
                  <span data-testid="archive-download-bytes">
                    {downloadProgress ? formatBytes(downloadProgress.loaded) : formatBytes(0)}
                    {downloadProgress?.total
                      ? ` / ${formatBytes(downloadProgress.total)}`
                      : ''}
                    {downloadProgress?.percent != null
                      ? ` (${Math.round(downloadProgress.percent)}%)`
                      : ''}
                  </span>
                </div>
                <div
                  className="w-full rounded-full border-2 border-[var(--border)] bg-[var(--bg)] h-4 overflow-hidden p-0.5 shadow-[inset_0_2px_0_rgba(0,0,0,0.15)]"
                  role="progressbar"
                  aria-label="Download progress"
                  aria-valuenow={
                    downloadProgress?.percent != null
                      ? Math.round(downloadProgress.percent)
                      : 0
                  }
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="bg-[var(--blue)] h-full rounded-full border-r-2 border-[var(--blue-dark)] shadow-[0_2px_0_var(--blue-dark)] transition-all duration-300"
                    style={{
                      width:
                        downloadProgress?.percent != null
                          ? `${Math.round(downloadProgress.percent)}%`
                          : '5%',
                    }}
                  />
                </div>
              </div>
            )}
            {previewPhase === 'extracting' && (
              <div className="space-y-1.5" data-testid="archive-listing-progress">
                <div className="flex items-center gap-2 text-sm font-bold text-[var(--muted)]">
                  <span
                    className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--ink)]"
                    aria-hidden="true"
                  />
                  <span>Listing archive contents…</span>
                  {extractProgress?.totalFiles ? (
                    <span>{extractProgress.totalFiles} files</span>
                  ) : null}
                </div>
                <div className="text-xs font-bold text-[var(--muted)] truncate">
                  {extractProgress?.currentFile ?? 'Reading archive index…'}
                </div>
                <div
                  className="w-full rounded-full border-2 border-[var(--border)] bg-[var(--bg)] h-4 overflow-hidden p-0.5 shadow-[inset_0_2px_0_rgba(0,0,0,0.15)]"
                  role="progressbar"
                  aria-label="Extract progress"
                >
                  <div className="bg-[var(--green)] h-full rounded-full border-r-2 border-[var(--green-dark)] shadow-[0_2px_0_var(--green-dark)] animate-pulse" />
                </div>
              </div>
            )}
          </ChunkyCard>
        )}

        {/* Error state */}
        {previewPhase === 'error' && previewError && (
          <ChunkyCard
            className="p-3 border-[var(--red)] bg-[var(--red)]/10 space-y-2"
            data-testid="archive-preview-error"
          >
            <p className="text-sm font-bold text-[var(--red)]">{previewError}</p>
            {needsPassword && (
              <div className="space-y-2" data-testid="archive-password-retry">
                <p className="text-xs font-bold text-[var(--muted)]">
                  {jobErrorCode === 'PASSWORD_INCORRECT'
                    ? 'Incorrect password. Enter the correct archive password and retry.'
                    : 'This archive is password-protected. Enter the password and retry.'}
                </p>
                <div className="flex gap-2">
                  <ChunkyInput
                    type="text"
                    aria-label="Archive password for retry"
                    placeholder="Archive password"
                    value={archivePassword}
                    onChange={(e) => setArchivePassword(e.target.value)}
                  />
                  <ChunkyButton
                    type="button"
                    variant="primary"
                    data-testid="archive-retry-btn"
                    onClick={onRetry}
                    disabled={isSubmitting}
                  >
                    Retry
                  </ChunkyButton>
                </div>
              </div>
            )}
          </ChunkyCard>
        )}
      </ChunkyDialogBody>

      <ChunkyDialogFooter>
        {isPreviewing ? (
          <ChunkyButton
            type="button"
            variant="danger"
            data-testid="archive-cancel-job-btn"
            onClick={onCancelJob}
          >
            Cancel
          </ChunkyButton>
        ) : (
          <ChunkyButton
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </ChunkyButton>
        )}
        <ChunkyButton
          type="submit"
          variant="primary"
          data-testid="archive-preview-btn"
          disabled={isPreviewing || isSubmitting || !archiveUrl.trim()}
        >
          {isPreviewing ? 'Processing…' : 'Preview Archive'}
        </ChunkyButton>
      </ChunkyDialogFooter>
    </form>
  );
}

// ─── Archive Tab: Step 2 (Review) ─────────────────────────────────────────────

interface ArchiveReviewItem {
  fileId: string;
  filename: string;
  fileSizeBytes: number;
  detectedEpisodeNumber: number | null;
  matchedEpisodeId: string | null;
  quality: string | null;
  needsReview: boolean;
  isIgnored: boolean;
  label: string;
  commitStatus: string;
  hasSizeAnomaly?: boolean;
}

function isSampleFilename(filename: string): boolean {
  return /sample/i.test(filename);
}

interface ArchiveStep2Props {
  reviewItems: ArchiveReviewItem[];
  totalCount: number;
  matchedCount: number;
  needsReviewCount: number;
  selectedProviderName: string | null;
  updateReviewMapping: (index: number, episodeId: string | null) => void;
  updateReviewLabel: (index: number, label: string) => void;
  updateReviewQuality: (index: number, quality: string) => void;
  toggleReviewIgnore: (index: number) => void;
  seasons: SeasonGroupOption[];
  localEpisodes: LocalEpisodeItem[];
  onBack: () => void;
  onCommit: () => void;
  onCancelJob: () => void;
}

function ArchiveStep2({
  reviewItems,
  totalCount,
  matchedCount,
  needsReviewCount,
  selectedProviderName,
  updateReviewMapping,
  updateReviewLabel,
  updateReviewQuality,
  toggleReviewIgnore,
  seasons,
  localEpisodes,
  onBack,
  onCommit,
  onCancelJob,
}: ArchiveStep2Props) {
  return (
    <>
      <ChunkyDialogBody className="space-y-4">
        {/* Header counters */}
        <ChunkyCard className="flex items-center justify-between gap-2 flex-wrap p-3 text-sm font-bold text-[var(--muted)]">
          <div className="flex items-center gap-4 flex-wrap">
            <span>
              Total Files: <strong className="text-[var(--ink)]">{totalCount}</strong>
            </span>
            <span>
              Matched:{' '}
              <strong className="text-[var(--green)]">{matchedCount}</strong>
            </span>
            <span>
              Needs Review:{' '}
              <strong className="text-[var(--gold)]">{needsReviewCount}</strong>
            </span>
          </div>
          {selectedProviderName && (
            <ProviderBadge data-testid="archive-ingest-target-provider-badge">
              Target: {selectedProviderName}
            </ProviderBadge>
          )}
        </ChunkyCard>

        {/* Review items list */}
        <div className="grid grid-cols-1 gap-2 max-h-[380px] overflow-y-auto pr-1">
          {reviewItems.map((item, index) => (
            <ChunkyCard
              key={item.fileId}
              data-testid={`archive-review-row-${index}`}
              className={`p-3 flex flex-col gap-2.5 text-sm ${
                item.isIgnored ? 'opacity-50' : ''
              }`}
            >
              {/* Top line: Filename & Status Badges */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap min-w-0 flex-1">
                  <span
                    className="font-bold text-[var(--ink)] truncate max-w-sm"
                    title={item.filename}
                  >
                    {item.filename}
                  </span>
                  {item.detectedEpisodeNumber !== null && (
                    <PillBadge>Detected Ep #{item.detectedEpisodeNumber}</PillBadge>
                  )}
                  {item.needsReview && !item.isIgnored && (
                    <WarningBadge>Needs Review</WarningBadge>
                  )}
                  {isSampleFilename(item.filename) && (
                    <PillBadge>Sample</PillBadge>
                  )}
                  {item.hasSizeAnomaly && !item.isIgnored && (
                    <WarningBadge>Size anomaly — differs from siblings</WarningBadge>
                  )}
                  {item.isIgnored && <PillBadge>Ignored</PillBadge>}
                  {item.fileSizeBytes > 0 && (
                    <PillBadge>{formatBytes(item.fileSizeBytes)}</PillBadge>
                  )}
                </div>

                <ChunkyButton
                  type="button"
                  variant={item.isIgnored ? 'outline' : 'blue'}
                  size="sm"
                  onClick={() => toggleReviewIgnore(index)}
                  className="shrink-0"
                >
                  {item.isIgnored ? 'Include' : 'Ignore'}
                </ChunkyButton>
              </div>

              {/* Bottom line: Target Episode + Label + Quality */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center">
                <div>
                  <TargetEpisodeCombobox
                    scrapedTitle={item.filename}
                    value={item.matchedEpisodeId}
                    disabled={item.isIgnored}
                    onValueChange={(newId) => updateReviewMapping(index, newId)}
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
                    onChange={(e) => updateReviewLabel(index, e.target.value)}
                    disabled={item.isIgnored}
                  />
                </div>

                <div>
                  <ChunkyInput
                    type="text"
                    aria-label={`Quality for ${item.filename}`}
                    placeholder="Quality (e.g. 1080p)"
                    value={item.quality || ''}
                    onChange={(e) => updateReviewQuality(index, e.target.value)}
                    disabled={item.isIgnored}
                  />
                </div>
              </div>
            </ChunkyCard>
          ))}
        </div>
      </ChunkyDialogBody>

      <ChunkyDialogFooter>
        <ChunkyButton type="button" variant="outline" onClick={onBack}>
          Back
        </ChunkyButton>
        <ChunkyButton
          type="button"
          variant="danger"
          data-testid="archive-cancel-job-btn"
          onClick={onCancelJob}
        >
          Cancel
        </ChunkyButton>
        <ChunkyButton
          type="button"
          variant="primary"
          data-testid="archive-commit-btn"
          onClick={onCommit}
          disabled={matchedCount === 0}
        >
          Commit to S3 ({matchedCount})
        </ChunkyButton>
      </ChunkyDialogFooter>
    </>
  );
}

// ─── Archive Tab: Step 3 (Progress) ──────────────────────────────────────────

interface ArchiveReviewItemWithProgress extends ArchiveReviewItem {
  commitProgress?: { percent: number; loaded: number; total?: number | null };
  commitError?: string;
}

interface ArchiveStep3Props {
  reviewItems: ArchiveReviewItemWithProgress[];
  totalCount: number;
  commitCompletedCount: number;
  progressPercentage: number;
  activeCommitItem: ArchiveReviewItemWithProgress | null;
  uploadView?: {
    currentIndex: number;
    totalFiles: number;
    activeFilename: string | null;
    percent: number;
    loaded: number;
    total: number | null;
  } | null;
  selectedProviderName: string | null;
  isCommitting: boolean;
  onCancel: () => void;
  onClose: () => void;
}

function ArchiveStep3({
  reviewItems,
  totalCount,
  commitCompletedCount,
  progressPercentage,
  activeCommitItem,
  uploadView,
  selectedProviderName,
  isCommitting,
  onCancel,
  onClose,
}: ArchiveStep3Props) {
  const displayIndex = uploadView?.currentIndex ?? commitCompletedCount;
  const displayTotal = uploadView?.totalFiles ?? totalCount;
  const displayPercent = uploadView?.percent ?? progressPercentage;
  const displayFilename = uploadView?.activeFilename ?? activeCommitItem?.filename ?? null;
  const displayLoaded = uploadView?.loaded ?? activeCommitItem?.commitProgress?.loaded ?? null;
  const displayTotalBytes = uploadView?.total ?? activeCommitItem?.commitProgress?.total ?? null;
  return (
    <>
      <ChunkyDialogBody className="space-y-4">
        <ChunkyCard className="space-y-2 p-3" data-testid="archive-upload-progress">
          <div className="flex items-center justify-between font-sans text-sm font-bold text-[var(--muted)]">
            <span data-testid="archive-upload-counter">
              Uploading file{' '}
              <strong className="text-[var(--ink)]">{displayIndex}</strong> of{' '}
              {displayTotal} ({displayPercent}%)
            </span>
            <span className="font-extrabold text-[var(--green)]">
              {displayPercent}%
            </span>
          </div>
          <div
            className="w-full rounded-full border-2 border-[var(--border)] bg-[var(--bg)] h-5 overflow-hidden p-1 shadow-[inset_0_2px_0_rgba(0,0,0,0.15)]"
            role="progressbar"
            aria-label="Upload progress"
            aria-valuenow={displayPercent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="bg-[var(--green)] h-full rounded-full border-r-2 border-[var(--green-dark)] shadow-[0_2px_0_var(--green-dark)] transition-all duration-300"
              style={{ width: `${displayPercent}%` }}
            />
          </div>

          <ChunkyCard className="flex items-center justify-between gap-2 flex-wrap p-2 font-sans text-xs font-bold text-[var(--muted)]">
            {selectedProviderName && (
              <span data-testid="archive-commit-progress-provider">
                Target Provider:{' '}
                <strong className="text-[var(--ink)]">{selectedProviderName}</strong>
              </span>
            )}
            {displayLoaded !== null && (
              <span className="ml-auto" data-testid="archive-upload-bytes">
                {displayPercent}% -{' '}
                {formatBytes(displayLoaded)}
                {displayTotalBytes
                  ? ` / ${formatBytes(displayTotalBytes)}`
                  : ''}
              </span>
            )}
          </ChunkyCard>

          {displayFilename && (
            <div
              className="font-sans text-xs font-bold text-[var(--muted)] truncate max-w-md"
              data-testid="archive-upload-active-file"
            >
              Uploading: {displayFilename}
            </div>
          )}
        </ChunkyCard>

        {/* Status Log */}
        <div className="space-y-2">
          <span className="font-sans text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">
            Upload Queue Log
          </span>
          <ChunkyCard
            className="p-3 max-h-[300px] overflow-y-auto space-y-2 font-sans text-sm font-bold"
            data-testid="archive-commit-logs"
          >
            {reviewItems.map((item) => (
              <div
                key={item.fileId}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-1.5 border-b-2 border-[var(--border)] last:border-0"
              >
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="font-bold text-[var(--ink)] truncate">
                    {item.filename}
                  </span>
                  {item.commitError && (
                    <span className="text-xs font-bold text-[var(--red)] truncate">
                      {item.commitError}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <StatusBadge
                    status={
                      item.commitStatus === 'uploading'
                        ? 'ingesting'
                        : item.commitStatus
                    }
                  />
                </div>
              </div>
            ))}
          </ChunkyCard>
        </div>
      </ChunkyDialogBody>

      <ChunkyDialogFooter>
        {isCommitting ? (
          <ChunkyButton
            type="button"
            variant="danger"
            data-testid="archive-cancel-commit-btn"
            onClick={onCancel}
          >
            Cancel Upload
          </ChunkyButton>
        ) : (
          <ChunkyButton
            type="button"
            variant="primary"
            data-testid="archive-commit-close-btn"
            onClick={onClose}
          >
            Close
          </ChunkyButton>
        )}
      </ChunkyDialogFooter>
    </>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

export function BulkIngestModal({
  open,
  onOpenChange,
  seriesId,
  localEpisodes = [],
  seasons = [],
  onSuccess,
}: BulkIngestModalProps) {
  // ─── URL ingest mode ────────────────────────────────────────────────────────
  const {
    step: urlStep,
    setStep: setUrlStep,
    rawUrlsText,
    setRawUrlsText,
    defaultLabel: urlDefaultLabel,
    setDefaultLabel: setUrlDefaultLabel,
    defaultQuality,
    setDefaultQuality,
    sharedReferer,
    setSharedReferer,
    selectedSeasonId: urlSelectedSeasonId,
    setSelectedSeasonId: setUrlSelectedSeasonId,
    seasonOptions,
    items,
    parseUrls,
    updateMapping,
    updateLabel,
    updateQuality,
    toggleIgnore,
    totalCount: urlTotalCount,
    matchedCount: urlMatchedCount,
    needsReviewCount: urlNeedsReviewCount,
    startIngestQueue,
    cancelQueue,
    isProcessing,
    completedCount,
    progressPercentage: urlProgressPercentage,
    activeItem,
    storageProviders,
    selectedStorageProviderId: urlStorageProviderId,
    setSelectedStorageProviderId: setUrlStorageProviderId,
    reset: urlReset,
  } = useBulkIngestSources({ seriesId, seasons, localEpisodes, onSuccess });

  const urlSelectedProviderName =
    storageProviders.find((p) => p.id === urlStorageProviderId)?.name ?? null;

  // ─── Archive ingest mode ────────────────────────────────────────────────────
  const archive = useArchiveIngestSources({ seriesId, seasons, localEpisodes, onSuccess });
  const archiveReset = archive.reset;

  // ─── Tab state ──────────────────────────────────────────────────────────────
  type IngestTab = 'archive' | 'url';
  const [activeTab, setActiveTab] = useState<IngestTab>('archive');

  const isProcessingAny = isProcessing || archive.isCommitting || archive.isPolling || archive.previewPhase === 'downloading' || archive.previewPhase === 'extracting';

  // ─── Reset on close ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) {
      urlReset();
      void archiveReset();
      setActiveTab('archive');
    }
  }, [open, urlReset, archiveReset]);

  const handleOpenChange = (openState: boolean) => {
    if (isProcessingAny) return;
    onOpenChange(openState);
  };

  // ─── Active step for description ────────────────────────────────────────────
  const effectiveStep = activeTab === 'archive' ? archive.step : urlStep;

  const description =
    effectiveStep === 1
      ? activeTab === 'archive'
        ? 'Enter a ZIP or RAR archive URL to preview, review, and ingest episode files.'
        : 'Paste multi-line video stream URLs for season ingestion to Backblaze B2/S3 storage.'
      : effectiveStep === 2
        ? 'Review matched episodes, manually assign unmatched files, and adjust labels/qualities.'
        : 'Sequential ingestion progress and transfer status log.';

  // ─── URL mode step 1 form submit ────────────────────────────────────────────
  const handleUrlStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    parseUrls();
  };

  return (
    <ChunkyDialog open={open} onOpenChange={handleOpenChange}>
      <ChunkyDialogContent
        className="max-w-3xl"
        onPointerDownOutside={(e) => {
          if (isProcessingAny) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (isProcessingAny) e.preventDefault();
        }}
      >
        <ChunkyDialogHeader>
          <ChunkyDialogTitle>Bulk Ingest Sources</ChunkyDialogTitle>
          <ChunkyDialogDescription>{description}</ChunkyDialogDescription>
        </ChunkyDialogHeader>

        {/* ─── ARCHIVE MODE ──────────────────────────────────────────── */}
        {activeTab === 'archive' && archive.step === 1 && (
          <>
            {/* Tab Selector (only shown in Step 1) */}
            <div className="px-6 pt-2 pb-0">
              <ChunkyTabs
                value={activeTab}
                onValueChange={(v) => setActiveTab(v as IngestTab)}
              >
                <ChunkyTabsList>
                  <ChunkyTabsTrigger value="archive" data-testid="tab-archive">
                    ZIP / RAR Archive
                  </ChunkyTabsTrigger>
                  <ChunkyTabsTrigger value="url" data-testid="tab-url">
                    Multi-line Video URLs
                  </ChunkyTabsTrigger>
                </ChunkyTabsList>
                <ChunkyTabsContent value="archive" />
                <ChunkyTabsContent value="url" />
              </ChunkyTabs>
            </div>
            <ArchiveStep1
              archiveUrl={archive.archiveUrl}
              setArchiveUrl={archive.setArchiveUrl}
              archivePassword={archive.archivePassword}
              setArchivePassword={archive.setArchivePassword}
              archiveReferer={archive.archiveReferer}
              setArchiveReferer={archive.setArchiveReferer}
              defaultLabel={archive.defaultLabel}
              setDefaultLabel={archive.setDefaultLabel}
              selectedSeasonId={archive.selectedSeasonId}
              setSelectedSeasonId={archive.setSelectedSeasonId}
              seasonOptions={archive.seasonOptions}
              storageProviders={archive.storageProviders}
              selectedStorageProviderId={archive.selectedStorageProviderId}
              setSelectedStorageProviderId={archive.setSelectedStorageProviderId}
              previewPhase={archive.previewPhase}
              previewError={archive.previewError}
              downloadProgress={archive.downloadProgress}
              extractProgress={archive.extractProgress}
              needsPassword={archive.needsPassword}
              jobErrorCode={archive.jobErrorCode}
              isSubmitting={archive.isSubmitting}
              onStartPreview={() => void archive.startJob()}
              onCancel={() => onOpenChange(false)}
              onCancelJob={() => void archive.cancelJob()}
              onRetry={() => void archive.retryWithPassword()}
            />
          </>
        )}

        {activeTab === 'archive' && archive.step === 2 && (
          <ArchiveStep2
            reviewItems={archive.reviewItems}
            totalCount={archive.totalCount}
            matchedCount={archive.matchedCount}
            needsReviewCount={archive.needsReviewCount}
            selectedProviderName={archive.selectedProviderName}
            updateReviewMapping={archive.updateReviewMapping}
            updateReviewLabel={archive.updateReviewLabel}
            updateReviewQuality={archive.updateReviewQuality}
            toggleReviewIgnore={archive.toggleReviewIgnore}
            seasons={seasons}
            localEpisodes={localEpisodes}
            onBack={() => archive.setStep(1)}
            onCommit={() => void archive.confirmSelection()}
            onCancelJob={() => void archive.cancelJob()}
          />
        )}

        {activeTab === 'archive' && archive.step === 3 && (
          <ArchiveStep3
            reviewItems={archive.reviewItems}
            totalCount={archive.totalCount}
            commitCompletedCount={archive.commitCompletedCount}
            progressPercentage={archive.progressPercentage}
            activeCommitItem={archive.activeCommitItem}
            uploadView={archive.uploadView}
            selectedProviderName={archive.selectedProviderName}
            isCommitting={archive.isCommitting}
            onCancel={() => void archive.cancelJob()}
            onClose={() => {
              onOpenChange(false);
              archive.reset();
            }}
          />
        )}

        {/* ─── URL MODE ──────────────────────────────────────────────── */}
        {activeTab === 'url' && urlStep === 1 && (
          <>
            {/* Tab Selector (only shown in Step 1) */}
            <div className="px-6 pt-2 pb-0">
              <ChunkyTabs
                value={activeTab}
                onValueChange={(v) => setActiveTab(v as IngestTab)}
              >
                <ChunkyTabsList>
                  <ChunkyTabsTrigger value="archive" data-testid="tab-archive">
                    ZIP / RAR Archive
                  </ChunkyTabsTrigger>
                  <ChunkyTabsTrigger value="url" data-testid="tab-url">
                    Multi-line Video URLs
                  </ChunkyTabsTrigger>
                </ChunkyTabsList>
                <ChunkyTabsContent value="archive" />
                <ChunkyTabsContent value="url" />
              </ChunkyTabs>
            </div>

            <form
              onSubmit={handleUrlStep1Submit}
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
                      value={urlSelectedSeasonId || (seasonOptions.length === 0 ? 'empty' : undefined)}
                      onValueChange={(val) => {
                        if (val !== 'empty') {
                          setUrlSelectedSeasonId(val);
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
                      value={urlStorageProviderId}
                      onValueChange={(val) => setUrlStorageProviderId(val)}
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
                      value={urlDefaultLabel}
                      onChange={(e) => setUrlDefaultLabel(e.target.value)}
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
          </>
        )}

        {/* STEP 2: Review & Manual Episode Combobox Matching (URL mode) */}
        {activeTab === 'url' && urlStep === 2 && (
          <>
            <ChunkyDialogBody className="space-y-4">
              {/* Header counters */}
              <ChunkyCard className="flex items-center justify-between gap-2 flex-wrap p-3 text-sm font-bold text-[var(--muted)]">
                <div className="flex items-center gap-4 flex-wrap">
                  <span>
                    Total URLs: <strong className="text-[var(--ink)]">{urlTotalCount}</strong>
                  </span>
                  <span>
                    Matched:{' '}
                    <strong className="text-[var(--green)]">
                      {urlMatchedCount}
                    </strong>
                  </span>
                  <span>
                    Needs Review:{' '}
                    <strong className="text-[var(--gold)]">
                      {urlNeedsReviewCount}
                    </strong>
                  </span>
                </div>
                {urlSelectedProviderName && (
                  <ProviderBadge data-testid="bulk-ingest-target-provider-badge">
                    Target: {urlSelectedProviderName}
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
                onClick={() => setUrlStep(1)}
              >
                Back
              </ChunkyButton>
              <ChunkyButton
                type="button"
                variant="primary"
                data-testid="bulk-ingest-start-btn"
                onClick={() => void startIngestQueue()}
              >
                Start Bulk Ingestion ({urlMatchedCount})
              </ChunkyButton>
            </ChunkyDialogFooter>
          </>
        )}

        {/* STEP 3: Sequential Processing Queue (URL mode) */}
        {activeTab === 'url' && urlStep === 3 && (
          <>
            <ChunkyDialogBody className="space-y-4">
              {/* Progress Bar & Counter */}
              <ChunkyCard className="space-y-2 p-3">
                <div className="flex items-center justify-between font-sans text-sm font-bold text-[var(--muted)]">
                  <span>
                    Processing: Item <strong className="text-[var(--ink)]">{completedCount}</strong> of{' '}
                    {urlTotalCount} ({urlProgressPercentage}%)
                  </span>
                  <span className="font-extrabold text-[var(--green)]">
                    {urlProgressPercentage}%
                  </span>
                </div>
                <div
                  className="w-full rounded-full border-2 border-[var(--border)] bg-[var(--bg)] h-5 overflow-hidden p-1 shadow-[inset_0_2px_0_rgba(0,0,0,0.15)]"
                  role="progressbar"
                  aria-valuenow={urlProgressPercentage}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="bg-[var(--green)] h-full rounded-full border-r-2 border-[var(--green-dark)] shadow-[0_2px_0_var(--green-dark)] transition-all duration-300"
                    style={{ width: `${urlProgressPercentage}%` }}
                  />
                </div>

                {/* Target Provider & Active Transfer Details */}
                <ChunkyCard className="flex items-center justify-between gap-2 flex-wrap p-2 font-sans text-xs font-bold text-[var(--muted)]">
                  {urlSelectedProviderName && (
                    <span data-testid="bulk-ingest-progress-provider">
                      Target Provider:{' '}
                      <strong className="text-[var(--ink)]">
                        {urlSelectedProviderName}
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
                    urlReset();
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

