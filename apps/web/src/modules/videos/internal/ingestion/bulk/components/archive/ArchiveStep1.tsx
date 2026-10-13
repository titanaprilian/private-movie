import {
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
import { ChunkyCard } from '@/components/ui/chunky-card';
import {
  StorageProviderSelect,
  labelClassName,
} from '../../../components/StorageProviderSelect';
import { IngestionProgressBar } from '../../../components/IngestionProgressBar';
import { formatBytes } from '../../utils/parseIngestUrl';

export interface ArchiveStep1Props {
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

export function ArchiveStep1({
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
                <IngestionProgressBar
                  value={downloadProgress?.percent ?? 0}
                  ariaLabel="Download progress"
                  tone="blue"
                  size="sm"
                />
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
                <IngestionProgressBar
                  value={null}
                  ariaLabel="Extract progress"
                  tone="green"
                  size="sm"
                />
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
