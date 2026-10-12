import {
  ChunkyDialogBody,
  ChunkyDialogFooter,
} from '@/components/ui/chunky-dialog';
import { ChunkyButton } from '@/components/ui/chunky-button';
import { ChunkyCard } from '@/components/ui/chunky-card';
import { IngestionProgressBar } from '../../../components/IngestionProgressBar';
import { StatusBadge } from '../../../components/IngestionBadges';
import { formatBytes } from '../../../utils/parseIngestUrl';
import type { ArchiveReviewItem } from '../../../types';

export interface ArchiveStep3Props {
  reviewItems: ArchiveReviewItem[];
  totalCount: number;
  commitCompletedCount: number;
  progressPercentage: number;
  activeCommitItem: ArchiveReviewItem | null;
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

export function ArchiveStep3({
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
  const displayTotal = uploadView?.totalFiles ?? totalCount;
  const displayIndex =
    displayTotal > 0
      ? Math.min(commitCompletedCount + 1, displayTotal)
      : (uploadView?.currentIndex ?? commitCompletedCount);
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
          <IngestionProgressBar
            value={displayPercent}
            ariaLabel="Upload progress"
          />

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
