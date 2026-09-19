import { queryOptions } from '@tanstack/react-query';
import { api, extractErrorMessage } from '@/lib/api';
import type {
  StorageMetrics,
  StorageResourceItem,
  StorageResourcesQuery,
  StorageResourcesResponseData,
  StorageLimitUpdateRequest,
  StorageLimitUpdateResponseData,
  StorageUpdateSourceMetadataRequest,
  StorageAttachRequest,
  StorageDeleteRequest,
  StorageDeleteResponseData,
  StoragePurgeOrphansRequest,
  StoragePurgeOrphansResponseData,
  StorageScanRequest,
  StoragePreviewUrlResponseData,
  StorageProviderItem,
  StorageProviderType,
  CreateStorageProviderRequest,
  UpdateStorageProviderRequest,
  TestStorageProviderRequest,
  TestStorageProviderResponseData,
} from '@repo/contracts';

export type {
  StorageMetrics,
  StorageResourceItem,
  StorageResourcesQuery,
  StorageResourcesResponseData,
  StorageLimitUpdateRequest,
  StorageLimitUpdateResponseData,
  StorageUpdateSourceMetadataRequest,
  StorageAttachRequest,
  StorageDeleteRequest,
  StorageDeleteResponseData,
  StoragePurgeOrphansRequest,
  StoragePurgeOrphansResponseData,
  StorageScanRequest,
  StoragePreviewUrlResponseData,
  StorageProviderItem,
  StorageProviderType,
  CreateStorageProviderRequest,
  UpdateStorageProviderRequest,
  TestStorageProviderRequest,
  TestStorageProviderResponseData,
};

// Backward compatibility aliases
export type StorageResourceFilterParams = StorageResourcesQuery;
export type UpdateStorageLimitInput = StorageLimitUpdateRequest;
export type AttachOrphanInput = StorageAttachRequest;
export type EditSourceMetadataInput = StorageUpdateSourceMetadataRequest;

export interface VideoSourceMetadata {
  id: string;
  label: string;
  quality: string;
  episodeId: string;
}

export interface EpisodeMetadata {
  id: string;
  title: string;
  episodeNumber: number;
  seasonNumber: number;
  seriesId: string;
  seriesTitle: string;
  sourceCount: number;
}

export interface StorageResource {
  id: string;
  key: string;
  filename: string;
  sizeBytes: number;
  lastModified: string;
  status: 'linked' | 'orphaned';
  videoSource?: VideoSourceMetadata;
  episode?: EpisodeMetadata;
  isLoneSource?: boolean;
}

