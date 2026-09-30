import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, ExternalLink, Rocket, Server } from 'lucide-react';
import { ChunkyButton } from '@/components/ui/chunky-button';
import { ChunkyCard } from '@/components/ui/chunky-card';
import {
  ChunkySelect,
  ChunkySelectContent,
  ChunkySelectItem,
  ChunkySelectTrigger,
  ChunkySelectValue,
} from '@/components/ui/chunky-select';
import {
  storageMetricsQueryOptions,
  storageResourcesQueryOptions,
  storageProvidersQueryOptions,
  minioStatusQueryOptions,
  updateStorageLimit,
  refreshStorageScan,
  updateSourceMetadata,
  attachOrphanFile,
  deleteStorageResources,
  purgeOrphanFiles,
  type StorageResource,
  type VideoSourceMetadata,
  type AttachOrphanInput,
  type StorageProviderItem,
} from './api';
import { StorageMetricsGrid } from './StorageMetricsGrid';
import { StorageResourceTable } from './StorageResourceTable';
import { StorageLimitDialog } from './StorageLimitDialog';
import { EditSourceModal } from './EditSourceModal';
import { AttachOrphanDialog } from './AttachOrphanDialog';
import {
  DeleteConfirmDialog,
  type DeleteTargetType,
} from './DeleteConfirmDialog';
import { VideoPreviewModal } from './VideoPreviewModal';
import { ManageProvidersDrawer } from './ManageProvidersDrawer';
import { MinioSpinUpModal } from './MinioSpinUpModal';

