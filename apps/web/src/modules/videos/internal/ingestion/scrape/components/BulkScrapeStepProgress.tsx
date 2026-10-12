import { ChunkyCard } from '@/components/ui/chunky-card';
import type { ProcessingLogItem } from '../../types';
import { StatusBadge } from '../../components/IngestionBadges';
import { IngestionProgressBar } from '../../components/IngestionProgressBar';

export interface BulkScrapeStepProgressProps {
  completedCount: number;
  totalCount: number;
  progress: number;
  processingLogs: ProcessingLogItem[];
}

export function BulkScrapeStepProgress({
  completedCount,
  totalCount,
  progress,
  processingLogs,
}: BulkScrapeStepProgressProps) {
  return (
    <div className="space-y-4">
      <ChunkyCard className="space-y-2 p-3">
        <div className="flex items-center justify-between font-sans text-sm font-bold text-[var(--muted)]">
          <span>
            Processing: <strong className="text-[var(--ink)]">{completedCount}</strong> /{' '}
            {totalCount} items
          </span>
          <span className="font-extrabold text-[var(--green)]">{progress}%</span>
        </div>
        <IngestionProgressBar value={progress} ariaLabel="Scrape progress" />
      </ChunkyCard>

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
    </div>
  );
}
