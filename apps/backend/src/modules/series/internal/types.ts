import type { DbClient } from "@repo/db";
import type { S3StorageService, StorageProviderRegistry } from "@repo/media-service";

export interface SeriesServiceOptions {
  db: DbClient;
  s3StorageService?: S3StorageService;
  storageProviderRegistry?: StorageProviderRegistry;
}

export interface ArchiveIngestSubsystemLogger {
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

export interface ArchiveIngestSubsystemOptions {
  db: DbClient;
  s3StorageService?: S3StorageService;
  storageProviderRegistry?: StorageProviderRegistry;
  stagingBaseDir?: string;
  logger?: ArchiveIngestSubsystemLogger;
  sweeperIntervalMs?: number;
}

export interface ArchiveIngestSubsystem {
  jobService: import("./archive-ingest/archive-ingest-job-service").ArchiveIngestJobService;
  stagingBaseDir: string;
  stop: () => void;
}

export type {
  SeriesListParams,
  SeriesListResult,
  SeriesRepository,
  SeriesRepositoryOptions,
  SeriesUpsertInput,
  SeriesWithEpisodes,
  SeriesWithMetadata,
  SeriesWithSeasons,
  HomeFeedHero,
  HomeFeedPayload,
  HomeFeedRow,
  RecentlyAddedEpisode,
  SeasonWithEpisodes,
  UpdateSeriesInput,
} from "./catalog/repository";