export interface StorageResourcesResponse {
  data: StorageResource[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface BatchDeleteResponse {
  deletedKeys: string[];
  reclaimedBytes: number;
}

export interface FormatBytesOptions {
  decimals?: number;
  standard?: 'binary' | 'decimal';
}

export function formatBytes(
  bytes: number,
  optionsOrDecimals: number | FormatBytesOptions = 1
): string {
  if (bytes === 0) return '0 B';

  let decimals = 1;
  let standard: 'binary' | 'decimal' = 'binary';

  if (typeof optionsOrDecimals === 'number') {
    decimals = optionsOrDecimals;
  } else if (typeof optionsOrDecimals === 'object' && optionsOrDecimals !== null) {
    if (optionsOrDecimals.decimals !== undefined) decimals = optionsOrDecimals.decimals;
    if (optionsOrDecimals.standard !== undefined) standard = optionsOrDecimals.standard;
  }

  const dm = decimals < 0 ? 0 : decimals;

  if (standard === 'decimal') {
    const k = 1000;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const unitIndex = Math.min(i, sizes.length - 1);
    return `${parseFloat((bytes / Math.pow(k, unitIndex)).toFixed(dm))} ${sizes[unitIndex]}`;
  }

  const k = 1024;
  const sizes = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const unitIndex = Math.min(i, sizes.length - 1);
  return `${parseFloat((bytes / Math.pow(k, unitIndex)).toFixed(dm))} ${sizes[unitIndex]}`;
}

export function formatDualBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 B (0 B)';
  const binary = formatBytes(bytes, { decimals, standard: 'binary' });
  const decimal = formatBytes(bytes, { decimals, standard: 'decimal' });
  return `${binary} (${decimal})`;
}

function mapResourceItem(item: StorageResourceItem): StorageResource {
  const isLinked = item.status === 'linked';
  return {
    id: item.videoSourceId || item.key,
    key: item.key,
    filename: item.filename,
    sizeBytes: item.sizeBytes,
    lastModified: item.lastModified,
    status: item.status,
    isLoneSource: item.isLoneSource,
    videoSource:
      isLinked && item.videoSourceId
        ? {
            id: item.videoSourceId,
            label: item.label || '',
            quality: item.quality || '',
            episodeId: item.episodeId || '',
          }
        : undefined,
    episode:
      isLinked && item.episodeId
        ? {
            id: item.episodeId,
            title: item.episodeTitle || '',
            episodeNumber: item.episodeOrder ?? 1,
            seasonNumber: item.seasonNumber ?? 1,
            seriesId: item.seriesId || '',
            seriesTitle: item.seriesTitle || '',
            sourceCount: item.isLoneSource ? 1 : 2,
          }
        : undefined,
  };
}

export async function fetchStorageMetrics(providerId?: string): Promise<StorageMetrics> {
  const query = providerId ? { providerId } : undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (api.storage.metrics as any).get({
    $query: query,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (res.data as any)?.data as StorageMetrics | undefined;
  if (res.error || !data) {
    throw new Error(extractErrorMessage(res.error, 'Failed to fetch storage metrics'));
  }

  return data;
}

export function storageMetricsQueryOptions(providerId?: string) {
  return queryOptions({
    queryKey: ['storage', 'metrics', providerId],
    queryFn: () => fetchStorageMetrics(providerId),
  });
}

export async function fetchStorageResources(
  params: StorageResourcesQuery = {}
): Promise<StorageResourcesResponse> {
  const query: Record<string, string> = {};
  if (params.providerId) query.providerId = params.providerId;
  if (params.status) query.status = params.status;
  if (params.search) query.search = params.search;
  if (params.sortBy) query.sortBy = params.sortBy;
  if (params.sortOrder) query.sortOrder = params.sortOrder;
  if (params.page) query.page = String(params.page);
  if (params.limit) query.limit = String(params.limit);

  const res = await api.storage.resources.get({
    $query: query as {
      providerId?: string;
      status?: string;
      search?: string;
      sortBy?: string;
      sortOrder?: string;
      page?: string;
      limit?: string;
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (res.data as any)?.data as StorageResourcesResponseData | undefined;
  if (res.error || !data) {
    throw new Error(extractErrorMessage(res.error, 'Failed to fetch storage resources'));
  }

  return {
    data: (data.items || []).map(mapResourceItem),
    pagination: {
      page: data.page,
      limit: data.limit,
      total: data.total,
      totalPages: data.totalPages,
    },
  };
}

export function storageResourcesQueryOptions(params: StorageResourcesQuery = {}) {
  return queryOptions({
    queryKey: ['storage', 'resources', params],
    queryFn: () => fetchStorageResources(params),
  });
}

export async function refreshStorageScan(providerId?: string): Promise<{ count: number; totalBytes: number }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (api.storage.scan as any).post(providerId ? { providerId } : {});

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (res.data as any)?.data as { count: number; totalBytes: number } | undefined;
  if (res.error || !data) {
    throw new Error(extractErrorMessage(res.error, 'Failed to refresh storage scan'));
  }

  return data;
}

export async function updateStorageLimit(
  limitGb: number,
  providerId?: string
): Promise<{ limitGb: number; limitBytes: number }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (api.storage.limit as any).put({ limitGb, providerId });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (res.data as any)?.data as StorageLimitUpdateResponseData | undefined;
  if (res.error || !data) {
    throw new Error(extractErrorMessage(res.error, 'Failed to update storage limit'));
  }

  return data;
}

export async function updateSourceMetadata(
  id: string,
  input: StorageUpdateSourceMetadataRequest
): Promise<VideoSourceMetadata> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (api.storage.resources as any)[id].patch(input);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = (res.data as any)?.data;
  if (res.error || !raw) {
    throw new Error(extractErrorMessage(res.error, 'Failed to update source metadata'));
  }

  return {
    id: raw.id,
    label: raw.label,
    quality: raw.quality ?? '',
    episodeId: raw.episodeId,
  };
}

export async function attachOrphanFile(
  input: StorageAttachRequest
): Promise<VideoSourceMetadata> {
  const res = await api.storage.resources.attach.post(input);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = (res.data as any)?.data;
  if (res.error || !raw) {
    throw new Error(extractErrorMessage(res.error, 'Failed to attach orphaned file'));
  }

  return {
    id: raw.id,
    label: raw.label,
    quality: raw.quality ?? '',
    episodeId: raw.episodeId,
  };
}

export async function deleteStorageResources(
  keys: string[],
  providerId?: string
): Promise<BatchDeleteResponse> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (api.storage.resources as any).delete.post({ keys, providerId });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (res.data as any)?.data as StorageDeleteResponseData | undefined;
  if (res.error || !data) {
    throw new Error(extractErrorMessage(res.error, 'Failed to delete storage resources'));
  }

  return {
    deletedKeys: data.deletedKeys,
    reclaimedBytes: data.reclaimedBytes,
  };
}

export async function purgeOrphanFiles(providerId?: string): Promise<BatchDeleteResponse> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (api.storage.resources as any)['purge-orphans'].post(providerId ? { providerId } : {});

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (res.data as any)?.data as StoragePurgeOrphansResponseData | undefined;
  if (res.error || !data) {
    throw new Error(extractErrorMessage(res.error, 'Failed to purge orphaned files'));
  }

  return {
    deletedKeys: data.deletedKeys,
    reclaimedBytes: data.reclaimedBytes,
  };
}

export async function getStoragePreviewUrl(key: string, providerId?: string): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (api.storage.resources as any)['preview-url'].get({
    $query: { key, providerId },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (res.data as any)?.data as StoragePreviewUrlResponseData | undefined;
  if (res.error || !data) {
    throw new Error(extractErrorMessage(res.error, 'Failed to get preview URL'));
  }

  return data.previewUrl;
}

// -------------------------------------------------------------
// Storage Provider Management APIs
// -------------------------------------------------------------

export async function fetchStorageProviders(): Promise<StorageProviderItem[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (api.storage as any).providers.get();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (res.data as any)?.data as StorageProviderItem[] | undefined;
  if (res.error || !data) {
    throw new Error(extractErrorMessage(res.error, 'Failed to fetch storage providers'));
  }

  return data;
}

export function storageProvidersQueryOptions() {
  return queryOptions({
    queryKey: ['storage', 'providers'],
    queryFn: fetchStorageProviders,
  });
}

export async function createStorageProvider(
  input: CreateStorageProviderRequest
): Promise<StorageProviderItem> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (api.storage as any).providers.post(input);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (res.data as any)?.data as StorageProviderItem | undefined;
  if (res.error || !data) {
    throw new Error(extractErrorMessage(res.error, 'Failed to create storage provider'));
  }

  return data;
}

export async function updateStorageProvider(
  id: string,
  input: UpdateStorageProviderRequest
): Promise<StorageProviderItem> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (api.storage as any).providers[id].put(input);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (res.data as any)?.data as StorageProviderItem | undefined;
  if (res.error || !data) {
    throw new Error(extractErrorMessage(res.error, 'Failed to update storage provider'));
  }

  return data;
}

export async function deleteStorageProvider(id: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (api.storage as any).providers[id].delete();

  if (res.error) {
    throw new Error(extractErrorMessage(res.error, 'Failed to delete storage provider'));
  }
}

export async function testStorageProviderConnection(
  input: TestStorageProviderRequest
): Promise<TestStorageProviderResponseData> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (api.storage as any).providers.test.post(input);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (res.data as any)?.data as TestStorageProviderResponseData | undefined;
  if (res.error || !data) {
    throw new Error(extractErrorMessage(res.error, 'Connection test failed'));
  }

  return data;
}
