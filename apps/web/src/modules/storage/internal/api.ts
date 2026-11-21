import { queryOptions } from '@tanstack/react-query';
import { api, extractErrorMessage } from '@/lib/api';
import type {
  StorageMetrics,
  StorageResourceItem,
  StorageResourcesQuery,
  StorageResourcesResponseData,
  StorageSeriesItem,
  StorageSeriesQuery,
  StorageSeriesResponseData,
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
  MinioStatusResponseData,
  MinioSpinUpRequest,
  MinioSpinUpResponseData,
} from '@repo/contracts';

export type {
  StorageMetrics,
  StorageResourceItem,
  StorageResourcesQuery,
  StorageResourcesResponseData,
  StorageSeriesItem,
  StorageSeriesQuery,
  StorageSeriesResponseData,
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
  MinioStatusResponseData,
  MinioSpinUpRequest,
  MinioSpinUpResponseData,
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
  seasonId?: string;
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
  } else if (
    typeof optionsOrDecimals === 'object' &&
    optionsOrDecimals !== null
  ) {
    if (optionsOrDecimals.decimals !== undefined)
      decimals = optionsOrDecimals.decimals;
    if (optionsOrDecimals.standard !== undefined)
      standard = optionsOrDecimals.standard;
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
            seasonId: item.seasonId || undefined,
            seriesId: item.seriesId || '',
            seriesTitle: item.seriesTitle || '',
            sourceCount: item.isLoneSource ? 1 : 2,
          }
        : undefined,
  };
}

