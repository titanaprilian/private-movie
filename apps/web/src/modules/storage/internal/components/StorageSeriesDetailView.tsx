import { useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { ChunkyButton } from '@/components/ui/chunky-button';
import { ErrorState } from '@/components/ui/error-state';
import { StorageSeriesDrilldown } from './StorageSeriesDrilldown';
import { StorageResourceTable } from './StorageResourceTable';
import { StorageResourceModals } from './StorageResourceModals';
import { getStorageTableCallbacks } from './getStorageTableCallbacks';
import { useStorageModals } from '../hooks/useStorageModals';
import {
  storageResourcesQueryOptions,
  storageSeriesQueryOptions,
} from '../api';

export interface StorageSeriesDetailViewProps {
  seriesId: string;
  initialSeasonId?: string;
  initialProviderId?: string;
  onBack?: () => void;
}

/**
 * Standalone series storage detail view, mounted at
 * `/admin/storage/$seriesId`. Owns season selection, the scoped file query,
 * and every file-level action (preview, edit source metadata, delete single,
 * delete batch, rescan). Global controls (MinIO spin-up, provider drawer,
 * limit dialog) stay on the storage overview page.
 */
export function StorageSeriesDetailView({
  seriesId,
  initialSeasonId,
  initialProviderId,
  onBack,
}: StorageSeriesDetailViewProps) {
  const navigate = useNavigate();
  const [activeSeasonId, setActiveSeasonId] = useState<string | null>(
    initialSeasonId ?? null
  );
  const providerId = initialProviderId ?? null;
  const modals = useStorageModals(providerId);

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    void navigate({ to: '/admin/storage' });
  };

  const {
    data: seriesData,
    isLoading: isLoadingSeries,
    error: seriesError,
    refetch: refetchSeries,
  } = useQuery(storageSeriesQueryOptions(providerId ? { providerId } : {}));
  const series = useMemo(
    () => seriesData?.items.find((s) => s.id === seriesId) ?? null,
    [seriesData, seriesId]
  );

  // Server-scoped file query; client memo below filters as fallback
  // (e.g. cached/unfiltered payloads) by season.
  const { data: resourcesData, isLoading: isLoadingResources } = useQuery({
    ...storageResourcesQueryOptions({
      ...(providerId ? { providerId } : {}),
      seriesId,
      ...(activeSeasonId ? { seasonId: activeSeasonId } : {}),
    }),
    enabled: Boolean(series),
  });
  const scopedResources = useMemo(() => {
    const items = resourcesData?.data ?? [];
    return items.filter((r) => {
      if (seriesId && r.episode && r.episode.seriesId !== seriesId)
        return false;
      if (seriesId && !r.episode && activeSeasonId === null) {
        // Orphaned files have no series; exclude from series drill-down
        // when the server returned an unfiltered payload.
        // Detect server-side scoping: if every item links to the series,
        // the payload is already scoped and this branch is unreachable.
        const allLinkedToSeries =
          items.length > 0 &&
          items.every((i) => i.episode?.seriesId === seriesId);
        if (!allLinkedToSeries) return false;
      }
      if (activeSeasonId && r.episode?.seasonId !== activeSeasonId)
        return false;
      return true;
    });
  }, [resourcesData, seriesId, activeSeasonId]);

  if (seriesError) {
    return (
      <div className="space-y-6">
        <div
          data-testid="storage-detail-error-alert"
          className="flex justify-center py-12"
        >
          <ErrorState
            tone="warning"
            title="Storage Warning"
            description={
              seriesError instanceof Error
                ? seriesError.message
                : 'S3 storage service is unavailable or unconfigured.'
            }
            onRetry={() => void refetchSeries()}
          />
        </div>
      </div>
    );
  }

  if (isLoadingSeries) {
    return (
      <p
        className="text-center font-sans text-xs font-bold text-[var(--muted)] py-12"
        data-testid="storage-detail-loading"
      >
        Loading series storage...
      </p>
    );
  }

  if (!series) {
    return (
      <div
        className="text-center py-12 space-y-2"
        data-testid="storage-detail-not-found"
      >
        <p className="font-display font-bold text-lg text-[var(--ink)]">
          Series not found
        </p>
        <p className="font-sans text-sm font-semibold text-[var(--muted)]">
          No stored files are linked to this series.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ChunkyButton
          variant="outline"
          size="sm"
          onClick={() => modals.refreshScanMutation.mutate()}
          disabled={modals.refreshScanMutation.isPending}
          data-testid="storage-detail-rescan-btn"
        >
          <RefreshCw className="w-4 h-4" />
          Rescan
        </ChunkyButton>
      </div>

      <StorageSeriesDrilldown
        series={series}
        seasons={series.seasons}
        activeSeasonId={activeSeasonId}
        onSelectSeason={setActiveSeasonId}
        onBack={handleBack}
        resources={scopedResources}
        isLoading={isLoadingResources}
        renderTable={(scoped) => (
          <StorageResourceTable
            resources={scoped}
            isLoading={isLoadingResources}
            hideToolbar
            {...getStorageTableCallbacks(modals)}
          />
        )}
      />

      <StorageResourceModals
        modals={modals}
        allOrphansCount={0}
        allOrphansSizeBytes={0}
      />
    </div>
  );
}
