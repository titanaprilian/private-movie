import {
  ChunkyDialogBody,
  ChunkyDialogFooter,
} from '@/components/ui/chunky-dialog';
import { ChunkyButton } from '@/components/ui/chunky-button';
import { ChunkyCard } from '@/components/ui/chunky-card';
import { IngestionProgressBar } from '../../../components/IngestionProgressBar';
import { StatusBadge } from '../../../components/IngestionBadges';
import { formatBytes } from '../../utils/parseIngestUrl';
import type { BulkIngestItem } from '../../../types';

export interface UrlStep3Props {
  items: BulkIngestItem[];
  urlTotalCount: number;
  urlProgressPercentage: number;
  completedCount: number;
  activeItem: BulkIngestItem | null;
  urlSelectedProviderName: string | null;
  isProcessing: boolean;
  onCancelQueue: () => void;
  onClose: () => void;
}

export function UrlStep3({
  items,
  urlTotalCount,
  urlProgressPercentage,
  completedCount,
  activeItem,
  urlSelectedProviderName,
  isProcessing,
  onCancelQueue,
  onClose,
}: UrlStep3Props) {
  return (
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
          <IngestionProgressBar
            value={urlProgressPercentage}
            ariaLabel="Ingest progress"
          />

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
            onClick={onCancelQueue}
          >
            Cancel Queue
          </ChunkyButton>
        ) : (
          <ChunkyButton
            type="button"
            variant="primary"
            data-testid="bulk-ingest-close-btn"
            onClick={onClose}
          >
            Close
          </ChunkyButton>
        )}
      </ChunkyDialogFooter>
    </>
  );
}
