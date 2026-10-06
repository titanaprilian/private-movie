import type { DbClient } from "@repo/db";
import type { S3StorageService, StorageProviderRegistry } from "@repo/media-service";

export interface SeriesServiceOptions {
  db: DbClient;
  s3StorageService?: S3StorageService;
  storageProviderRegistry?: StorageProviderRegistry;
}

export * from "./internal/archive-ingest";
export * from "./internal/google-drive-url";
export * from "./internal/seven-zip-extractor";
