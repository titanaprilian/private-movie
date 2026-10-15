import type { DbClient } from "@repo/db";
import type {
  S3StorageService,
  StorageProviderRegistry,
} from "@repo/media-service";

export interface SeriesServiceOptions {
  db: DbClient;
  s3StorageService?: S3StorageService;
  storageProviderRegistry?: StorageProviderRegistry;
}

export type {
  ArchiveIngestSubsystem,
  ArchiveIngestSubsystemLogger,
  ArchiveIngestSubsystemOptions,
} from "./archive-ingest/services/subsystem";

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
} from "./catalog/types";
