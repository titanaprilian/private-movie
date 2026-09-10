import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { formatBytes, type StorageResource } from './api';

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
  let reclaimedSizeBytes = resourcesToDelete.reduce((acc, r) => acc + (r.sizeBytes || 0), 0);

  if (targetType === 'purge') {
    fileCount = allOrphansCount;
    reclaimedSizeBytes = allOrphansSizeBytes;
  }

  // Check for sole source warnings: linked files whose episode has only 1 source remaining!
  const loneSourceEpisodes: Array<{ title: string; seriesTitle?: string; episodeNumber?: number; seasonNumber?: number }> = [];
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

  const handleConfirm = async () => {
    try {
      setIsDeleting(true);
      setError(null);
      await onConfirm();
      onOpenChange(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to execute deletion';
      setError(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[95vw] bg-card border-c rounded sm:rounded p-5">
        <DialogHeader className="pb-2 border-b border-c">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400 flex items-center justify-center shrink-0">
              <Trash2 className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-fg">
                {targetType === 'purge'
                  ? 'Purge All Orphaned S3 Files'
                  : targetType === 'batch'
                  ? `Delete ${fileCount} Selected Files`
                  : 'Delete S3 File'}
              </DialogTitle>
              <p className="text-xs text-muted">
                {targetType === 'purge'
                  ? 'Permanently delete all unlinked S3 files to reclaim storage space.'
                  : targetType === 'batch'
                  ? 'Permanently delete the selected files from cloud storage.'
                  : `Permanently delete "${targetResource?.filename || targetResource?.key}"`}
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 py-2 text-xs">
          {/* Summary Box */}
          <div className="bg-card border border-c rounded p-3 space-y-1.5 mono">
            <div className="flex justify-between">
              <span className="text-muted">Files to delete:</span>
              <span className="font-semibold text-fg" data-testid="delete-file-count">{fileCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Reclaimed space:</span>
              <span className="font-semibold text-green-600 dark:text-green-400" data-testid="reclaimed-space">
                {formatBytes(reclaimedSizeBytes)}
              </span>
            </div>
          </div>

          {/* Sole Source Warning Badge */}
          {hasLoneSourceWarning && (
            <div
              className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded p-3 flex gap-2.5 items-start text-amber-800 dark:text-amber-300"
              data-testid="sole-source-warning"
            >
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-xs">
                  Warning: Last Remaining Video Source
                </p>
                <p className="text-[11px] leading-relaxed">
                  Deleting {loneSourceEpisodes.length === 1 ? 'this source' : 'these sources'} will leave {loneSourceEpisodes.length === 1 ? 'an episode' : `${loneSourceEpisodes.length} episodes`} with 0 playable video sources:
                </p>
                <ul className="list-disc list-inside text-[11px] font-mono space-y-0.5">
                  {loneSourceEpisodes.map((ep, i) => (
                    <li key={i} className="truncate">
                      {ep.seriesTitle ? `${ep.seriesTitle} — ` : ''}S{ep.seasonNumber ?? 1}E{ep.episodeNumber ?? 1}: {ep.title}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {error && (
            <p className="text-xs text-red-600 dark:text-red-400 font-medium" data-testid="delete-error">
              {error}
            </p>
          )}
        </div>

        <DialogFooter className="pt-2 gap-2 flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={handleConfirm}
            disabled={isDeleting}
            data-testid="confirm-delete-btn"
          >
            {isDeleting ? 'Deleting...' : 'Confirm Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
