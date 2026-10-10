import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Rocket, Server } from 'lucide-react';
import { ChunkyButton } from '@/components/ui/chunky-button';
import { ChunkyCard } from '@/components/ui/chunky-card';
import { ErrorState } from '@/components/ui/error-state';
import {
  ChunkyTabs,
  ChunkyTabsContent,
  ChunkyTabsList,
  ChunkyTabsTrigger,
} from '@/components/ui/chunky-tabs';
import {
  ChunkySelect,
  ChunkySelectContent,
  ChunkySelectItem,
  ChunkySelectTrigger,
  ChunkySelectValue,
} from '@/components/ui/chunky-select';
import { useStorageQueries } from './hooks/useStorageQueries';
import { useStorageModals } from './hooks/useStorageModals';
import { StorageMetricsGrid } from './components/StorageMetricsGrid';
import { StorageResourceTable } from './components/StorageResourceTable';
import { StorageSeriesTable } from './components/StorageSeriesTable';
import { StorageSeriesDrilldown } from './components/StorageSeriesDrilldown';
import { storageResourcesQueryOptions, type StorageSeriesItem } from './api';
import { StorageLimitDialog } from './components/dialogs/StorageLimitDialog';
import { EditSourceModal } from './components/dialogs/EditSourceModal';
import { AttachOrphanDialog } from './components/dialogs/AttachOrphanDialog';
import { DeleteConfirmDialog } from './components/dialogs/DeleteConfirmDialog';
import { VideoPreviewModal } from './components/dialogs/VideoPreviewModal';
import { ManageProvidersDrawer } from './components/providers/ManageProvidersDrawer';
import { MinioSpinUpModal } from './components/dialogs/MinioSpinUpModal';