export async function fetchStorageMetrics(
  providerId?: string
): Promise<StorageMetrics> {
  const res = await api.storage.metrics.get({
    $query: providerId ? { providerId } : {},
  });

  if (res.error || !res.data) {
    throw new Error(
      extractErrorMessage(res.error, 'Failed to fetch storage metrics')
    );
  }

  return res.data.data;
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
  const query: {
    providerId?: string;
    seriesId?: string;
    seasonId?: string;
    status?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: string;
    page?: string;
    limit?: string;
  } = {};
  if (params.providerId) query.providerId = params.providerId;
  if (params.seriesId) query.seriesId = params.seriesId;
  if (params.seasonId) query.seasonId = params.seasonId;
  if (params.status) query.status = params.status;
  if (params.search) query.search = params.search;
  if (params.sortBy) query.sortBy = params.sortBy;
  if (params.sortOrder) query.sortOrder = params.sortOrder;
  if (params.page !== undefined) query.page = String(params.page);
  if (params.limit !== undefined) query.limit = String(params.limit);

  const res = await api.storage.resources.get({
    $query: query,
  });

  if (res.error || !res.data) {
    throw new Error(
      extractErrorMessage(res.error, 'Failed to fetch storage resources')
    );
  }

  const data = res.data.data;

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

export function storageResourcesQueryOptions(
  params: StorageResourcesQuery = {}
) {
  return queryOptions({
    queryKey: ['storage', 'resources', params],
    queryFn: () => fetchStorageResources(params),
  });
}

export async function fetchStorageSeries(
  params: StorageSeriesQuery = {}
): Promise<StorageSeriesResponseData> {
  const res = await api.storage.series.get({
    $query: params.providerId ? { providerId: params.providerId } : {},
  });

  if (res.error || !res.data) {
    throw new Error(
      extractErrorMessage(res.error, 'Failed to fetch storage series')
    );
  }

  return res.data.data;
}

export function storageSeriesQueryOptions(params: StorageSeriesQuery = {}) {
  return queryOptions({
    queryKey: ['storage', 'series', params],
    queryFn: () => fetchStorageSeries(params),
  });
}

export async function refreshStorageScan(
  providerId?: string
): Promise<{ count: number; totalBytes: number }> {
  const res = await api.storage.scan.post(providerId ? { providerId } : {});

  if (res.error || !res.data) {
    throw new Error(
      extractErrorMessage(res.error, 'Failed to refresh storage scan')
    );
  }

  return res.data.data;
}

export async function updateStorageLimit(
  limitGb: number,
  providerId?: string
): Promise<{ limitGb: number; limitBytes: number }> {
  const res = await api.storage.limit.put({ limitGb, providerId });

  if (res.error || !res.data || !('data' in res.data)) {
    throw new Error(
      extractErrorMessage(res.error, 'Failed to update storage limit')
    );
  }

  return res.data.data;
}

export async function updateSourceMetadata(
  id: string,
  input: StorageUpdateSourceMetadataRequest
): Promise<VideoSourceMetadata> {
  const res = await api.storage.resources[id].patch(input);

  if (res.error || !res.data) {
    throw new Error(
      extractErrorMessage(res.error, 'Failed to update source metadata')
    );
  }

  const raw = res.data.data;

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

  if (res.error || !res.data) {
    throw new Error(
      extractErrorMessage(res.error, 'Failed to attach orphaned file')
    );
  }

  const raw = res.data.data;

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
  const res = await api.storage.resources.delete.post({ keys, providerId });

  if (res.error || !res.data || !('data' in res.data)) {
    throw new Error(
      extractErrorMessage(res.error, 'Failed to delete storage resources')
    );
  }

  return {
    deletedKeys: res.data.data.deletedKeys,
    reclaimedBytes: res.data.data.reclaimedBytes,
  };
}

export async function purgeOrphanFiles(
  providerId?: string
): Promise<BatchDeleteResponse> {
  const res = await api.storage.resources['purge-orphans'].post(
    providerId ? { providerId } : {}
  );

  if (res.error || !res.data) {
    throw new Error(
      extractErrorMessage(res.error, 'Failed to purge orphaned files')
    );
  }

  return {
    deletedKeys: res.data.data.deletedKeys,
    reclaimedBytes: res.data.data.reclaimedBytes,
  };
}

export async function getStoragePreviewUrl(
  key: string,
  providerId?: string
): Promise<string> {
  const query: { key: string; providerId?: string } = { key };
  if (providerId) query.providerId = providerId;

  const res = await api.storage.resources['preview-url'].get({
    $query: query,
  });

  if (res.error || !res.data || !('data' in res.data)) {
    throw new Error(
      extractErrorMessage(res.error, 'Failed to get preview URL')
    );
  }

  return res.data.data.previewUrl;
}

// -------------------------------------------------------------
// Storage Provider Management APIs
// -------------------------------------------------------------

export async function fetchStorageProviders(): Promise<StorageProviderItem[]> {
  const res = await api.storage.providers.get();

  if (res.error || !res.data) {
    throw new Error(
      extractErrorMessage(res.error, 'Failed to fetch storage providers')
    );
  }

  return res.data.data;
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
  const res = await api.storage.providers.post(input);

  if (res.error || !res.data) {
    throw new Error(
      extractErrorMessage(res.error, 'Failed to create storage provider')
    );
  }

  return res.data.data;
}

export async function updateStorageProvider(
  id: string,
  input: UpdateStorageProviderRequest
): Promise<StorageProviderItem> {
  const res = await api.storage.providers[id].put(input);

  if (res.error || !res.data) {
    throw new Error(
      extractErrorMessage(res.error, 'Failed to update storage provider')
    );
  }

  return res.data.data;
}

export async function deleteStorageProvider(id: string): Promise<void> {
  const res = await api.storage.providers[id].delete();

  if (res.error || !res.data) {
    throw new Error(
      extractErrorMessage(res.error, 'Failed to delete storage provider')
    );
  }
}

export async function testStorageProviderConnection(
  input: TestStorageProviderRequest
): Promise<TestStorageProviderResponseData> {
  const res = await api.storage.providers.test.post(input);

  if (res.error || !res.data) {
    throw new Error(extractErrorMessage(res.error, 'Connection test failed'));
  }

  return res.data.data;
}

export type MinioStatusState =
  'ready' | 'stopped' | 'not-configured' | 'unavailable';

export function resolveMinioStatusState(
  status: MinioStatusResponseData
): MinioStatusState {
  if (!status.isAvailable) return 'unavailable';
  if (status.isRunning && status.isConfigured) return 'ready';
  if (status.isRunning && !status.isConfigured) return 'not-configured';
  if (!status.isRunning && status.isConfigured) return 'stopped';
  return 'not-configured';
}

export async function fetchMinioStatus(): Promise<MinioStatusResponseData> {
  const res = await api.storage.minio.status.get();

  if (res.error || !res.data) {
    throw new Error(
      extractErrorMessage(res.error, 'Failed to fetch MinIO status')
    );
  }

  return res.data.data;
}

export function minioStatusQueryOptions() {
  return queryOptions({
    queryKey: ['storage', 'minio', 'status'],
    queryFn: fetchMinioStatus,
  });
}

export const DEFAULT_MINIO_BUCKET = 'private-movie-videos';
export const DEFAULT_MINIO_PORT = 9000;

export function deriveMinioEndpoint(port: number = DEFAULT_MINIO_PORT): string {
  const hostname =
    typeof window !== 'undefined' && window.location?.hostname
      ? window.location.hostname
      : 'localhost';
  return `http://${hostname}:${port}`;
}

const MINIO_SECRET_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export function generateMinioSecret(length = 24): string {
  const cryptoObj =
    typeof globalThis !== 'undefined'
      ? (globalThis as { crypto?: Crypto }).crypto
      : undefined;
  if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
    const bytes = new Uint32Array(length);
    cryptoObj.getRandomValues(bytes);
    return Array.from(
      bytes,
      (b) => MINIO_SECRET_ALPHABET[b % MINIO_SECRET_ALPHABET.length]
    ).join('');
  }
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out +=
      MINIO_SECRET_ALPHABET[
        Math.floor(Math.random() * MINIO_SECRET_ALPHABET.length)
      ];
  }
  return out;
}

export async function spinMinioUp(
  input: MinioSpinUpRequest = {}
): Promise<MinioSpinUpResponseData> {
  const res = await api.storage.minio['spin-up'].post(input);

  if (res.error || !res.data) {
    throw new Error(extractErrorMessage(res.error, 'Failed to spin up MinIO'));
  }

  return res.data.data;
}
