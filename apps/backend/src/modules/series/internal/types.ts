import type { DbClient } from "@repo/db";
import type { S3StorageService, StorageProviderRegistry } from "@repo/media-service";
import type { BrowserFn } from "@repo/media-scraper";
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

export type VideoSource = "otakudesu" | "dramula";

export interface TmdbImageItem {
  file_path: string;
  vote_average?: number | null;
  iso_639_1?: string | null;
  [key: string]: unknown;
}

export interface TmdbImagesResponse {
  logos?: TmdbImageItem[];
  [key: string]: unknown;
}

export interface TmdbSeasonEpisodeItem {
  id?: number;
  episode_number: number;
  name?: string | null;
  overview?: string | null;
  runtime?: number | null;
  still_path?: string | null;
  vote_average?: number | null;
  air_date?: string | null;
  season_number?: number;
  [key: string]: unknown;
}

export interface TmdbSeasonResponse {
  id?: number;
  name?: string;
  overview?: string;
  poster_path?: string | null;
  season_number?: number;
  episodes?: TmdbSeasonEpisodeItem[];
  [key: string]: unknown;
}

export interface TmdbSeriesSeasonMeta {
  id?: number;
  season_number: number;
  name?: string | null;
  overview?: string | null;
  poster_path?: string | null;
  air_date?: string | null;
  episode_count?: number;
}

export interface TmdbSeriesDetailsResponse {
  id: number;
  name?: string;
  title?: string;
  overview?: string | null;
  poster_path?: string | null;
  backdrop_path?: string | null;
  first_air_date?: string | null;
  release_date?: string | null;
  vote_average?: number | null;
  status?: string | null;
  runtime?: number | null;
  genres?: Array<{ id: number; name: string }>;
  seasons?: TmdbSeriesSeasonMeta[];
  [key: string]: unknown;
}

export interface TmdbEpisodeDetails {
  id?: number;
  episode_number: number;
  name?: string | null;
  overview?: string | null;
  runtime?: number | null;
  still_path?: string | null;
  vote_average?: number | null;
  air_date?: string | null;
  [key: string]: unknown;
}

export interface TmdbSeasonDetailsResponse {
  id?: number;
  season_number?: number;
  name?: string | null;
  overview?: string | null;
  poster_path?: string | null;
  air_date?: string | null;
  episodes?: TmdbEpisodeDetails[];
  [key: string]: unknown;
}

export interface TmdbSeasonFullData {
  seasonNumber: number;
  name: string;
  overview: string | null;
  posterPath: string | null;
  airDate: string | null;
  episodes: TmdbEpisodeDetails[];
}

export interface TmdbSeriesFullData {
  tmdbId: number;
  type: "tv" | "movie";
  title: string;
  description: string | null;
  posterPath: string | null;
  backdropPath: string | null;
  logoUrl: string | null;
  firstAirDate: string | null;
  voteAverage: number | null;
  genres: string[];
  seasons: TmdbSeasonFullData[];
}

export interface FetchTmdbSeriesOptions {
  type?: "tv" | "movie";
  token?: string;
  fetchFn?: (url: string, init?: RequestInit) => Promise<unknown>;
  logFn?: (message: string) => void;
  sleepFn?: (ms: number) => Promise<void>;
  includeSpecials?: boolean;
}

export interface TmdbImportInput {
  type: "tv" | "movie";
  tmdbId: number;
  includeSpecials?: boolean;
}

export interface TmdbSyncInput {
  type: "tv" | "movie";
  tmdbId: number;
  includeSpecials?: boolean;
  skipGenres?: boolean;
}

export interface TmdbSyncPreviewInput {
  type: "tv" | "movie";
  tmdbId: number;
  includeSpecials?: boolean;
}

export interface EpisodeChangeItem {
  seasonNumber: number;
  episodeNumber: number;
  oldTitle: string;
  newTitle: string;
  oldOverview: string | null;
  newOverview: string | null;
  oldThumbnailUrl: string | null;
  newThumbnailUrl: string | null;
  oldAirDate: string | null;
  newAirDate: string | null;
  titleChanged: boolean;
  overviewChanged: boolean;
  thumbnailChanged: boolean;
  airDateChanged: boolean;
}

export interface SeasonSyncDiffItem {
  seasonNumber: number;
  name: string;
  incomingEpisodeCount: number;
  localEpisodeCount: number;
  diff: number;
  isNewSeason: boolean;
  badgeText: string;
  badgeType: "existing" | "new-eps" | "new-season";
}

