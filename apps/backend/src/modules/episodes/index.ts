import type { DbClient } from "@repo/db";
import type { S3StorageService, StorageProviderRegistry } from "@repo/media-service";
export interface EpisodeServiceOptions {
  db: DbClient;
  s3StorageService?: S3StorageService;
  storageProviderRegistry?: StorageProviderRegistry;
}

export * from "./internal/archive-staging";
export * from "./internal/archive-extractor";
export * from "./internal/archive-matcher";
export * from "./internal/ingest-service";
export { createEpisodeRepository } from "./internal/catalog/repository";
export type {
  EpisodeListParams,
  EpisodeListResult,
  EpisodeOrderUpdateInput,
  EpisodeRepository,
  EpisodeRepositoryOptions,
  EpisodeUpsertInput,
  EpisodeWithVideoSources,
  UpdateEpisodeInput,
} from "./internal/catalog/types";
export {
  ArchiveExtractionError,
  ArchivePasswordRequiredError,
  EpisodeNotFoundError,
  InvalidArchivePasswordError,
  VideoSourceNotFoundError,
} from "./internal/errors";
