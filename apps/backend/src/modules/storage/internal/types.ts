import type { VideoSourceRow } from "@repo/db";
import type {
  S3StorageService,
  StorageProviderRegistry,
} from "@repo/media-service";
import type {
  CreateStorageProviderRequest,
  MinioSpinUpRequest,
  MinioSpinUpResponseData,
  MinioStatusResponseData,
  StorageMetrics,
  StorageProviderItem,
  StorageResourcesQuery,
  StorageResourcesResponseData,
  StorageSeriesQuery,
  StorageSeriesResponseData,
  TestStorageProviderRequest,
  TestStorageProviderResponseData,
  UpdateStorageProviderRequest,
} from "@repo/contracts";

export interface MinioContainerState {
  isAvailable: boolean;
  isRunning: boolean;
}

export type MinioContainerInspector = (
  containerName?: string,
) => Promise<MinioContainerState>;

export type MinioContainerStarter = (containerName?: string) => Promise<void>;

export type MinioHealthChecker = (endpoint: string) => Promise<void>;

export interface MinioBucketProvisionerInput {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
}

export type MinioBucketProvisioner = (
  input: MinioBucketProvisionerInput,
) => Promise<void>;

export interface MinioDeps {
  minioInspector?: MinioContainerInspector;
  minioContainerStarter?: MinioContainerStarter;
  minioHealthChecker?: MinioHealthChecker;
  minioBucketProvisioner?: MinioBucketProvisioner;
}

export interface StorageOverrides extends MinioDeps {
  service?: StorageService | null;
  usageProvider?: Pick<StorageService, "getTotalUsedBytes"> | null;
}

export interface StorageServiceOptions extends MinioDeps {
  s3StorageService?: S3StorageService;
  storageProviderRegistry?: StorageProviderRegistry;
  cacheTtlMs?: number;
}

export interface StorageService {
  // Scoped storage management
  getMetrics(providerId?: string): Promise<StorageMetrics>;
  getTotalUsedBytes(): Promise<number | null>;
  getResources(
    query?: StorageResourcesQuery,
  ): Promise<StorageResourcesResponseData>;
  getSeries(query?: StorageSeriesQuery): Promise<StorageSeriesResponseData>;
  scan(
    force?: boolean,
    providerId?: string,
  ): Promise<{ count: number; totalBytes: number }>;
  updateLimit(
    limitGb: number,
    providerId?: string,
  ): Promise<{ limitGb: number; limitBytes: number }>;
  updateSourceMetadata(
    videoSourceId: string,
    input: { label?: string; quality?: string | null },
  ): Promise<VideoSourceRow>;
  attachOrphan(input: {
    key: string;
    episodeId: string;
    label?: string;
    quality?: string | null;
    providerId?: string;
  }): Promise<VideoSourceRow>;
  deleteResources(
    keys: string[],
    providerId?: string,
  ): Promise<{
    deletedKeys: string[];
    reclaimedBytes: number;
    deletedSourcesCount: number;
  }>;
  purgeOrphans(providerId?: string): Promise<{
    deletedKeys: string[];
    reclaimedBytes: number;
  }>;
  getPreviewUrl(
    key: string,
    providerId?: string,
  ): Promise<{ previewUrl: string }>;
  invalidateCache(providerId?: string): void;

  // Provider CRUD & verification
  listProviders(): Promise<StorageProviderItem[]>;
  getProvider(id: string): Promise<StorageProviderItem>;
  createProvider(
    input: CreateStorageProviderRequest,
  ): Promise<StorageProviderItem>;
  updateProvider(
    id: string,
    input: UpdateStorageProviderRequest,
  ): Promise<StorageProviderItem>;
  deleteProvider(id: string): Promise<void>;
  testProvider(
    input: TestStorageProviderRequest,
  ): Promise<TestStorageProviderResponseData>;
  getMinioStatus(): Promise<MinioStatusResponseData>;
  spinUpMinio(input: MinioSpinUpRequest): Promise<MinioSpinUpResponseData>;
}
