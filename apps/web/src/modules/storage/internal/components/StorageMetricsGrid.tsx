import { formatBytes, formatDualBytes, type StorageMetrics } from '../api';
import { ChunkyButton } from '@/components/ui/chunky-button';
import { ChunkyCard } from '@/components/ui/chunky-card';
import { ChunkySkeleton } from '@/components/ui/chunky-skeleton';
import {
  HardDrive,
  Files,
  Link as LinkIcon,
  AlertTriangle,
  Settings,
} from 'lucide-react';

export interface StorageMetricsGridProps {
  metrics?: StorageMetrics | null;
  isLoading?: boolean;
  onOpenLimitDialog: () => void;
  providerName?: string;
}

export function StorageMetricsGrid({
  metrics,
  isLoading = false,
  onOpenLimitDialog,
  providerName,
}: StorageMetricsGridProps) {
  if (isLoading || !metrics) {
    return (
      <div className="space-y-4" data-testid="storage-metrics-skeleton">
        <ChunkySkeleton className="p-4">
          <div className="h-4 bg-[var(--surface-raised)] rounded-xl w-1/4 mb-3" />
          <div className="h-3 bg-[var(--surface-raised)] rounded-xl w-full mb-2" />
          <div className="h-3 bg-[var(--surface-raised)] rounded-xl w-1/3" />
        </ChunkySkeleton>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <ChunkySkeleton key={i} className="p-4">
              <div className="h-3 bg-[var(--surface-raised)] rounded-xl w-1/2 mb-2" />
              <div className="h-6 bg-[var(--surface-raised)] rounded-xl w-2/3" />
            </ChunkySkeleton>
          ))}
        </div>
      </div>
    );
  }

  const {
    totalBytes = 0,
    limitBytes = 0,
    percentUsed = 0,
    totalCount = 0,
    linkedCount = 0,
    orphanCount = 0,
  } = metrics;

  const limitGb = (limitBytes / (1024 * 1024 * 1024)).toFixed(0);
  const decimalUsed = formatBytes(totalBytes, {
    decimals: 2,
    standard: 'decimal',
  });
  const binaryUsed = formatBytes(totalBytes, {
    decimals: 2,
    standard: 'binary',
  });

  // Dynamic threshold color shifts: green -> gold at >= 80% -> red at >= 90%
  let capacityBarFill = 'bg-[var(--green)] border-[var(--green-dark)]';
  let badgeColor =
    'bg-[var(--blue-soft)] text-[var(--blue)] border-2 border-[var(--blue)]/30';
  if (percentUsed >= 90) {
    capacityBarFill = 'bg-[var(--red)] border-[var(--red-dark)]';
    badgeColor =
      'bg-red-100 text-red-700 border-2 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800';
  } else if (percentUsed >= 80) {
    capacityBarFill = 'bg-[var(--gold)] border-[var(--gold-dark)]';
    badgeColor =
      'bg-amber-100 text-amber-700 border-2 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800';
  }

  return (
    <div className="space-y-4" data-testid="storage-metrics-grid">
      {/* Capacity Bar Card */}
      <ChunkyCard interactive className="p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-display font-bold text-base text-[var(--ink)]">
                Storage Capacity
              </h3>
              {providerName && (
                <span
                  data-testid="provider-scope-badge"
                  className="text-[10px] font-sans font-extrabold uppercase tracking-wider text-[var(--muted)] px-1.5 py-0.5 rounded-xl border-2 border-[var(--border)] bg-[var(--surface-raised)]"
                >
                  {providerName}
                </span>
              )}
              <span
                className={`text-[11px] font-sans font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-xl ${badgeColor}`}
                data-testid="threshold-badge"
              >
                {percentUsed.toFixed(1)}% Used
              </span>
            </div>
            <p
              className="font-sans text-xs font-semibold text-[var(--muted)] mt-0.5"
              data-testid="capacity-details"
            >
              {formatDualBytes(totalBytes)} used of {limitGb} GB limit
            </p>
          </div>
          <ChunkyButton
            variant="outline"
            size="sm"
            onClick={onOpenLimitDialog}
            className="self-start sm:self-auto"
            data-testid="adjust-limit-btn"
          >
            <Settings className="w-4 h-4" />
            Adjust Limit
          </ChunkyButton>
        </div>

        {/* Tactile 3D chunky capacity progress bar */}
        <div className="relative w-full h-5 rounded-2xl border-2 border-b-4 border-[var(--border)] bg-[var(--surface-raised)] overflow-hidden">
          <div
            className={`h-full rounded-r-lg border-r-2 transition-all duration-300 ${capacityBarFill}`}
            style={{ width: `${Math.min(100, Math.max(0, percentUsed))}%` }}
            data-testid="capacity-progress-bar"
          />
        </div>
      </ChunkyCard>

      {/* Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Storage Used Card */}
        <ChunkyCard
          interactive
          className="p-4 flex items-center justify-between"
        >
          <div>
            <div className="font-sans text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">
              Storage Used
            </div>
            <div
              className="font-sans text-xl font-extrabold text-[var(--ink)] mt-1"
              data-testid="metric-total-size"
            >
              {binaryUsed}
            </div>
            <div
              className="font-sans text-[11px] font-bold text-[var(--muted)] mt-0.5"
              data-testid="metric-total-size-decimal"
            >
              {decimalUsed} decimal / provider
            </div>
          </div>
          <div className="w-11 h-11 rounded-2xl border-2 border-b-4 border-[var(--blue-dark)] bg-[var(--blue-soft)] text-[var(--blue)] flex items-center justify-center shrink-0">
            <HardDrive className="w-5 h-5" />
          </div>
        </ChunkyCard>

        {/* Total Files Card */}
        <ChunkyCard
          interactive
          className="p-4 flex items-center justify-between"
        >
          <div>
            <div className="font-sans text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">
              Total Files
            </div>
            <div
              className="font-sans text-xl font-extrabold text-[var(--ink)] mt-1"
              data-testid="metric-total-files"
            >
              {totalCount}
            </div>
            <div className="font-sans text-[11px] font-bold text-[var(--muted)] mt-0.5">
              Objects in bucket
            </div>
          </div>
          <div className="w-11 h-11 rounded-2xl border-2 border-b-4 border-[var(--border-strong)] bg-[var(--surface-raised)] text-[var(--ink)] flex items-center justify-center shrink-0">
            <Files className="w-5 h-5" />
          </div>
        </ChunkyCard>

        {/* Linked Files Card */}
        <ChunkyCard
          interactive
          className="p-4 flex items-center justify-between"
        >
          <div>
            <div className="font-sans text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">
              Linked Files
            </div>
            <div
              className="font-sans text-xl font-extrabold text-[var(--ink)] mt-1"
              data-testid="metric-linked-files"
            >
              {linkedCount}
            </div>
            <div className="font-sans text-[11px] font-bold text-[var(--green)] mt-0.5">
              Associated to episodes
            </div>
          </div>
          <div className="w-11 h-11 rounded-2xl border-2 border-b-4 border-[var(--green-dark)] bg-[var(--green-soft)] text-[var(--green)] flex items-center justify-center shrink-0">
            <LinkIcon className="w-5 h-5" />
          </div>
        </ChunkyCard>

        {/* Orphaned Files Card */}
        <ChunkyCard
          interactive
          className="p-4 flex items-center justify-between"
        >
          <div>
            <div className="font-sans text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">
              Orphaned Files
            </div>
            <div
              className="font-sans text-xl font-extrabold text-[var(--ink)] mt-1"
              data-testid="metric-orphaned-files"
            >
              {orphanCount}
            </div>
            <div className="font-sans text-[11px] font-bold text-[var(--gold-dark)] mt-0.5">
              Unlinked S3 objects
            </div>
          </div>
          <div className="w-11 h-11 rounded-2xl border-2 border-b-4 border-[var(--gold-dark)] bg-[var(--gold)]/15 text-[var(--gold-dark)] flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </ChunkyCard>
      </div>
    </div>
  );
}
