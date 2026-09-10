import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle } from 'lucide-react';
import {
  storageMetricsQueryOptions,
  storageResourcesQueryOptions,
  updateStorageLimit,
  refreshStorageScan,
  updateSourceMetadata,
  attachOrphanFile,
  deleteStorageResources,
  purgeOrphanFiles,
  type StorageResource,
  type VideoSourceMetadata,
  type AttachOrphanInput,
} from './api';
import { StorageMetricsGrid } from './StorageMetricsGrid';
import { StorageResourceTable } from './StorageResourceTable';
import { StorageLimitDialog } from './StorageLimitDialog';
import { EditSourceModal } from './EditSourceModal';
import { AttachOrphanDialog } from './AttachOrphanDialog';
import { DeleteConfirmDialog, type DeleteTargetType } from './DeleteConfirmDialog';
import { VideoPreviewModal } from './VideoPreviewModal';

export function StorageView() {
  const queryClient = useQueryClient();

  // Queries
  const {
    data: metrics,
    isLoading: isLoadingMetrics,
    error: metricsError,
  } = useQuery(storageMetricsQueryOptions());

  const {
    data: resourcesData,
    isLoading: isLoadingResources,
    error: resourcesError,
  } = useQuery(storageResourcesQueryOptions());

  const resources = resourcesData?.data ?? [];
  const activeError = metricsError || resourcesError;

  // Dialog States
  const [isLimitDialogOpen, setIsLimitDialogOpen] = useState(false);
  const [previewResource, setPreviewResource] = useState<StorageResource | null>(null);
  const [editingSource, setEditingSource] = useState<(VideoSourceMetadata & { key?: string }) | null>(null);
  const [attachingResource, setAttachingResource] = useState<StorageResource | null>(null);

  // Deletion Dialog State
  const [deleteTargetType, setDeleteTargetType] = useState<DeleteTargetType | null>(null);
  const [deleteSingleResource, setDeleteSingleResource] = useState<StorageResource | null>(null);
  const [deleteBatchResources, setDeleteBatchResources] = useState<StorageResource[]>([]);

  // Refresh Scan Mutation
  const refreshScanMutation = useMutation({
    mutationFn: refreshStorageScan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storage'] });
      toast.success('S3 bucket scan refreshed successfully');
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to refresh bucket scan';
      toast.error(msg);
    },
  });

  // Save Limit Mutation
  const handleSaveLimit = async (limitGb: number) => {
    await updateStorageLimit(limitGb);
    queryClient.invalidateQueries({ queryKey: ['storage'] });
    toast.success(`Storage limit updated to ${limitGb} GB`);
  };

  // Edit Source Metadata Mutation
  const handleSaveSourceMetadata = async (
    sourceId: string,
    input: { label: string; quality: string }
  ) => {
    await updateSourceMetadata(sourceId, input);
    queryClient.invalidateQueries({ queryKey: ['storage'] });
    toast.success('Source metadata updated successfully');
  };

  // Attach Orphan Mutation
  const handleAttachOrphan = async (input: AttachOrphanInput) => {
    await attachOrphanFile(input);
    queryClient.invalidateQueries({ queryKey: ['storage'] });
    toast.success('Orphaned file attached to episode successfully');
  };

  // Confirm Deletion Handler
  const handleConfirmDelete = async () => {
    if (deleteTargetType === 'single' && deleteSingleResource) {
      await deleteStorageResources([deleteSingleResource.key]);
      toast.success(`Deleted file: ${deleteSingleResource.filename}`);
    } else if (deleteTargetType === 'batch' && deleteBatchResources.length > 0) {
      const keys = deleteBatchResources.map((r) => r.key);
      const res = await deleteStorageResources(keys);
      toast.success(`Deleted ${res.deletedKeys?.length ?? keys.length} files`);
    } else if (deleteTargetType === 'purge') {
      const res = await purgeOrphanFiles();
      toast.success(`Purged ${res.deletedKeys?.length ?? 'all'} orphaned files`);
    }
    queryClient.invalidateQueries({ queryKey: ['storage'] });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-c">
        <div>
          <h1 className="text-xl font-semibold text-fg">Storage Management</h1>
          <p className="text-xs text-muted mt-0.5">
            Monitor S3 capacity, inspect bucket object inventory, link orphans, and manage video files.
          </p>
        </div>
      </div>

      {/* S3 Configuration / Error Alert Banner */}
      {activeError && (
        <div
          className="bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 rounded p-4 flex items-start gap-3"
          data-testid="storage-error-alert"
        >
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-fg">Storage Warning</h3>
            <p className="text-xs text-muted">
              {activeError instanceof Error
                ? activeError.message
                : 'S3 storage service is unavailable or unconfigured.'}
            </p>
          </div>
        </div>
      )}

      {/* Metrics Section */}
      <StorageMetricsGrid
        metrics={metrics}
        isLoading={isLoadingMetrics}
        onOpenLimitDialog={() => setIsLimitDialogOpen(true)}
      />

      {/* Resources Table Section */}
      <StorageResourceTable
        resources={resources}
        isLoading={isLoadingResources}
        orphanedCount={metrics?.orphanedFiles ?? 0}
        onRefreshScan={() => refreshScanMutation.mutate()}
        isRefreshing={refreshScanMutation.isPending}
        onPreview={(res) => setPreviewResource(res)}
        onEditSource={(res) => {
          if (res.videoSource) {
            setEditingSource({ ...res.videoSource, key: res.key });
          }
        }}
        onAttachOrphan={(res) => setAttachingResource(res)}
        onDeleteSingle={(res) => {
          setDeleteSingleResource(res);
          setDeleteTargetType('single');
        }}
        onDeleteBatch={(selected) => {
          setDeleteBatchResources(selected);
          setDeleteTargetType('batch');
        }}
        onPurgeOrphans={() => {
          setDeleteTargetType('purge');
        }}
      />

      {/* Dialogs */}
      <StorageLimitDialog
        open={isLimitDialogOpen}
        onOpenChange={setIsLimitDialogOpen}
        currentLimitGb={
          metrics ? Math.round(metrics.limitSizeBytes / (1024 * 1024 * 1024)) : 50
        }
        onSave={handleSaveLimit}
      />

      <EditSourceModal
        open={Boolean(editingSource)}
        onOpenChange={(open) => {
          if (!open) setEditingSource(null);
        }}
        videoSource={editingSource}
        onSave={handleSaveSourceMetadata}
      />

      <AttachOrphanDialog
        open={Boolean(attachingResource)}
        onOpenChange={(open) => {
          if (!open) setAttachingResource(null);
        }}
        fileKey={attachingResource?.key ?? null}
        filename={attachingResource?.filename}
        onAttach={handleAttachOrphan}
      />

      <DeleteConfirmDialog
        open={Boolean(deleteTargetType)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTargetType(null);
            setDeleteSingleResource(null);
            setDeleteBatchResources([]);
          }
        }}
        targetType={deleteTargetType}
        targetResource={deleteSingleResource}
        selectedResources={deleteBatchResources}
        allOrphansCount={metrics?.orphanedFiles ?? 0}
        allOrphansSizeBytes={
          resources
            .filter((r) => r.status === 'orphaned')
            .reduce((acc, r) => acc + (r.sizeBytes || 0), 0)
        }
        onConfirm={handleConfirmDelete}
      />

      <VideoPreviewModal
        open={Boolean(previewResource)}
        onOpenChange={(open) => {
          if (!open) setPreviewResource(null);
        }}
        fileKey={previewResource?.key ?? null}
        filename={previewResource?.filename}
      />
    </div>
  );
}
