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
  providerId?: string;
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
  providerId?: string;
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
  providerId?: string;
  key: string;
  episodeId: string;
  label?: string;
  quality?: string | null;
}

export interface StorageDeleteRequest {
  providerId?: string;
  keys: string[];
}

export interface StorageDeleteResponseData {
  deletedKeys: string[];
  reclaimedBytes: number;
  deletedSourcesCount: number;
}

export interface StoragePurgeOrphansRequest {
  providerId?: string;
}

export interface StoragePurgeOrphansResponseData {
  deletedKeys: string[];
  reclaimedBytes: number;
}

export interface StorageScanRequest {
  providerId?: string;
}

export interface StoragePreviewUrlResponseData {
  previewUrl: string;
}

export type StorageProviderType =
  | "backblaze"
  | "cloudflare_r2"
  | "aws_s3"
  | "minio"
  | "wasabi"
  | "custom";

export interface StorageProviderItem {
  id: string;
  name: string;
  providerType: StorageProviderType;
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyIdMasked: string;
  publicBaseUrl: string | null;
  forcePathStyle: boolean;
  storageLimitGb: number;
  isDefault: boolean;
  isEnabled: boolean;
  linkedSourcesCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStorageProviderRequest {
  name: string;
  providerType: StorageProviderType;
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl?: string | null;
  forcePathStyle?: boolean;
  storageLimitGb?: number;
  isDefault?: boolean;
  isEnabled?: boolean;
}

export interface UpdateStorageProviderRequest {
  name?: string;
  providerType?: StorageProviderType;
  endpoint?: string;
  region?: string;
  bucket?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  publicBaseUrl?: string | null;
  forcePathStyle?: boolean;
  storageLimitGb?: number;
  isDefault?: boolean;
  isEnabled?: boolean;
}

export interface TestStorageProviderRequest {
  providerId?: string;
  endpoint?: string;
  region?: string;
  bucket?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  forcePathStyle?: boolean;
}

export interface TestStorageProviderResponseData {
  success: boolean;
  message?: string;
  latencyMs?: number;
}

export type StorageMetricsResponse = StorageSuccessEnvelope<StorageMetrics>;
export type StorageResourcesResponse = StorageSuccessEnvelope<StorageResourcesResponseData>;
export type StorageLimitUpdateResponse = StorageSuccessEnvelope<StorageLimitUpdateResponseData>;
export type StorageDeleteResponse = StorageSuccessEnvelope<StorageDeleteResponseData>;
export type StoragePurgeOrphansResponse = StorageSuccessEnvelope<StoragePurgeOrphansResponseData>;
export type StoragePreviewUrlResponse = StorageSuccessEnvelope<StoragePreviewUrlResponseData>;
export type StorageProvidersResponse = StorageSuccessEnvelope<StorageProviderItem[]>;
export type StorageProviderResponse = StorageSuccessEnvelope<StorageProviderItem>;
export type TestStorageProviderResponse = StorageSuccessEnvelope<TestStorageProviderResponseData>;
