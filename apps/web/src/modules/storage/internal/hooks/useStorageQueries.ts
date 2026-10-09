import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  storageMetricsQueryOptions,
  storageProvidersQueryOptions,
  storageResourcesQueryOptions,
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

  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(
    null,
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
  const activeError = providersError || metricsError || resourcesError;
  const handleRetryStorage = () => {
    void refetchProviders();
    void refetchMetrics();
    void refetchResources();
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
    activeError,
    handleRetryStorage,
    refetchProviders,
    minioStatus,
    isMinioActive,
  };
}

export type StorageQueries = ReturnType<typeof useStorageQueries>;
