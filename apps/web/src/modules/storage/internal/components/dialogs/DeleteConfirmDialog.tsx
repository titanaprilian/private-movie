import { useState } from 'react';
import { ChunkyConfirmDialog } from '@/components/ui/chunky-confirm-dialog';
import { ChunkyCard } from '@/components/ui/chunky-card';
import { ChunkyTooltip } from '@/components/ui/chunky-tooltip';
import { AlertTriangle } from 'lucide-react';
import { formatDualBytes, type StorageResource } from '../../api';

export type DeleteTargetType = 'single' | 'batch' | 'purge';

export interface DeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetType: DeleteTargetType | null;
  targetResource?: StorageResource | null;
  selectedResources?: StorageResource[];
  allOrphansCount?: number;
  allOrphansSizeBytes?: number;
  onConfirm: () => Promise<void>;
}

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  targetType,
  targetResource,
  selectedResources = [],
  allOrphansCount = 0,
  allOrphansSizeBytes = 0,
  onConfirm,
}: DeleteConfirmDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!targetType) return null;

  // Determine resources involved
  let resourcesToDelete: StorageResource[] = [];
  if (targetType === 'single' && targetResource) {
    resourcesToDelete = [targetResource];
  } else if (targetType === 'batch') {
    resourcesToDelete = selectedResources;
  }

  // Calculate file count and reclaimed size
  let fileCount = resourcesToDelete.length;
  let reclaimedSizeBytes = resourcesToDelete.reduce(
    (acc, r) => acc + (r.sizeBytes || 0),
    0
  );

  if (targetType === 'purge') {
    fileCount = allOrphansCount;
    reclaimedSizeBytes = allOrphansSizeBytes;
  }

  // Check for sole source warnings: linked files whose episode has only 1 source remaining!
  const loneSourceEpisodes: Array<{
    title: string;
    seriesTitle?: string;
    episodeNumber?: number;
    seasonNumber?: number;
  }> = [];
  if (targetType !== 'purge') {
    for (const r of resourcesToDelete) {
      if (r.status === 'linked' && r.episode && r.episode.sourceCount <= 1) {
        loneSourceEpisodes.push({
          title: r.episode.title,
          seriesTitle: r.episode.seriesTitle,
          episodeNumber: r.episode.episodeNumber,
          seasonNumber: r.episode.seasonNumber,
        });
      }
    }
  }

  const hasLoneSourceWarning = loneSourceEpisodes.length > 0;

  const title =
    targetType === 'purge'
      ? 'Purge All Orphaned S3 Files'
      : targetType === 'batch'
        ? `Delete ${fileCount} Selected Files`
        : 'Delete S3 File';

  const leadDescription =
    targetType === 'purge'
      ? 'Permanently delete all unlinked S3 files to reclaim storage space.'
      : targetType === 'batch'
        ? 'Permanently delete the selected files from cloud storage.'
        : `Permanently delete "${targetResource?.filename || targetResource?.key}"`;

  const handleConfirm = async () => {
    try {
      setIsDeleting(true);
      setError(null);
      await onConfirm();
      onOpenChange(false);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Failed to execute deletion';
      setError(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <ChunkyConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={
        <div
          className="space-y-3 pt-1 text-left min-w-0 max-h-[50vh] overflow-y-auto pr-1"
          data-testid="delete-dialog-scroll"
        >
          <p className="break-words">{leadDescription}</p>

          {/* Summary Box */}
          <ChunkyCard className="p-3 space-y-1.5 font-mono">
            <div className="flex justify-between">
              <span className="font-sans text-xs font-semibold text-[var(--muted)]">
                Files to delete:
              </span>
              <span
                className="text-xs font-extrabold text-[var(--ink)]"
                data-testid="delete-file-count"
              >
                {fileCount}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="font-sans text-xs font-semibold text-[var(--muted)]">
                Reclaimed space:
              </span>
              <span
                className="text-xs font-extrabold text-[var(--green)]"
                data-testid="reclaimed-space"
              >
                {formatDualBytes(reclaimedSizeBytes)}
              </span>
            </div>
          </ChunkyCard>

          {/* Sole Source Warning Badge */}
          {hasLoneSourceWarning && (
            <ChunkyCard
              className="p-3 flex gap-2.5 items-start border-[var(--gold-dark)] bg-[var(--gold)]/10"
              data-testid="sole-source-warning"
            >
              <AlertTriangle className="w-4 h-4 text-[var(--gold-dark)] shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-sans font-extrabold text-xs text-[var(--ink)]">
                  Warning: Last Remaining Video Source
                </p>
                <p className="font-sans text-[11px] font-semibold leading-relaxed">
                  Deleting{' '}
                  {loneSourceEpisodes.length === 1
                    ? 'this source'
                    : 'these sources'}{' '}
                  will leave{' '}
                  {loneSourceEpisodes.length === 1
                    ? 'an episode'
                    : `${loneSourceEpisodes.length} episodes`}{' '}
                  with 0 playable video sources:
                </p>
                <ul
                  className="list-disc list-inside font-mono text-[11px] font-semibold space-y-0.5 min-w-0 max-h-36 overflow-y-auto"
                  data-testid="sole-source-episode-list"
                >
                  {loneSourceEpisodes.map((ep, i) => {
                    const fullLabel = `${ep.seriesTitle ? `${ep.seriesTitle} — ` : ''}S${ep.seasonNumber ?? 1}E${ep.episodeNumber ?? 1}: ${ep.title}`;
                    return (
                      <li key={i} className="min-w-0">
                        <ChunkyTooltip content={<span className="break-words">{fullLabel}</span>}>
                          <span className="line-clamp-2 break-words">{fullLabel}</span>
                        </ChunkyTooltip>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </ChunkyCard>
          )}

          {error && (
            <p
              className="font-sans text-xs font-bold text-[var(--red)]"
              data-testid="delete-error"
            >
              {error}
            </p>
          )}
        </div>
      }
      confirmLabel={isDeleting ? 'Deleting...' : 'Confirm Delete'}
      confirmVariant="danger"
      isPending={isDeleting}
      onConfirm={handleConfirm}
      confirmButtonTestId="confirm-delete-btn"
    />
  );
}
