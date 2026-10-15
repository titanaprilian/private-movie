import type { DbClient } from "@repo/db";
import type { S3StorageService, StorageProviderRegistry } from "@repo/media-service";

export interface SeriesServiceOptions {
  db: DbClient;
  s3StorageService?: S3StorageService;
  storageProviderRegistry?: StorageProviderRegistry;
}

export * from "./internal/archive-ingest/repository";
export * from "./internal/archive-ingest/types";
export * from "./internal/archive-ingest/services/extractor";
export * from "./internal/archive-ingest/services/job";
export * from "./internal/archive-ingest/services/subsystem";
export * from "./internal/google-drive-url";
