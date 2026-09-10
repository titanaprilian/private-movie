import { queryOptions } from '@tanstack/react-query';
import { getAccessToken } from '@/lib/api';

export interface StorageMetrics {
  totalSizeBytes: number;
  limitSizeBytes: number;
  percentUsed: number;
  totalFiles: number;
  linkedFiles: number;
  orphanedFiles: number;
}

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
}

export interface StorageResourceFilterParams {
  status?: 'all' | 'linked' | 'orphaned';
  search?: string;
  sortBy?: 'size' | 'date' | 'name';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
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

export interface UpdateStorageLimitInput {
  limitGb: number;
}

export interface EditSourceMetadataInput {
  label?: string;
  quality?: string;
}

export interface AttachOrphanInput {
  key: string;
  episodeId: string;
  label?: string;
  quality?: string;
}

export interface BatchDeleteResponse {
  deletedKeys: string[];
  reclaimedBytes: number;
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

function extractErrorMessage(error: unknown, fallback: string): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (typeof (error as any)?.message === 'string') return (error as any).message;
  return fallback;
}

function getAuthHeaders(): Record<string, string> {
  const token = getAccessToken();
  return token ? { authorization: `Bearer ${token}` } : {};
}

export async function fetchStorageMetrics(): Promise<StorageMetrics> {
  const res = await fetch('/api/storage/metrics', {
    headers: getAuthHeaders(),
    credentials: 'include',
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(errText || 'Failed to fetch storage metrics');
  }
  const json = await res.json();
  return (json.data ?? json) as StorageMetrics;
}

export function storageMetricsQueryOptions() {
  return queryOptions({
    queryKey: ['storage', 'metrics'],
    queryFn: fetchStorageMetrics,
  });
}

export async function fetchStorageResources(
  params: StorageResourceFilterParams = {}
): Promise<StorageResourcesResponse> {
  const queryParams = new URLSearchParams();
  if (params.status) queryParams.set('status', params.status);
  if (params.search) queryParams.set('search', params.search);
  if (params.sortBy) queryParams.set('sortBy', params.sortBy);
  if (params.sortOrder) queryParams.set('sortOrder', params.sortOrder);
  if (params.page) queryParams.set('page', String(params.page));
  if (params.limit) queryParams.set('limit', String(params.limit));

  const url = `/api/storage/resources${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  const res = await fetch(url, {
    headers: getAuthHeaders(),
    credentials: 'include',
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(errText || 'Failed to fetch storage resources');
  }
  const json = await res.json();
  if (Array.isArray(json)) {
    return {
      data: json,
      pagination: { page: 1, limit: json.length, total: json.length, totalPages: 1 },
    };
  }
  return json as StorageResourcesResponse;
}

export function storageResourcesQueryOptions(params: StorageResourceFilterParams = {}) {
  return queryOptions({
    queryKey: ['storage', 'resources', params],
    queryFn: () => fetchStorageResources(params),
  });
}

export async function refreshStorageScan(): Promise<{ success: boolean }> {
  const res = await fetch('/api/storage/scan', {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
  });
  if (!res.ok) {
    throw new Error('Failed to refresh storage scan');
  }
  return res.json();
}

export async function updateStorageLimit(limitGb: number): Promise<{ limitGb: number }> {
  const res = await fetch('/api/storage/limit', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ limitGb }),
    credentials: 'include',
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(extractErrorMessage(json, 'Failed to update storage limit'));
  }
  const json = await res.json();
  return (json.data ?? json) as { limitGb: number };
}

export async function updateSourceMetadata(
  id: string,
  input: EditSourceMetadataInput
): Promise<StorageResource> {
  const res = await fetch(`/api/storage/resources/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(input),
    credentials: 'include',
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(extractErrorMessage(json, 'Failed to update source metadata'));
  }
  const json = await res.json();
  return (json.data ?? json) as StorageResource;
}

export async function attachOrphanFile(
  input: AttachOrphanInput
): Promise<StorageResource> {
  const res = await fetch('/api/storage/resources/attach', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(input),
    credentials: 'include',
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(extractErrorMessage(json, 'Failed to attach orphaned file'));
  }
  const json = await res.json();
  return (json.data ?? json) as StorageResource;
}

export async function deleteStorageResources(
  keys: string[]
): Promise<BatchDeleteResponse> {
  const res = await fetch('/api/storage/resources/delete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ keys }),
    credentials: 'include',
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(extractErrorMessage(json, 'Failed to delete storage resources'));
  }
  const json = await res.json();
  return (json.data ?? json) as BatchDeleteResponse;
}

export async function purgeOrphanFiles(): Promise<BatchDeleteResponse> {
  const res = await fetch('/api/storage/resources/purge-orphans', {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(extractErrorMessage(json, 'Failed to purge orphaned files'));
  }
  const json = await res.json();
  return (json.data ?? json) as BatchDeleteResponse;
}

export async function getStoragePreviewUrl(key: string): Promise<string> {
  const res = await fetch(
    `/api/storage/resources/preview-url?key=${encodeURIComponent(key)}`,
    {
      headers: getAuthHeaders(),
      credentials: 'include',
    }
  );
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(extractErrorMessage(json, 'Failed to get preview URL'));
  }
  const json = await res.json();
  return json.url ?? json.data?.url ?? json.data;
}