export function StorageView() {
  const queryClient = useQueryClient();
  const {
    providers,
    selectedProviderId,
    setSelectedProviderId,
    activeProvider,
    metrics,
    isLoadingMetrics,
    isLoadingResources,
    resources,
    series,
    isLoadingSeries,
    activeError,
    handleRetryStorage,
    refetchProviders,
    minioStatus,
    isMinioActive,
  } = useStorageQueries();
  const modals = useStorageModals(selectedProviderId);

  const readSearchParam = (key: string): string | null => {
    try {
      if (typeof window === 'undefined') return null;
      const params = new URLSearchParams(window.location.search);
      return params.get(key);
    } catch {
      return null;
    }
  };

  const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(() =>
    readSearchParam('seriesId')
  );
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(() =>
    readSearchParam('seasonId')
  );

  // Keep browser URL in sync; fallback to local state when unavailable.
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      const url = new URL(window.location.href);
      if (selectedSeriesId) {
        url.searchParams.set('seriesId', selectedSeriesId);
      } else {
        url.searchParams.delete('seriesId');
      }
      if (selectedSeriesId && selectedSeasonId) {
        url.searchParams.set('seasonId', selectedSeasonId);
      } else {
        url.searchParams.delete('seasonId');
      }
      window.history.replaceState(null, '', url.toString());
    } catch {
      // Fallback local state only
    }
  }, [selectedSeriesId, selectedSeasonId]);

  const orphanedResources = useMemo(
    () => resources.filter((r) => r.status === 'orphaned'),
    [resources]
  );

  const handleSelectSeries = (item: StorageSeriesItem) => {
    setSelectedSeriesId(item.id);
    setSelectedSeasonId(null);
  };

  const handleBackToSeries = () => {
    setSelectedSeriesId(null);
    setSelectedSeasonId(null);
  };

  const activeSeries = series.find((s) => s.id === selectedSeriesId) ?? null;

  // Server-scoped drill-down query; client memo below filters as fallback
  // (e.g. cached/unfiltered payloads) by series/season.
  const drilldownQueryParams = useMemo(
    () =>
      selectedProviderId
        ? {
            providerId: selectedProviderId,
            ...(selectedSeriesId ? { seriesId: selectedSeriesId } : {}),
            ...(selectedSeasonId ? { seasonId: selectedSeasonId } : {}),
          }
        : {
            ...(selectedSeriesId ? { seriesId: selectedSeriesId } : {}),
            ...(selectedSeasonId ? { seasonId: selectedSeasonId } : {}),
          },
    [selectedProviderId, selectedSeriesId, selectedSeasonId]
  );
  const { data: drilldownData, isLoading: isLoadingDrilldown } = useQuery({
    ...storageResourcesQueryOptions(drilldownQueryParams),
    enabled: Boolean(selectedSeriesId),
  });
  const drilldownResources = useMemo(() => {
    const items = drilldownData?.data ?? [];
    return items.filter((r) => {
      if (
        selectedSeriesId &&
        r.episode &&
        r.episode.seriesId !== selectedSeriesId
      )
        return false;
      if (selectedSeriesId && !r.episode && selectedSeasonId === null) {
        // Orphaned files have no series; exclude from series drill-down
        // when the server returned an unfiltered payload.
        // Detect server-side scoping: if every item links to the series,
        // the payload is already scoped and this branch is unreachable.
        const allLinkedToSeries =
          items.length > 0 &&
          items.every((i) => i.episode?.seriesId === selectedSeriesId);
        if (!allLinkedToSeries) return false;
      }
      if (selectedSeasonId && r.episode?.seasonId !== selectedSeasonId)
        return false;
      return true;
    });
  }, [drilldownData, selectedSeriesId, selectedSeasonId]);

  if (activeError) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-[var(--ink)]">
            Storage Management
          </h1>
          <p className="font-sans text-sm font-semibold text-[var(--muted)] mt-1">
            Monitor S3 capacity, inspect bucket object inventory, link orphans,
            and manage video files.
          </p>
        </div>
        <div
          data-testid="storage-error-alert"
          className="flex justify-center py-12"
        >
          <ErrorState
            tone="warning"
            title="Storage Warning"
            description={
              activeError instanceof Error
                ? activeError.message
                : 'S3 storage service is unavailable or unconfigured.'
            }
            onRetry={handleRetryStorage}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Title and Provider Controls (suppressed in drill-down mode) */}
      {!activeSeries && (
        <div
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          data-testid="storage-page-header"
        >
          <div>
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-[var(--ink)]">
              Storage Management
            </h1>
            <p className="font-sans text-sm font-semibold text-[var(--muted)] mt-1">
              Monitor S3 capacity, inspect bucket object inventory, link
              orphans, and manage video files.
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
                <a
                  href={minioStatus.consoleUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink className="w-4 h-4" />
                  MinIO Console
                </a>
              </ChunkyButton>
            ) : (
              <ChunkyButton
                variant="blue"
                size="sm"
                onClick={() => modals.setIsSpinUpModalOpen(true)}
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
              onClick={() => modals.setIsProvidersDrawerOpen(true)}
              data-testid="manage-providers-btn"
            >
              <Server className="w-4 h-4" />
              Manage Providers
            </ChunkyButton>
          </div>
        </div>
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
              onClick={() => modals.setIsSpinUpModalOpen(true)}
              data-testid="minio-empty-state-spinup-btn"
            >
              <Rocket className="w-4 h-4" />
              Spin Up MinIO
            </ChunkyButton>
            <ChunkyButton
              variant="outline"
              size="sm"
              onClick={() => modals.setIsProvidersDrawerOpen(true)}
            >
              Manage Providers
            </ChunkyButton>
          </div>
        </ChunkyCard>
      )}

      {/* Metrics Section (suppressed in the focused Level 2 drill-down view) */}
      {!activeSeries && (
        <StorageMetricsGrid
          metrics={metrics}
          isLoading={isLoadingMetrics}
          onOpenLimitDialog={() => modals.setIsLimitDialogOpen(true)}
          providerName={activeProvider?.name}
        />
      )}

      {/* Level 2 Drill-down: scoped series view with season navigation */}
      {activeSeries ? (
        <StorageSeriesDrilldown
          series={activeSeries}
          seasons={activeSeries.seasons}
          activeSeasonId={selectedSeasonId}
          onSelectSeason={setSelectedSeasonId}
          onBack={handleBackToSeries}
          resources={drilldownResources}
          isLoading={isLoadingDrilldown}
          renderTable={(scopedResources) => (
            <StorageResourceTable
              resources={scopedResources}
              isLoading={isLoadingDrilldown}
              hideToolbar
              orphanedCount={metrics?.orphanCount ?? 0}
              onRefreshScan={() => modals.refreshScanMutation.mutate()}
              isRefreshing={modals.refreshScanMutation.isPending}
              onPreview={(res) => modals.setPreviewResource(res)}
              onEditSource={(res) => {
                if (res.videoSource) {
                  modals.setEditingSource({ ...res.videoSource, key: res.key });
                }
              }}
              onAttachOrphan={(res) => modals.setAttachingResource(res)}
              onDeleteSingle={(res) => {
                modals.setDeleteSingleResource(res);
                modals.setDeleteTargetType('single');
              }}
              onDeleteBatch={(selected) => {
                modals.setDeleteBatchResources(selected);
                modals.setDeleteTargetType('batch');
              }}
              onPurgeOrphans={() => {
                modals.setDeleteTargetType('purge');
              }}
            />
          )}
        />
      ) : (
        /* Level 1 Overview: Series & Orphaned Files master tabs */
        <ChunkyTabs defaultValue="series" data-testid="storage-overview-tabs">
          <ChunkyTabsList>
            <ChunkyTabsTrigger value="series" data-testid="tab-trigger-series">
              Series{series.length > 0 ? ` (${series.length})` : ''}
            </ChunkyTabsTrigger>
            <ChunkyTabsTrigger
              value="orphaned"
              data-testid="tab-trigger-orphaned"
            >
              Orphaned Files
              {metrics && metrics.orphanCount > 0
                ? ` (${metrics.orphanCount})`
                : ''}
            </ChunkyTabsTrigger>
          </ChunkyTabsList>

          <ChunkyTabsContent value="series">
            <StorageSeriesTable
              series={series}
              isLoading={isLoadingSeries}
              selectedSeriesId={selectedSeriesId}
              onSelectSeries={handleSelectSeries}
            />
          </ChunkyTabsContent>

          <ChunkyTabsContent value="orphaned">
            <StorageResourceTable
              resources={orphanedResources}
              isLoading={isLoadingResources}
              orphanedCount={metrics?.orphanCount ?? 0}
              onRefreshScan={() => modals.refreshScanMutation.mutate()}
              isRefreshing={modals.refreshScanMutation.isPending}
              onPreview={(res) => modals.setPreviewResource(res)}
              onEditSource={(res) => {
                if (res.videoSource) {
                  modals.setEditingSource({ ...res.videoSource, key: res.key });
                }
              }}
              onAttachOrphan={(res) => modals.setAttachingResource(res)}
              onDeleteSingle={(res) => {
                modals.setDeleteSingleResource(res);
                modals.setDeleteTargetType('single');
              }}
              onDeleteBatch={(selected) => {
                modals.setDeleteBatchResources(selected);
                modals.setDeleteTargetType('batch');
              }}
              onPurgeOrphans={() => {
                modals.setDeleteTargetType('purge');
              }}
            />
          </ChunkyTabsContent>
        </ChunkyTabs>
      )}

      {/* Dialogs & Drawer */}
      <MinioSpinUpModal
        open={modals.isSpinUpModalOpen}
        onOpenChange={modals.setIsSpinUpModalOpen}
        providerCount={providers.length}
      />

      <ManageProvidersDrawer
        open={modals.isProvidersDrawerOpen}
        onOpenChange={modals.setIsProvidersDrawerOpen}
        providers={providers}
        selectedProviderId={selectedProviderId}
        onSelectProvider={(id) => {
          setSelectedProviderId(id);
          modals.setIsProvidersDrawerOpen(false);
        }}
        onProvidersUpdated={() => {
          refetchProviders();
          queryClient.invalidateQueries({ queryKey: ['storage'] });
        }}
        onSpinUpMinio={() => {
          modals.setIsProvidersDrawerOpen(false);
          modals.setIsSpinUpModalOpen(true);
        }}
      />

      <StorageLimitDialog
        open={modals.isLimitDialogOpen}
        onOpenChange={modals.setIsLimitDialogOpen}
        currentLimitGb={
          metrics
            ? Math.round(metrics.limitBytes / (1024 * 1024 * 1024))
            : (activeProvider?.storageLimitGb ?? 50)
        }
        onSave={modals.handleSaveLimit}
      />

      <EditSourceModal
        open={Boolean(modals.editingSource)}
        onOpenChange={(open) => {
          if (!open) modals.setEditingSource(null);
        }}
        videoSource={modals.editingSource}
        onSave={modals.handleSaveSourceMetadata}
      />

      <AttachOrphanDialog
        open={Boolean(modals.attachingResource)}
        onOpenChange={(open) => {
          if (!open) modals.setAttachingResource(null);
        }}
        fileKey={modals.attachingResource?.key ?? null}
        filename={modals.attachingResource?.filename}
        onAttach={modals.handleAttachOrphan}
      />

      <DeleteConfirmDialog
        open={Boolean(modals.deleteTargetType)}
        onOpenChange={(open) => {
          if (!open) modals.closeDeleteDialog();
        }}
        targetType={modals.deleteTargetType}
        targetResource={modals.deleteSingleResource}
        selectedResources={modals.deleteBatchResources}
        allOrphansCount={metrics?.orphanCount ?? 0}
        allOrphansSizeBytes={resources
          .filter((r) => r.status === 'orphaned')
          .reduce((acc, r) => acc + (r.sizeBytes || 0), 0)}
        onConfirm={modals.handleConfirmDelete}
      />

      <VideoPreviewModal
        open={Boolean(modals.previewResource)}
        onOpenChange={(open) => {
          if (!open) modals.setPreviewResource(null);
        }}
        fileKey={modals.previewResource?.key ?? null}
        filename={modals.previewResource?.filename}
      />
    </div>
  );
}
