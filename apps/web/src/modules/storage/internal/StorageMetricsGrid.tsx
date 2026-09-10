import { formatBytes, type StorageMetrics } from './api';
import { Button } from '@/components/ui/button';
import { HardDrive, Files, Link as LinkIcon, AlertTriangle, Settings } from 'lucide-react';

export interface StorageMetricsGridProps {
  metrics?: StorageMetrics | null;
  isLoading?: boolean;
  onOpenLimitDialog: () => void;
}

export function StorageMetricsGrid({
  metrics,
  isLoading = false,
  onOpenLimitDialog,
}: StorageMetricsGridProps) {
  if (isLoading || !metrics) {
    return (
      <div className="space-y-4" data-testid="storage-metrics-skeleton">
        <div className="bg-card border border-c rounded p-4 animate-pulse">
          <div className="h-4 bg-muted/20 rounded w-1/4 mb-3" />
          <div className="h-3 bg-muted/20 rounded w-full mb-2" />
          <div className="h-3 bg-muted/20 rounded w-1/3" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-card border border-c rounded p-4 animate-pulse">
              <div className="h-3 bg-muted/20 rounded w-1/2 mb-2" />
              <div className="h-6 bg-muted/20 rounded w-2/3" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const {
    totalSizeBytes,
    limitSizeBytes,
    percentUsed,
    totalFiles,
    linkedFiles,
    orphanedFiles,
  } = metrics;

  const usedGb = (totalSizeBytes / (1024 * 1024 * 1024)).toFixed(1);
  const limitGb = (limitSizeBytes / (1024 * 1024 * 1024)).toFixed(0);

  // Dynamic threshold color shifts: neutral/blue -> amber at >= 80% -> red at >= 90%
  let capacityBarColor = 'bg-primary';
  let badgeColor = 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400';
  if (percentUsed >= 90) {
    capacityBarColor = 'bg-red-500';
    badgeColor = 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
  } else if (percentUsed >= 80) {
    capacityBarColor = 'bg-amber-500';
    badgeColor = 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
  }

  return (
    <div className="space-y-4" data-testid="storage-metrics-grid">
      {/* Capacity Bar Card */}
      <div className="bg-card border border-c rounded p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-sm text-fg">Storage Capacity</h3>
              <span className={`text-[11px] mono font-semibold px-2 py-0.5 rounded ${badgeColor}`} data-testid="threshold-badge">
                {percentUsed.toFixed(1)}% Used
              </span>
            </div>
            <p className="text-xs text-muted mt-0.5">
              {formatBytes(totalSizeBytes)} used of {limitGb} GB limit
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenLimitDialog}
            className="text-xs h-8 gap-1.5 self-start sm:self-auto"
            data-testid="adjust-limit-btn"
          >
            <Settings className="w-3.5 h-3.5" />
            Adjust Limit
          </Button>
        </div>

        {/* Visual Storage Capacity Bar */}
        <div className="relative w-full h-3 bg-card border border-c rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${capacityBarColor}`}
            style={{ width: `${Math.min(100, Math.max(0, percentUsed))}%` }}
            data-testid="capacity-progress-bar"
          />
        </div>
      </div>

      {/* Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Storage Used Card */}
        <div className="bg-card border border-c rounded p-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-muted uppercase tracking-wide mono">Storage Used</div>
            <div className="text-xl font-semibold mono text-fg mt-1" data-testid="metric-total-size">
              {formatBytes(totalSizeBytes)}
            </div>
            <div className="text-[11px] text-muted mt-0.5 mono">{usedGb} GB</div>
          </div>
          <div className="w-9 h-9 rounded bg-indigo-50 dark:bg-indigo-950/40 text-primary border border-indigo-200 dark:border-indigo-800 flex items-center justify-center">
            <HardDrive className="w-4 h-4" />
          </div>
        </div>

        {/* Total Files Card */}
        <div className="bg-card border border-c rounded p-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-muted uppercase tracking-wide mono">Total Files</div>
            <div className="text-xl font-semibold mono text-fg mt-1" data-testid="metric-total-files">
              {totalFiles}
            </div>
            <div className="text-[11px] text-muted mt-0.5">Objects in bucket</div>
          </div>
          <div className="w-9 h-9 rounded bg-zinc-100 dark:bg-zinc-800 text-fg border border-c flex items-center justify-center">
            <Files className="w-4 h-4" />
          </div>
        </div>

        {/* Linked Files Card */}
        <div className="bg-card border border-c rounded p-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-muted uppercase tracking-wide mono">Linked Files</div>
            <div className="text-xl font-semibold mono text-fg mt-1" data-testid="metric-linked-files">
              {linkedFiles}
            </div>
            <div className="text-[11px] text-green-600 dark:text-green-400 mt-0.5">Associated to episodes</div>
          </div>
          <div className="w-9 h-9 rounded bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800 flex items-center justify-center">
            <LinkIcon className="w-4 h-4" />
          </div>
        </div>

        {/* Orphaned Files Card */}
        <div className="bg-card border border-c rounded p-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-muted uppercase tracking-wide mono">Orphaned Files</div>
            <div className="text-xl font-semibold mono text-fg mt-1" data-testid="metric-orphaned-files">
              {orphanedFiles}
            </div>
            <div className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">Unlinked S3 objects</div>
          </div>
          <div className="w-9 h-9 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800 flex items-center justify-center">
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>
      </div>
    </div>
  );
}