export function StorageView() {
  const queryClient = useQueryClient();

  // Provider list query
  const { data: rawProviders, refetch: refetchProviders } = useQuery(
    storageProvidersQueryOptions()
  );
  const providers = useMemo<StorageProviderItem[]>(
    () => (Array.isArray(rawProviders) ? rawProviders : []),
    [rawProviders]
  );

  // Selected provider ID state (defaulting to default provider or first provider)
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(
    null
  );

  useEffect(() => {
    if (providers.length > 0 && !selectedProviderId) {
      const defaultProvider =
        providers.find((p) => p.isDefault) || providers[0];
      if (defaultProvider) {
        setSelectedProviderId(defaultProvider.id);
      }
    }
  }, [providers, selectedProviderId]);

  // Find active provider object
  const activeProvider =
    providers.find((p) => p.id === selectedProviderId) || null;

  // Scoped Queries based on selectedProviderId
  const {
    data: metrics,
    isLoading: isLoadingMetrics,
    error: metricsError,
  } = useQuery(storageMetricsQueryOptions(selectedProviderId || undefined));

  const {
    data: resourcesData,
    isLoading: isLoadingResources,
    error: resourcesError,
  } = useQuery(
    storageResourcesQueryOptions(
      selectedProviderId ? { providerId: selectedProviderId } : {}
    )
  );

  const resources = resourcesData?.data ?? [];
  const activeError = metricsError || resourcesError;

  // MinIO status query (for spin-up / console header action)
  const { data: minioStatus } = useQuery(minioStatusQueryOptions());
  const isMinioActive = Boolean(
    minioStatus?.isRunning && minioStatus?.consoleUrl
  );

  // Dialog & Drawer States
  const [isLimitDialogOpen, setIsLimitDialogOpen] = useState(false);
  const [isProvidersDrawerOpen, setIsProvidersDrawerOpen] = useState(false);
  const [isSpinUpModalOpen, setIsSpinUpModalOpen] = useState(false);
  const [previewResource, setPreviewResource] =
    useState<StorageResource | null>(null);
  const [editingSource, setEditingSource] = useState<
    (VideoSourceMetadata & { key?: string }) | null
  >(null);
  const [attachingResource, setAttachingResource] =
    useState<StorageResource | null>(null);

  // Deletion Dialog State
  const [deleteTargetType, setDeleteTargetType] =
    useState<DeleteTargetType | null>(null);
  const [deleteSingleResource, setDeleteSingleResource] =
    useState<StorageResource | null>(null);
  const [deleteBatchResources, setDeleteBatchResources] = useState<
    StorageResource[]
  >([]);

  // Refresh Scan Mutation
  const refreshScanMutation = useMutation({
    mutationFn: () => refreshStorageScan(selectedProviderId || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storage'] });
      toast.success('S3 bucket scan refreshed successfully');
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof Error ? err.message : 'Failed to refresh bucket scan';
      toast.error(msg);
    },
  });

  // Save Limit Mutation
  const handleSaveLimit = async (limitGb: number) => {
    await updateStorageLimit(limitGb, selectedProviderId || undefined);
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
    await attachOrphanFile({
      ...input,
      providerId: selectedProviderId || undefined,
    });
    queryClient.invalidateQueries({ queryKey: ['storage'] });
    toast.success('Orphaned file attached to episode successfully');
  };

  // Confirm Deletion Handler
  const handleConfirmDelete = async () => {
    const provId = selectedProviderId || undefined;
    if (deleteTargetType === 'single' && deleteSingleResource) {
      await deleteStorageResources([deleteSingleResource.key], provId);
      toast.success(`Deleted file: ${deleteSingleResource.filename}`);
    } else if (
      deleteTargetType === 'batch' &&
      deleteBatchResources.length > 0
    ) {
      const keys = deleteBatchResources.map((r) => r.key);
      const res = await deleteStorageResources(keys, provId);
      toast.success(`Deleted ${res.deletedKeys?.length ?? keys.length} files`);
    } else if (deleteTargetType === 'purge') {
      const res = await purgeOrphanFiles(provId);
      toast.success(
        `Purged ${res.deletedKeys?.length ?? 'all'} orphaned files`
      );
    }
    queryClient.invalidateQueries({ queryKey: ['storage'] });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Title and Provider Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-[var(--ink)]">
            Storage Management
          </h1>
          <p className="font-sans text-sm font-semibold text-[var(--muted)] mt-1">
            Monitor S3 capacity, inspect bucket object inventory, link orphans,
            and manage video files.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Provider Selector (ChunkySelect scales to any provider count) */}
          {providers.length > 0 && (
            <div
              className="flex items-center"
              data-testid="provider-selector-container"
            >
              <ChunkySelect
                value={selectedProviderId || undefined}
                onValueChange={(val) => setSelectedProviderId(val)}
              >
                <ChunkySelectTrigger
                  data-testid="provider-selector-dropdown"
                  className="w-[220px] font-mono"
                >
                  <ChunkySelectValue placeholder="Select provider" />
                </ChunkySelectTrigger>
                <ChunkySelectContent>
                  {providers.map((p) => (
                    <ChunkySelectItem
                      key={p.id}
                      value={p.id}
                      className="font-mono"
                    >
                      {p.name} {p.isDefault ? '(Default)' : ''}
                    </ChunkySelectItem>
                  ))}
                </ChunkySelectContent>
              </ChunkySelect>
            </div>
          )}

          {/* MinIO Console link when active, otherwise Spin Up action */}
          {isMinioActive && minioStatus?.consoleUrl ? (
            <ChunkyButton
              variant="outline"
              size="sm"
              asChild
              data-testid="minio-console-link-btn"
            >
              <a href={minioStatus.consoleUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="w-4 h-4" />
                MinIO Console
              </a>
            </ChunkyButton>
          ) : (
            <ChunkyButton
              variant="blue"
              size="sm"
              onClick={() => setIsSpinUpModalOpen(true)}
              data-testid="spin-up-minio-btn"
            >
              <Rocket className="w-4 h-4" />
              Spin Up MinIO
            </ChunkyButton>
          )}

          {/* Manage Providers Action Button */}
          <ChunkyButton
            variant="outline"
            size="sm"
            onClick={() => setIsProvidersDrawerOpen(true)}
            data-testid="manage-providers-btn"
          >
            <Server className="w-4 h-4" />
            Manage Providers
          </ChunkyButton>
        </div>
      </div>

      {/* S3 Configuration / Error Alert Banner */}
      {activeError && (
        <ChunkyCard
          className="p-4 flex items-start gap-3 border-[var(--gold-dark)] bg-[var(--gold)]/10"
          data-testid="storage-error-alert"
        >
          <span className="w-11 h-11 rounded-2xl border-2 border-b-4 border-[var(--gold-dark)] bg-[var(--gold)]/20 text-[var(--gold-dark)] flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </span>
          <div className="space-y-1">
            <h3 className="font-display font-bold text-sm text-[var(--ink)]">
              Storage Warning
            </h3>
            <p className="font-sans text-xs font-semibold text-[var(--muted)]">
              {activeError instanceof Error
                ? activeError.message
                : 'S3 storage service is unavailable or unconfigured.'}
            </p>
          </div>
        </ChunkyCard>
      )}

      {/* Empty-state hero: no providers connected */}
      {providers.length === 0 && (
        <ChunkyCard
          data-testid="minio-empty-state-hero"
          className="p-8 text-center space-y-3"
        >
          <div className="mx-auto w-14 h-14 rounded-2xl border-2 border-b-4 border-[var(--green-dark)] bg-[var(--green-soft)] text-[var(--green)] flex items-center justify-center">
            <Rocket className="w-6 h-6" />
          </div>
          <h2 className="font-display font-extrabold text-xl text-[var(--ink)]">
            No storage connected yet
          </h2>
          <p className="font-sans text-sm font-semibold text-[var(--muted)] max-w-md mx-auto">
            Connect an S3-compatible provider or spin up a local MinIO object
            storage instance with one click — no cloud account required.
          </p>
          <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
            <ChunkyButton
              size="sm"
              variant="primary"
              onClick={() => setIsSpinUpModalOpen(true)}
              data-testid="minio-empty-state-spinup-btn"
            >
              <Rocket className="w-4 h-4" />
              Spin Up MinIO
            </ChunkyButton>
            <ChunkyButton
              variant="outline"
              size="sm"
              onClick={() => setIsProvidersDrawerOpen(true)}
            >
              Manage Providers
            </ChunkyButton>
          </div>
        </ChunkyCard>
      )}

      {/* Metrics Section */}
      <StorageMetricsGrid
        metrics={metrics}
        isLoading={isLoadingMetrics}
        onOpenLimitDialog={() => setIsLimitDialogOpen(true)}
        providerName={activeProvider?.name}
      />

      {/* Resources Table Section */}
      <StorageResourceTable
        resources={resources}
        isLoading={isLoadingResources}
        orphanedCount={metrics?.orphanCount ?? 0}
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

      {/* Dialogs & Drawer */}
      <MinioSpinUpModal
        open={isSpinUpModalOpen}
        onOpenChange={setIsSpinUpModalOpen}
        providerCount={providers.length}
      />

      <ManageProvidersDrawer
        open={isProvidersDrawerOpen}
        onOpenChange={setIsProvidersDrawerOpen}
        providers={providers}
        selectedProviderId={selectedProviderId}
        onSelectProvider={(id) => {
          setSelectedProviderId(id);
          setIsProvidersDrawerOpen(false);
        }}
        onProvidersUpdated={() => {
          refetchProviders();
          queryClient.invalidateQueries({ queryKey: ['storage'] });
        }}
        onSpinUpMinio={() => {
          setIsProvidersDrawerOpen(false);
          setIsSpinUpModalOpen(true);
        }}
      />

      <StorageLimitDialog
        open={isLimitDialogOpen}
        onOpenChange={setIsLimitDialogOpen}
        currentLimitGb={
          metrics
            ? Math.round(metrics.limitBytes / (1024 * 1024 * 1024))
            : (activeProvider?.storageLimitGb ?? 50)
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
        allOrphansCount={metrics?.orphanCount ?? 0}
        allOrphansSizeBytes={resources
          .filter((r) => r.status === 'orphaned')
          .reduce((acc, r) => acc + (r.sizeBytes || 0), 0)}
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
