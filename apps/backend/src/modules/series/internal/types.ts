import type { DbClient } from "@repo/db";
import type { S3StorageService, StorageProviderRegistry } from "@repo/media-service";
import type {
  SeriesWithEpisodes,
  SeriesWithSeasons,
} from "./catalog/repository";

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
export type { SeriesWithEpisodes as TmdbSeriesWithEpisodes, SeriesWithSeasons as TmdbSeriesWithSeasons };

// TMDB sub-feature types live in `internal/tmdb/types.ts` (colocated per Tier 3).
// Re-exported here for backwards compatibility with existing import sites.
export type {
  VideoSource,
  TmdbImageItem,
  TmdbImagesResponse,
  TmdbSeasonEpisodeItem,
  TmdbSeasonResponse,
  TmdbSeriesSeasonMeta,
  TmdbSeriesDetailsResponse,
  TmdbEpisodeDetails,
  TmdbSeasonDetailsResponse,
  TmdbSeasonFullData,
  TmdbSeriesFullData,
  FetchTmdbSeriesOptions,
  TmdbImportInput,
  TmdbSyncInput,
  TmdbSyncPreviewInput,
  EpisodeChangeItem,
  SeasonSyncDiffItem,
  TmdbSyncPreviewResult,
  TmdbPreviewSeason,
  TmdbPreviewResult,
  GetTmdbPreviewOptions,
  PreviewScrapeSeriesInput,
  PreviewScrapeSeriesResult,
  PreviewBulkSourcesInput,
  ScrapedBulkEpisodeItem,
  BulkPreviewLocalEpisodeItem,
  PreviewBulkSourcesResult,
  TmdbHtmlFetchFn,
  TmdbServiceOptions,
  TmdbRepository,
  TmdbService,
} from "./tmdb/types";
