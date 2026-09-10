/**
 * Shared storage types and API contracts for inspecting, managing,
 * and auditing S3 object storage across backend and frontend.
 */

export type StorageSuccessEnvelope<T> = {
  data: T;
};

export type StorageErrorEnvelope = {
  error: {
    code: string;
    message: string;
  };
};

export interface StorageMetrics {
  totalBytes: number;
  limitBytes: number;
  percentUsed: number;
  totalCount: number;
  linkedCount: number;
  orphanCount: number;
}

export type StorageResourceStatus = "linked" | "orphaned";

export interface StorageResourceItem {
  key: string;
  filename: string;
  sizeBytes: number;
  lastModified: string;
  status: StorageResourceStatus;
  videoSourceId: string | null;
  label: string | null;
  quality: string | null;
  episodeId: string | null;
  episodeTitle: string | null;
  episodeOrder: number | null;
  seasonId: string | null;
  seasonNumber: number | null;
  seasonTitle: string | null;
  seriesId: string | null;
  seriesTitle: string | null;
  isLoneSource: boolean;
}

export interface StorageResourcesQuery {
  status?: "all" | "linked" | "orphaned";
  search?: string;
  sortBy?: "size" | "date" | "name";
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number;
}

export interface StorageResourcesResponseData {
  items: StorageResourceItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface StorageLimitUpdateRequest {
  limitGb: number;
}

export interface StorageLimitUpdateResponseData {
  limitGb: number;
  limitBytes: number;
}

export interface StorageUpdateSourceMetadataRequest {
  label?: string;
  quality?: string | null;
}

export interface StorageAttachRequest {
  key: string;
  episodeId: string;
  label?: string;
  quality?: string | null;
}

export interface StorageDeleteRequest {
  keys: string[];
}

export interface StorageDeleteResponseData {
  deletedKeys: string[];
  reclaimedBytes: number;
  deletedSourcesCount: number;
}

export interface StoragePurgeOrphansResponseData {
  deletedKeys: string[];
  reclaimedBytes: number;
}

export interface StoragePreviewUrlResponseData {
  previewUrl: string;
}

export type StorageMetricsResponse = StorageSuccessEnvelope<StorageMetrics>;
export type StorageResourcesResponse = StorageSuccessEnvelope<StorageResourcesResponseData>;
export type StorageLimitUpdateResponse = StorageSuccessEnvelope<StorageLimitUpdateResponseData>;
export type StorageDeleteResponse = StorageSuccessEnvelope<StorageDeleteResponseData>;
export type StoragePurgeOrphansResponse = StorageSuccessEnvelope<StoragePurgeOrphansResponseData>;
export type StoragePreviewUrlResponse = StorageSuccessEnvelope<StoragePreviewUrlResponseData>;
