import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  storageMetricsQueryOptions,
  storageProvidersQueryOptions,
  storageResourcesQueryOptions,
  storageSeriesQueryOptions,
  minioStatusQueryOptions,
  type StorageProviderItem,
} from '../api';

/**
 * Remote query synchronization and provider selection for the storage module.
 * Owns the selected provider id plus all scoped storage queries.
 */
export function useStorageQueries() {
  const {
    data: rawProviders,
    error: providersError,
    refetch: refetchProviders,
  } = useQuery(storageProvidersQueryOptions());
  const providers = useMemo<StorageProviderItem[]>(
    () => (Array.isArray(rawProviders) ? rawProviders : []),
    [rawProviders],
  );

  const [selectedProviderIdOverride, setSelectedProviderId] =
    useState<string | null>(null);

  // Derive the default provider synchronously so the selected provider id is
  // defined on the very first render that contains providers — no null →
  // string transition across renders (avoids uncontrolled → controlled flip).
  const defaultProviderId = useMemo<string | null>(() => {
    if (providers.length === 0) return null;
    return (
      (providers.find((p) => p.isDefault) ?? providers[0])?.id ?? null
    );
  }, [providers]);

  const selectedProviderId = useMemo<string | null>(() => {
    if (
      selectedProviderIdOverride &&
      providers.some((p) => p.id === selectedProviderIdOverride)
    ) {
      return selectedProviderIdOverride;
    }
    return selectedProviderIdOverride ?? defaultProviderId;
  }, [selectedProviderIdOverride, providers, defaultProviderId]);

  const activeProvider =
    providers.find((p) => p.id === selectedProviderId) || null;

  const {
    data: metrics,
    isLoading: isLoadingMetrics,
    error: metricsError,
    refetch: refetchMetrics,
  } = useQuery(storageMetricsQueryOptions(selectedProviderId || undefined));

  const {
    data: resourcesData,
    isLoading: isLoadingResources,
    error: resourcesError,
    refetch: refetchResources,
  } = useQuery(
    storageResourcesQueryOptions(
      selectedProviderId ? { providerId: selectedProviderId } : {},
    ),
  );

  const resources = resourcesData?.data ?? [];

  const {
    data: seriesData,
    isLoading: isLoadingSeries,
    error: seriesError,
    refetch: refetchSeries,
  } = useQuery(
    storageSeriesQueryOptions(
      selectedProviderId ? { providerId: selectedProviderId } : {},
    ),
  );

  const series = seriesData?.items ?? [];
  const activeError = providersError || metricsError || resourcesError || seriesError;
  const handleRetryStorage = () => {
    void refetchProviders();
    void refetchMetrics();
    void refetchResources();
    void refetchSeries();
  };

  const { data: minioStatus } = useQuery(minioStatusQueryOptions());
  const isMinioActive = Boolean(
    minioStatus?.isRunning && minioStatus?.consoleUrl,
  );

  return {
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
  };
}

export type StorageQueries = ReturnType<typeof useStorageQueries>;
