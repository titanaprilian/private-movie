import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type { BrowserFn } from "@repo/media-scraper";
import type { S3StorageService } from "./internal/s3/s3-storage-service";
import { createEpisodeRepositoryInternal, type EpisodeWithVideoSources } from "./internal/episodes/repository";
import { createSeasonsRepositoryInternal } from "./internal/seasons/repository";
import { createSeriesRepositoryInternal, type SeriesWithEpisodes, type SeriesWithSeasons } from "./internal/series/repository";
import { createVideoSourceRepositoryInternal } from "./internal/video-sources/repository";
import { createBulkServiceInternal, type PreviewBulkSourcesInput, type PreviewBulkSourcesResult, type SaveBulkSourcesInput, type SaveBulkSourcesResult } from "./internal/bulk/index";
import { createMediaServiceInternal, type MediaServiceOptions, type PreviewScrapeSeriesResult, type PreviewScrapeResult, type SaveEpisodeInput, type SaveMediaInput, type SaveMediaResult } from "./internal/media/index";
import { fetchTmdbSeriesData, saveTmdbSeries, getTmdbPreview, selectBestTmdbLogo, type TmdbImportInput, type TmdbSyncInput, type TmdbSyncPreviewInput, type TmdbSyncPreviewResult, type TmdbPreviewResult } from "./internal/tmdb/service";
import { importTmdb as importTmdbOrchestrator, getTmdbSyncPreview as getTmdbSyncPreviewOrchestrator, syncTmdb as syncTmdbOrchestrator } from "./internal/tmdb/orchestrator";
import { createOngoingScraperService, type BatchOngoingScrapeResult, type OngoingScrapeResult } from "./internal/ongoing/service";

export { createS3StorageService, S3NotConfiguredError, extractS3Key } from "./internal/s3/s3-storage-service";
export { encryptCredential, decryptCredential, maskAccessKeyId } from "./internal/s3/encryption";
export { createStorageProviderRegistry, type StorageProviderRegistry } from "./internal/s3/registry";
export { ensureMinioBucketWithCors, isBucketCorsNotImplementedError, MINIO_DEFAULT_BUCKET, MINIO_DEFAULT_REGION, MINIO_VIDEO_CORS_RULE, type EnsureMinioBucketInput } from "./internal/s3/minio-provision";
export type { S3StorageService, S3StorageServiceOptions, StreamUploadOptions, S3ObjectSummary, ListObjectsOptions, ListObjectsResult, BucketStorageUsage, PurgeDanglingResult, AbortStaleMultipartUploadsOptions, AbortStaleMultipartUploadsResult } from "./internal/s3/s3-storage-service";
export type { BrowserFn, CreateStealthBrowserOptions } from "@repo/media-scraper";
export { normalizePlaybackUrl, normalizeVideoSource, normalizeVideoSources, normalizeVideoSourceSync, normalizeVideoSourcesSync, parseVideoQuality, sortVideoSources } from "./internal/playback/normalization";
export { stripSeasonDescriptors, parseBulkScrapedEpisodeNumber, applySequentialFallback, createBulkServiceInternal } from "./internal/bulk/index";
export type { SequentialFallbackItem, SequentialFallbackTarget, PreviewBulkSourcesInput, PreviewBulkSourcesResult, ScrapedBulkEpisodeItem, BulkPreviewLocalEpisodeItem, BulkSourceItem, BulkSourceItemVideoSource, SaveBulkSourcesInput, SaveBulkSourcesResult } from "./internal/bulk/index";
export { TmdbFetchError, fetchTmdbSeriesData, saveTmdbSeries, getTmdbPreview, selectBestTmdbLogo } from "./internal/tmdb/service";
export type { FetchTmdbSeriesOptions, GetTmdbPreviewOptions, TmdbEpisodeDetails, TmdbImportInput, TmdbSyncInput, TmdbSyncPreviewInput, TmdbSyncPreviewResult, SeasonSyncDiffItem, EpisodeChangeItem, TmdbPreviewResult, TmdbPreviewSeason, TmdbSeasonDetailsResponse, TmdbSeasonEpisodeItem, TmdbSeasonFullData, TmdbSeasonResponse, TmdbSeriesDetailsResponse, TmdbSeriesFullData, TmdbSeriesSeasonMeta, TmdbImageItem, TmdbImagesResponse } from "./internal/tmdb/service";
export { createOngoingScraperService } from "./internal/ongoing/service";
export type { OngoingScraperService, OngoingScraperServiceDependencies, OngoingScrapeResult, BatchOngoingScrapeResult } from "./internal/ongoing/service";
export { defaultFetchFn, EpisodeFetchError, SeriesFetchError, createMediaServiceInternal } from "./internal/media/index";
export type { FetchFn, MediaServiceOptions, PreviewScrapeResult, PreviewScrapeSeriesResult, PreviewScrapeVideoSource, SaveEpisodeInput, SaveMediaEpisodeInput, SaveMediaEpisodeVideoSourceInput, SaveMediaInput, SaveMediaResult, SaveMediaSeriesInput, MediaVideoSource as VideoSource } from "./internal/media/index";
export type { EpisodeRow as SavedEpisode, SeasonRow as SavedSeason, SeriesRow as SavedSeries } from "@repo/db";
export type { EpisodeWithVideoSources };
export type { SeriesWithEpisodes, SeriesWithSeasons, SeasonWithEpisodes, SeriesWithMetadata, HomeFeedHero, HomeFeedRow, HomeFeedPayload, RecentlyAddedEpisode } from "./internal/series/repository";
export { EpisodeNotFoundError, createEpisodeRepositoryInternal } from "./internal/episodes/repository";
export { SeasonNotFoundError, SeasonNotEmptyError, SeasonNotOngoingError, SeasonMissingScraperUrlError, SeasonAlreadyExistsError, createSeasonsRepositoryInternal } from "./internal/seasons/repository";
export type { SeasonUpsertInput, CreateSeasonInput, UpdateSeasonInput } from "./internal/seasons/repository";
export { SeriesNotFoundError, SeriesHighlightWithoutOngoingError, createSeriesRepositoryInternal } from "./internal/series/repository";
export { VideoSourceNotFoundError, createVideoSourceRepositoryInternal } from "./internal/video-sources/repository";
export type { EpisodeUpsertInput, UpdateEpisodeInput, EpisodeOrderUpdateInput, EpisodeListParams, EpisodeListResult, EpisodeRepositoryOptions } from "./internal/episodes/repository";
export type { SeriesUpsertInput, UpdateSeriesInput, SeriesListParams, SeriesListResult, SeriesRepositoryOptions } from "./internal/series/repository";
export type { VideoSourceUpsertInput, UpdateVideoSourceInput, VideoSourceRepositoryOptions } from "./internal/video-sources/repository";
export { EpisodeParseError, EpisodeMissingFieldsError, SeriesParseError, MirrorResolveError } from "@repo/media-scraper";