export interface TmdbSyncPreviewResult {
  seriesId: string;
  seriesUpdated: boolean;
  series: {
    title: string;
    overview: string | null;
    posterUrl: string | null;
    backdropUrl: string | null;
    logoUrl: string | null;
    rating: string | null;
    releaseDate: string | null;
    genres: string[];
    status?: string | null;
  };
  totalNewEpisodes: number;
  totalNewSeasons: number;
  totalUpdatedEpisodes: number;
  seasonDiffs: SeasonSyncDiffItem[];
  episodeChanges: EpisodeChangeItem[];
}

export interface TmdbPreviewSeason {
  seasonNumber: number;
  name: string;
  episodeCount: number;
  posterUrl: string | null;
}

export interface TmdbPreviewResult {
  title: string;
  overview: string;
  posterUrl: string | null;
  backdropUrl: string | null;
  logoUrl: string | null;
  releaseDate: string | null;
  genres: string[];
  totalSeasons?: number;
  totalEpisodes?: number;
  status?: string | null;
  seasons?: TmdbPreviewSeason[];
  runtime?: number | null;
}

export interface GetTmdbPreviewOptions {
  type?: "tv" | "movie";
  includeSpecials?: boolean;
  token?: string;
  fetchFn?: (url: string, init?: RequestInit) => Promise<unknown>;
}

export interface PreviewScrapeSeriesInput {
  sourceUrl: string;
  source: VideoSource;
  html?: string;
}

export interface PreviewScrapeSeriesResult {
  series: {
    sourceUrl: string;
    source: VideoSource;
    title: string;
    description: string | null;
    posterUrl: string | null;
  };
  episodes: Array<{
    title: string;
    url: string;
    date: string | null;
  }>;
}

export interface PreviewBulkSourcesInput {
  seriesId: string;
  sourceUrl: string;
  source: VideoSource;
  episodeOffset?: number;
  seasonId?: string;
  html?: string;
}

export interface ScrapedBulkEpisodeItem {
  scrapedTitle: string;
  scrapedUrl: string;
  episodeNumber: number | null;
  calculatedOrder: number | null;
  matchedLocalEpisodeId: string | null;
  matchStatus: "matched" | "unmatched";
}

export interface BulkPreviewLocalEpisodeItem {
  id: string;
  title: string;
  order: number;
  seasonId: string;
  seasonNumber: number | null;
  seasonTitle: string;
  hasSources: boolean;
}

export interface PreviewBulkSourcesResult {
  scrapedEpisodes: ScrapedBulkEpisodeItem[];
  localEpisodes: BulkPreviewLocalEpisodeItem[];
}

export interface TmdbHtmlFetchFn {
  get(url: string): Promise<string>;
  post(url: string, body: string): Promise<string>;
}

export interface TmdbServiceOptions {
  fetchHtml?: TmdbHtmlFetchFn;
  browserFn?: BrowserFn;
}

export interface TmdbRepository {
  saveTmdbSeries(data: TmdbSeriesFullData): Promise<SeriesWithSeasons>;
  syncTmdbSeries(
    seriesId: string,
    data: TmdbSeriesFullData,
    options?: { skipGenres?: boolean; type?: "tv" | "movie" }
  ): Promise<void>;
  findById(id: string): Promise<import("@repo/db").SeriesRow | null>;
  findByTmdbId(tmdbId: number): Promise<import("@repo/db").SeriesRow | null>;
  findByIdWithEpisodes(id: string): Promise<SeriesWithEpisodes | null>;
}

export interface TmdbService {
  getTmdbPreview(
    type: "tv" | "movie",
    tmdbId: number,
    includeSpecials?: boolean
  ): Promise<TmdbPreviewResult>;
  importTmdb(input: TmdbImportInput): Promise<SeriesWithSeasons>;
  getTmdbSyncPreview(seriesId: string, input: TmdbSyncPreviewInput): Promise<TmdbSyncPreviewResult>;
  syncTmdb(seriesId: string, input: TmdbSyncInput): Promise<SeriesWithEpisodes>;
  previewScrapeSeries(input: PreviewScrapeSeriesInput): Promise<PreviewScrapeSeriesResult>;
  previewBulkSources(input: PreviewBulkSourcesInput): Promise<PreviewBulkSourcesResult>;
}
