import type { DbClient } from "@repo/db";
import type { S3StorageService, StorageProviderRegistry } from "@repo/media-service";
export interface EpisodeServiceOptions {
  db: DbClient;
  s3StorageService?: S3StorageService;
  storageProviderRegistry?: StorageProviderRegistry;
}

export {
  ARCHIVE_STAGING_TTL_MS,
  createArchiveStagingSessionId,
  ensureArchiveStagingDir,
  getArchiveStagingBaseDir,
  getArchiveStagingDir,
  pruneExpiredArchiveStagingSessions,
  removeArchiveStagingDir,
} from "./internal/ingest/utils/staging";
export type { PruneStagingSessionsResult } from "./internal/ingest/utils/staging";
export {
  detectArchiveFormat,
  detectArchiveFormatFromBytes,
  extractArchive,
  isSupportedArchiveFilename,
} from "./internal/ingest/utils/extractor";
export type {
  ArchiveExtractionResult,
  ArchiveFormat,
  ArchiveProcessRunner,
  ExtractArchiveOptions,
  ProcessRunResult,
} from "./internal/ingest/utils/extractor";
export {
  VIDEO_EXTENSIONS,
  detectEpisodeNumber,
  detectQuality,
  filterStagedVideoFiles,
  isSampleFile,
  isVideoFile,
  matchArchiveFilesToEpisodes,
} from "./internal/ingest/utils/matcher";
export type { MatchableEpisode, StagedFileEntry } from "./internal/ingest/utils/matcher";
export { IngestService } from "./internal/ingest/service";
export type { IngestServiceOptions, ProgressInfo } from "./internal/ingest/service";
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