export interface SaveEpisodeServiceOptions extends MediaServiceOptions {
  fetchHtml?: MediaServiceOptions["fetchHtml"];
  browserFn?: BrowserFn;
  s3StorageService?: S3StorageService;
}
export interface MediaService {
  previewScrape(input: SaveEpisodeInput): Promise<PreviewScrapeResult>;
  previewScrapeSeries(input: SaveEpisodeInput): Promise<PreviewScrapeSeriesResult>;
  previewBulkSources(input: PreviewBulkSourcesInput): Promise<PreviewBulkSourcesResult>;
  saveBulkSources(input: SaveBulkSourcesInput): Promise<SaveBulkSourcesResult>;
  scrapeAndSaveSources(episodeId: string, sourceUrl: string): Promise<EpisodeWithVideoSources>;
  saveMedia(input: SaveMediaInput): Promise<SaveMediaResult>;
  importTmdb(input: TmdbImportInput): Promise<SeriesWithSeasons>;
  getTmdbPreview(type: "tv" | "movie", tmdbId: number, includeSpecials?: boolean): Promise<TmdbPreviewResult>;
  getTmdbSyncPreview(seriesId: string, input: TmdbSyncPreviewInput): Promise<TmdbSyncPreviewResult>;
  syncTmdb(seriesId: string, input: TmdbSyncInput): Promise<SeriesWithEpisodes>;
  syncAndScrapeOngoingSeason(seasonId: string): Promise<OngoingScrapeResult>;
  scrapeAllOngoingSeasons(): Promise<BatchOngoingScrapeResult>;
}
export type SaveEpisodeService = MediaService;
export function createMediaService<THKT extends PgQueryResultHKT, TSchema extends Record<string, unknown> = Record<string, unknown>>(db: PgDatabase<THKT, TSchema>, options?: SaveEpisodeServiceOptions): MediaService {
  const episodeRepository = createEpisodeRepositoryInternal(db, { s3StorageService: options?.s3StorageService });
  const seriesRepository = createSeriesRepositoryInternal(db, { s3StorageService: options?.s3StorageService });
  const videoSourceRepository = createVideoSourceRepositoryInternal(db, { s3StorageService: options?.s3StorageService });
  const fetchHtml = options?.fetchHtml;
  const media = createMediaServiceInternal(db, options);
  const bulkOpts = { s3StorageService: options?.s3StorageService };
  const baseDeps = { seasonsRepository: createSeasonsRepositoryInternal(db), seriesRepository, episodeRepository, videoSourceRepository, fetchHtml: fetchHtml as never, browserFn: options?.browserFn };
  return {
    previewScrape: media.previewScrape,
    previewScrapeSeries: media.previewScrapeSeries,
    async previewBulkSources(this: MediaService, input: PreviewBulkSourcesInput) {
      return createBulkServiceInternal(db, { previewScrapeSeries: (args) => this.previewScrapeSeries({ sourceUrl: args.sourceUrl, source: args.source, html: args.html }) }, bulkOpts).previewBulkSources(input);
    },
    async saveBulkSources(this: MediaService, input: SaveBulkSourcesInput) {
      return createBulkServiceInternal(db, { previewScrapeSeries: (args) => this.previewScrapeSeries({ sourceUrl: args.sourceUrl, source: args.source, html: args.html }) }, bulkOpts).saveBulkSources(input);
    },
    scrapeAndSaveSources: media.scrapeAndSaveSources,
    saveMedia: media.saveMedia,
    importTmdb: (input) => importTmdbOrchestrator(db, input),
    getTmdbPreview: (type, tmdbId, includeSpecials) => getTmdbPreview(tmdbId, { type, includeSpecials }),
    getTmdbSyncPreview: (seriesId, input) => getTmdbSyncPreviewOrchestrator(db, seriesId, input),
    syncTmdb: (seriesId, input) => syncTmdbOrchestrator(db, seriesId, input),
    async syncAndScrapeOngoingSeason(this: MediaService, seasonId: string) {
      return createOngoingScraperService(db, { ...baseDeps, tmdbOrchestrator: this }).syncAndScrapeOngoingSeason(seasonId);
    },
    async scrapeAllOngoingSeasons(this: MediaService) {
      return createOngoingScraperService(db, { ...baseDeps, tmdbOrchestrator: this, ongoingScraper: this }).scrapeAllOngoingSeasons();
    },
  };
}
export const createSaveEpisodeService = createMediaService;
