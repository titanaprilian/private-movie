import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { and, asc, eq, inArray, ne } from "drizzle-orm";
import { seasons, series, type SeriesRow } from "@repo/db";
import {
  MediaScraper,
  EpisodeParseError,
  extractDirectVideoSources,
  parseEpisodeOrder,
  resolveMirrors,
  type ParsedMetadata,
  type ParsedVideoSource,
  type ParsedMirrorPayload,
  type ParsedAjaxActions,
  type ParsedDownloadLink,
  type FetchFn as ScraperFetchFn,
  type BrowserFn,
  type CreateStealthBrowserOptions,
} from "@repo/media-scraper";

import {
  createS3StorageService,
  extractS3Key,
  S3NotConfiguredError,
  type S3StorageService,
  type S3StorageServiceOptions,
  type StreamUploadOptions,
  type S3ObjectSummary,
  type ListObjectsOptions,
  type ListObjectsResult,
  type BucketStorageUsage,
  type PurgeDanglingResult,
  type AbortStaleMultipartUploadsOptions,
  type AbortStaleMultipartUploadsResult,
} from "./internal/s3/s3-storage-service";
export { createS3StorageService, S3NotConfiguredError, extractS3Key };
export {
  encryptCredential,
  decryptCredential,
  maskAccessKeyId,
} from "./internal/s3/encryption";
export {
  createStorageProviderRegistry,
  type StorageProviderRegistry,
} from "./internal/s3/registry";
export {
  ensureMinioBucketWithCors,
  isBucketCorsNotImplementedError,
  MINIO_DEFAULT_BUCKET,
  MINIO_DEFAULT_REGION,
  MINIO_VIDEO_CORS_RULE,
  type EnsureMinioBucketInput,
} from "./internal/s3/minio-provision";
export type {
  S3StorageService,
  S3StorageServiceOptions,
  StreamUploadOptions,
  S3ObjectSummary,
  ListObjectsOptions,
  ListObjectsResult,
  BucketStorageUsage,
  PurgeDanglingResult,
  AbortStaleMultipartUploadsOptions,
  AbortStaleMultipartUploadsResult,
};

export type { BrowserFn, CreateStealthBrowserOptions };
import {
  normalizePlaybackUrl,
  normalizeVideoSource,
  normalizeVideoSources,
  normalizeVideoSourceSync,
  normalizeVideoSourcesSync,
  parseVideoQuality,
  sortVideoSources,
} from "./internal/playback/normalization";
export {
  normalizePlaybackUrl,
  normalizeVideoSource,
  normalizeVideoSources,
  normalizeVideoSourceSync,
  normalizeVideoSourcesSync,
  parseVideoQuality,
  sortVideoSources,
};
import { createEpisodeRepositoryInternal, EpisodeNotFoundError, type EpisodeWithVideoSources } from "./internal/episodes/repository";
import { createSeasonsRepositoryInternal, SeasonNotFoundError } from "./internal/seasons/repository";
import { createSeriesRepositoryInternal, SeriesNotFoundError } from "./internal/series/repository";
import { createVideoSourceRepositoryInternal, VideoSourceNotFoundError, type VideoSourceUpsertInput, type UpdateVideoSourceInput, type VideoSourceRepositoryOptions } from "./internal/video-sources/repository";
import {
  createBulkServiceInternal,
  stripSeasonDescriptors,
  parseBulkScrapedEpisodeNumber,
  applySequentialFallback,
  type SequentialFallbackItem,
  type SequentialFallbackTarget,
  type PreviewBulkSourcesInput,
  type PreviewBulkSourcesResult,
  type ScrapedBulkEpisodeItem,
  type BulkPreviewLocalEpisodeItem,
  type BulkSourceItem,
  type BulkSourceItemVideoSource,
  type SaveBulkSourcesInput,
  type SaveBulkSourcesResult,
} from "./internal/bulk/index";
export {
  stripSeasonDescriptors,
  parseBulkScrapedEpisodeNumber,
  applySequentialFallback,
  createBulkServiceInternal,
};
export type {
  SequentialFallbackItem,
  SequentialFallbackTarget,
  PreviewBulkSourcesInput,
  PreviewBulkSourcesResult,
  ScrapedBulkEpisodeItem,
  BulkPreviewLocalEpisodeItem,
  BulkSourceItem,
  BulkSourceItemVideoSource,
  SaveBulkSourcesInput,
  SaveBulkSourcesResult,
};
import {
  fetchTmdbSeriesData,
  saveTmdbSeries,
  getTmdbPreview,
  selectBestTmdbLogo,
  TmdbFetchError,
  type FetchTmdbSeriesOptions,
  type GetTmdbPreviewOptions,
  type TmdbEpisodeDetails,
  type TmdbImportInput,
  type TmdbSyncInput,
  type TmdbSyncPreviewInput,
  type TmdbSyncPreviewResult,
  type SeasonSyncDiffItem,
  type EpisodeChangeItem,
  type TmdbPreviewResult,
  type TmdbPreviewSeason,
  type TmdbSeasonDetailsResponse,
  type TmdbSeasonEpisodeItem,
  type TmdbSeasonFullData,
  type TmdbSeasonResponse,
  type TmdbSeriesDetailsResponse,
  type TmdbSeriesFullData,
  type TmdbSeriesSeasonMeta,
  type TmdbImageItem,
  type TmdbImagesResponse,
} from "./internal/tmdb/service";
import {
  importTmdb as importTmdbOrchestrator,
  getTmdbSyncPreview as getTmdbSyncPreviewOrchestrator,
  syncTmdb as syncTmdbOrchestrator,
} from "./internal/tmdb/orchestrator";

export { TmdbFetchError, fetchTmdbSeriesData, saveTmdbSeries, getTmdbPreview, selectBestTmdbLogo };
export type {
  FetchTmdbSeriesOptions,
  GetTmdbPreviewOptions,
  TmdbEpisodeDetails,
  TmdbImportInput,
  TmdbSyncInput,
  TmdbSyncPreviewInput,
  TmdbSyncPreviewResult,
  SeasonSyncDiffItem,
  EpisodeChangeItem,
  TmdbPreviewResult,
  TmdbPreviewSeason,
  TmdbSeasonDetailsResponse,
  TmdbSeasonEpisodeItem,
  TmdbSeasonFullData,
  TmdbSeasonResponse,
  TmdbSeriesDetailsResponse,
  TmdbSeriesFullData,
  TmdbSeriesSeasonMeta,
  TmdbImageItem,
  TmdbImagesResponse,
};

export type VideoSource = "otakudesu" | "dramula";

export type { EpisodeRow as SavedEpisode, SeasonRow as SavedSeason, SeriesRow as SavedSeries } from "@repo/db";
export type { EpisodeWithVideoSources };
export type {
  SeriesWithEpisodes,
  SeriesWithSeasons,
  SeasonWithEpisodes,
  SeriesWithMetadata,
  HomeFeedHero,
  HomeFeedRow,
  HomeFeedPayload,
  RecentlyAddedEpisode,
} from "./internal/series/repository";
export { EpisodeNotFoundError, createEpisodeRepositoryInternal } from "./internal/episodes/repository";
export { SeasonNotFoundError, SeasonNotEmptyError, SeasonNotOngoingError, SeasonMissingScraperUrlError, SeasonAlreadyExistsError, createSeasonsRepositoryInternal } from "./internal/seasons/repository";
export type { SeasonUpsertInput, CreateSeasonInput, UpdateSeasonInput } from "./internal/seasons/repository";
export { SeriesNotFoundError, SeriesHighlightWithoutOngoingError, createSeriesRepositoryInternal } from "./internal/series/repository";
export { VideoSourceNotFoundError, createVideoSourceRepositoryInternal } from "./internal/video-sources/repository";
export type {
  EpisodeUpsertInput,
  UpdateEpisodeInput,
  EpisodeOrderUpdateInput,
  EpisodeListParams,
  EpisodeListResult,
  EpisodeRepositoryOptions,
} from "./internal/episodes/repository";
export type {
  SeriesUpsertInput,
  UpdateSeriesInput,
  SeriesListParams,
  SeriesListResult,
  SeriesRepositoryOptions,
} from "./internal/series/repository";
export type {
  VideoSourceUpsertInput,
  UpdateVideoSourceInput,
  VideoSourceRepositoryOptions,
} from "./internal/video-sources/repository";


export {
  EpisodeParseError,
  EpisodeMissingFieldsError,
  SeriesParseError,
  MirrorResolveError,
} from "@repo/media-scraper";

export type FetchFn = {
  get(url: string): Promise<string>;
  post(url: string, body: string): Promise<string>;
};

export const defaultFetchFn: FetchFn = {
  async get(url: string) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch HTML from ${url}: ${response.statusText}`);
    }
    return response.text();
  },
  async post(url: string, body: string) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!response.ok) {
      throw new Error(`Failed to POST to ${url}: ${response.statusText}`);
    }
    return response.text();
  },
};

export class EpisodeFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EpisodeFetchError";
  }
}

export class SeriesFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SeriesFetchError";
  }
}

export interface SaveEpisodeInput {
  sourceUrl: string;
  source: VideoSource;
  html?: string;
}

export interface PreviewScrapeVideoSource {
  type: "embed" | "direct";
  url: string;
  label: string;
  quality?: string | null;
}

export interface PreviewScrapeResult {
  episode: {
    sourceUrl: string;
    source: VideoSource;
    title: string;
    videoType: string | null;
    videoSources: PreviewScrapeVideoSource[];
    metadata: ParsedMetadata;
  };
  series: {
    sourceUrl: string;
    source: VideoSource;
    title: string;
    description: string | null;
    posterUrl: string | null;
  } | null;
  warnings: string[];
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

export interface SaveMediaEpisodeVideoSourceInput {
  type: "embed" | "direct";
  url: string;
  label: string;
  quality?: string | null;
}

export interface SaveMediaEpisodeInput {
  sourceUrl: string;
  source: VideoSource;
  title: string;
  videoType?: string | null;
  videoSources?: SaveMediaEpisodeVideoSourceInput[];
  metadata: Record<string, unknown>;
}

export interface SaveMediaSeriesInput {
  sourceUrl: string;
  source: VideoSource;
  title: string;
  description?: string | null;
  posterUrl?: string | null;
  tmdbId?: number | null;
}

export interface SaveMediaInput {
  episode: SaveMediaEpisodeInput;
  series?: SaveMediaSeriesInput | null;
}

import type { SeriesWithSeasons, SeriesWithEpisodes } from "./internal/series/repository";

export interface SaveMediaResult {
  episode: EpisodeWithVideoSources;
  series: SeriesWithSeasons | null;
}

export interface SaveEpisodeServiceOptions {
  fetchHtml?: FetchFn;
  browserFn?: BrowserFn;
  s3StorageService?: S3StorageService;
}

export interface OngoingScrapeResult {
  seasonId: string;
  seriesId: string;
  success: boolean;
  tmdbSynced: boolean;
  episodesScraped: number;
  sourcesSaved: number;
  seasonCompleted: boolean;
  error?: string | null;
}

export interface BatchOngoingScrapeResult {
  totalProcessed: number;
  successCount: number;
  failureCount: number;
  results: OngoingScrapeResult[];
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

export function createMediaService<
  THKT extends PgQueryResultHKT,
  TSchema extends Record<string, unknown> = Record<string, unknown>,
>(
  db: PgDatabase<THKT, TSchema>,
  options?: SaveEpisodeServiceOptions
): MediaService {
  const episodeRepository = createEpisodeRepositoryInternal(db, {
    s3StorageService: options?.s3StorageService,
  });
  const seriesRepository = createSeriesRepositoryInternal(db, {
    s3StorageService: options?.s3StorageService,
  });
  const videoSourceRepository = createVideoSourceRepositoryInternal(db, {
    s3StorageService: options?.s3StorageService,
  });
  const fetchHtml = options?.fetchHtml ?? defaultFetchFn;

  return {
    async previewScrape(input: SaveEpisodeInput): Promise<PreviewScrapeResult> {
      const provider = MediaScraper.getProviderForUrl(input.sourceUrl);
      if (!provider) {
        throw new EpisodeFetchError(`No provider found for ${input.sourceUrl}`);
      }

      let html = input.html;
      if (!html) {
        try {
          html = await fetchHtml.get(input.sourceUrl);
        } catch (error) {
          throw new EpisodeFetchError(
            `Failed to fetch HTML from ${input.sourceUrl}: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }

      const effectiveFetch: ScraperFetchFn = {
        get: async (url: string) => {
          if (url === input.sourceUrl && html) {
            return html;
          }
          return fetchHtml.get(url);
        },
        post: (url: string, body: string) => fetchHtml.post(url, body),
      };

      const scraped = await provider.parseEpisode(input.sourceUrl, effectiveFetch);
      const warnings: string[] = [];

      // Some providers (e.g. Dramula videobello embeds) emit `.00000000`
      // placeholder hashes that must be resolved via headless-browser rendering.
      if (scraped.videoSources.some((vs) => vs.url.includes(".00000000"))) {
        try {
          const resolved = await provider.resolveVideoSources(
            input.sourceUrl,
            effectiveFetch,
            undefined,
            options?.browserFn
          );
          scraped.videoSources = resolved;
        } catch (error) {
          if (error instanceof EpisodeParseError) {
            warnings.push(
              "Failed to resolve videobello embed hash; sources may not play correctly"
            );
          } else {
            throw error;
          }
        }
      }

      let series: PreviewScrapeResult["series"] = null;

      // Extract direct video sources from the primary embed iframe
      let directSources: ParsedVideoSource[] = [];
      const embedSource = scraped.videoSources.find(
        (vs) => vs.type === "embed"
      );
      if (embedSource?.url) {
        try {
          const iframeHtml = await fetchHtml.get(embedSource.url);
          directSources = extractDirectVideoSources(iframeHtml);
        } catch {
          // will retry with resolved mirrors below
        }
      }

      if (scraped.animePageUrl) {
        try {
          const seriesResult = await provider.parseSeries(scraped.animePageUrl, fetchHtml);
          series = {
            sourceUrl: scraped.animePageUrl,
            source: input.source,
            title: seriesResult.title,
            description: seriesResult.description ?? null,
            posterUrl: seriesResult.posterUrl ?? null,
          };
        } catch {
          warnings.push("Failed to fetch series details");
        }
      }

      let videoSources: PreviewScrapeVideoSource[] = scraped.videoSources.map((vs) => ({
        type: vs.type,
        url: vs.url,
        label: vs.label,
        ...(vs.quality !== undefined ? { quality: vs.quality } : {}),
      }));

      const mirrorPayloads = (scraped.providerData?.mirrorPayloads ?? []) as ParsedMirrorPayload[];
      const ajaxActions = (scraped.providerData?.ajaxActions ?? null) as ParsedAjaxActions | null;

      if (mirrorPayloads.length > 0) {
        if (!ajaxActions) {
          warnings.push(
            "Failed to extract AJAX actions; mirror resolution skipped"
          );
        } else {
          const resolved = await resolveMirrors({
            payloads: mirrorPayloads,
            fetchFn: fetchHtml,
            nonceAction: ajaxActions.nonceAction,
            mirrorAction: ajaxActions.mirrorAction,
          });
          videoSources = resolved.map((mirror) => ({
            type: "embed",
            url: mirror.url,
            label: mirror.label,
            quality: "720p",
          }));

          // If the primary embed iframe had no direct MP4, try resolved mirrors
          if (directSources.length === 0 && resolved.length > 0) {
            const desuMirror = resolved.find(
              (m) => m.url.includes("desustream.net") || m.label.toLowerCase().includes("odstream")
            );
            if (desuMirror?.url) {
              try {
                const mirrorHtml = await fetchHtml.get(desuMirror.url);
                directSources = extractDirectVideoSources(mirrorHtml);
              } catch {
                // no warning, just skip — embed sources are still present
              }
            }
          }
        }
      }

      // Merge direct sources into videoSources
      if (directSources.length > 0) {
        const directPreview = directSources.map(
          (ds) =>
            ({
              type: ds.type,
              url: ds.url,
              label: ds.label,
              quality: ds.quality ?? null,
            }) as PreviewScrapeVideoSource
        );
        videoSources.push(...directPreview);
      }

      const metadata: ParsedMetadata = {};
      if (scraped.genres) metadata.genres = scraped.genres;
      if (scraped.duration) metadata.duration = scraped.duration;
      if (scraped.posterUrl) metadata.posterUrl = scraped.posterUrl;
      if (scraped.animePageUrl) metadata.animePageUrl = scraped.animePageUrl;
      if (scraped.downloadLinks) metadata.downloadLinks = scraped.downloadLinks as ParsedDownloadLink[];
      if (scraped.episodes) {
        metadata.episodes = scraped.episodes.map((ep) => ({
          label: ep.title,
          url: ep.url,
        }));
      }

      return {
        episode: {
          sourceUrl: input.sourceUrl,
          source: input.source,
          title: scraped.title,
          videoType: scraped.videoType ?? null,
          videoSources: sortVideoSources(normalizeVideoSourcesSync(videoSources)),
          metadata,
        },
        series,
        warnings,
      };
    },

    async previewScrapeSeries(
      input: SaveEpisodeInput
    ): Promise<PreviewScrapeSeriesResult> {
      const provider = MediaScraper.getProviderForUrl(input.sourceUrl);
      if (!provider) {
        throw new SeriesFetchError(`No provider found for ${input.sourceUrl}`);
      }

      let html = input.html;
      if (!html) {
        try {
          html = await fetchHtml.get(input.sourceUrl);
        } catch (error) {
          throw new SeriesFetchError(
            `Failed to fetch HTML from ${input.sourceUrl}: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      }

      const effectiveFetch: ScraperFetchFn = {
        get: async (url: string) => {
          if (url === input.sourceUrl && html) {
            return html;
          }
          return fetchHtml.get(url);
        },
        post: (url: string, body: string) => fetchHtml.post(url, body),
      };

      const parsed = await provider.parseSeries(input.sourceUrl, effectiveFetch);
      return {
        series: {
          sourceUrl: input.sourceUrl,
          source: input.source,
          title: parsed.title,
          description: parsed.description ?? null,
          posterUrl: parsed.posterUrl ?? null,
        },
        episodes: parsed.episodes.map((ep) => ({
          title: ep.title,
          url: ep.url,
          date: ep.date ?? null,
        })),
      };
    },

    async previewBulkSources(
      input: PreviewBulkSourcesInput
    ): Promise<PreviewBulkSourcesResult> {
      const bulk = createBulkServiceInternal(
        db,
        {
          previewScrapeSeries: (args) =>
            this.previewScrapeSeries({
              sourceUrl: args.sourceUrl,
              source: args.source,
              html: args.html,
            }),
        },
        { s3StorageService: options?.s3StorageService }
      );
      return bulk.previewBulkSources(input);
    },

    async saveBulkSources(input: SaveBulkSourcesInput): Promise<SaveBulkSourcesResult> {
      const bulk = createBulkServiceInternal(
        db,
        {
          previewScrapeSeries: (args) =>
            this.previewScrapeSeries({
              sourceUrl: args.sourceUrl,
              source: args.source,
              html: args.html,
            }),
        },
        { s3StorageService: options?.s3StorageService }
      );
      return bulk.saveBulkSources(input);
    },

    async scrapeAndSaveSources(
      episodeId: string,
      sourceUrl: string
    ): Promise<EpisodeWithVideoSources> {
      const episode = await episodeRepository.findById(episodeId);
      if (!episode) {
        throw new EpisodeNotFoundError(`Episode with id ${episodeId} not found`);
      }

      const provider = MediaScraper.getProviderForUrl(sourceUrl);
      if (!provider) {
        throw new EpisodeFetchError(`No provider found for ${sourceUrl}`);
      }

      const sources = await provider.resolveVideoSources(
        sourceUrl,
        fetchHtml,
        undefined,
        options?.browserFn
      );

      await videoSourceRepository.deleteByEpisodeId(episodeId);

      for (const vs of sources) {
        await videoSourceRepository.upsert({
          episodeId,
          type: vs.type,
          url: vs.url,
          label: vs.label,
          quality: vs.quality ?? null,
        });
      }

      const updated = await episodeRepository.findById(episodeId);
      return updated!;
    },

    async saveMedia(input: SaveMediaInput): Promise<SaveMediaResult> {
      return await db.transaction(async (tx) => {
        const episodeRepositoryTx = createEpisodeRepositoryInternal(tx, {
          s3StorageService: options?.s3StorageService,
        });
        const seriesRepositoryTx = createSeriesRepositoryInternal(tx, {
          s3StorageService: options?.s3StorageService,
        });
        const seasonsRepositoryTx = createSeasonsRepositoryInternal(tx);
        const videoSourceRepositoryTx = createVideoSourceRepositoryInternal(tx, {
          s3StorageService: options?.s3StorageService,
        });

        let seasonId: string | null = null;
        let seriesRow: SeriesRow | null = null;

        const seriesInput: SaveMediaSeriesInput = input.series ?? {
          sourceUrl: input.episode.sourceUrl,
          source: input.episode.source,
          title: input.episode.title,
          description: null,
          posterUrl: null,
        };

        let parentSeriesId: string;
        let existingSeries: SeriesRow | null = null;

        if (seriesInput.tmdbId) {
          existingSeries = await seriesRepositoryTx.findByTmdbId(seriesInput.tmdbId);
        }
        if (!existingSeries && seriesInput.title) {
          const [byTitle] = await tx
            .select()
            .from(series)
            .where(eq(series.title, seriesInput.title));
          existingSeries = byTitle ?? null;
        }

        if (existingSeries) {
          parentSeriesId = existingSeries.id;
          seriesRow = await seriesRepositoryTx.upsert({
            id: parentSeriesId,
            title: seriesInput.title,
            description: seriesInput.description ?? null,
            posterUrl: seriesInput.posterUrl ?? null,
          });
        } else {
          const isMovie =
            input.episode.videoType?.toLowerCase() === "movie" ||
            seriesInput.title.toLowerCase().includes("movie");
          seriesRow = await seriesRepositoryTx.upsert({
            title: seriesInput.title,
            description: seriesInput.description ?? null,
            posterUrl: seriesInput.posterUrl ?? null,
            type: isMovie ? "movie" : "tv",
            tmdbSyncStatus: "PENDING",
          });
          parentSeriesId = seriesRow.id;
        }

        const seasonRow = await seasonsRepositoryTx.upsert({
          seriesId: parentSeriesId,
          title: seriesInput.title,
          description: seriesInput.description ?? null,
          posterUrl: seriesInput.posterUrl ?? null,
          seasonNumber: 1,
        });
        seasonId = seasonRow.id;

        let order = parseEpisodeOrder(input.episode.title);
        if (order === null) {
          const maxOrder = await episodeRepositoryTx.getMaxOrder(seasonId);
          order = maxOrder + 1;
        }

        const episodeRow = await episodeRepositoryTx.upsert({
          title: input.episode.title,
          order,
          seasonId,
        });

        if (input.episode.videoSources && input.episode.videoSources.length > 0) {
          for (const vs of input.episode.videoSources) {
            await videoSourceRepositoryTx.upsert({
              episodeId: episodeRow.id,
              type: vs.type,
              url: vs.url,
              label: vs.label,
              quality: vs.quality ?? null,
            });
          }
        }

        const episodeWithSources = await episodeRepositoryTx.findById(episodeRow.id);

        const childSeasons = seriesRow
          ? await tx
              .select()
              .from(seasons)
              .where(eq(seasons.seriesId, seriesRow.id))
              .orderBy(asc(seasons.createdAt))
          : [];

        return {
          episode: episodeWithSources!,
          series: seriesRow ? { ...seriesRow, seasons: childSeasons } : null,
        };
      });
    },

    importTmdb: (input: TmdbImportInput) => importTmdbOrchestrator(db, input),
    getTmdbPreview: (type: "tv" | "movie", tmdbId: number, includeSpecials?: boolean) =>
      getTmdbPreview(tmdbId, { type, includeSpecials }),

    getTmdbSyncPreview: (seriesId: string, input: TmdbSyncPreviewInput) =>
      getTmdbSyncPreviewOrchestrator(db, seriesId, input),

    syncTmdb: (seriesId: string, input: TmdbSyncInput) =>
      syncTmdbOrchestrator(db, seriesId, input),

    async syncAndScrapeOngoingSeason(seasonId: string): Promise<OngoingScrapeResult> {
      const seasonsRepository = createSeasonsRepositoryInternal(db);
      const targetSeason = await seasonsRepository.findById(seasonId);
      if (!targetSeason) {
        throw new SeasonNotFoundError(`Season with id ${seasonId} not found`);
      }

      if (targetSeason.status !== "ongoing") {
        const errorMsg = `Season ${seasonId} is not in ongoing status (current status: ${targetSeason.status})`;
        await seasonsRepository.updateSeason(seasonId, {
          lastScrapedAt: new Date(),
          lastScrapeError: errorMsg,
        });
        return {
          seasonId,
          seriesId: targetSeason.seriesId,
          success: false,
          tmdbSynced: false,
          episodesScraped: 0,
          sourcesSaved: 0,
          seasonCompleted: false,
          error: errorMsg,
        };
      }

      if (!targetSeason.scraperUrl || !targetSeason.source) {
        const errorMsg = `Season ${seasonId} is missing scraperUrl or source`;
        await seasonsRepository.updateSeason(seasonId, {
          lastScrapedAt: new Date(),
          lastScrapeError: errorMsg,
        });
        return {
          seasonId,
          seriesId: targetSeason.seriesId,
          success: false,
          tmdbSynced: false,
          episodesScraped: 0,
          sourcesSaved: 0,
          seasonCompleted: false,
          error: errorMsg,
        };
      }

      try {
        let tmdbSynced = false;
        const targetSeries = await seriesRepository.findById(targetSeason.seriesId);
        if (targetSeries?.tmdbId) {
          try {
            await this.syncTmdb(targetSeries.id, {
              type: (targetSeries.type === "movie" ? "movie" : "tv"),
              tmdbId: targetSeries.tmdbId,
              skipGenres: true,
            });
            tmdbSynced = true;
          } catch (tmdbErr) {
            // Log/continue or record error
            console.warn(
              `[media-service] TMDB sync failed for series ${targetSeries.id} during ongoing scrape:`,
              tmdbErr instanceof Error ? tmdbErr.message : tmdbErr
            );
          }
        }

        const provider = MediaScraper.getProviderForUrl(targetSeason.scraperUrl);
        if (!provider) {
          throw new SeriesFetchError(`No provider found for ${targetSeason.scraperUrl}`);
        }

        const parsedSeries = await provider.parseSeries(targetSeason.scraperUrl, fetchHtml);

        const seriesWithEpisodes = await seriesRepository.findByIdWithEpisodes(targetSeason.seriesId);
        const seasonEpisodes = seriesWithEpisodes?.seasons?.find((s) => s.id === seasonId)?.episodes ?? [];

        const offset = targetSeason.episodeOffset ?? 0;
        let episodesScraped = 0;
        let sourcesSaved = 0;

        for (const scrapedEp of parsedSeries.episodes) {
          const epNum = parseBulkScrapedEpisodeNumber(scrapedEp.title);
          if (epNum === null || !Number.isInteger(epNum)) {
            continue;
          }

          const targetOrder = epNum + offset;
          let matchedEpisode = seasonEpisodes.find((e) => e.order === targetOrder);
          if (!matchedEpisode) {
            // Scraper-first ingestion: the provider released an episode TMDB
            // hasn't indexed yet. Create a placeholder so sources attach
            // immediately; a later TMDB sync enriches it in place.
            // Note: episodes table has no tmdbSyncStatus column (only
            // series/seasons do), so PENDING is implied by NULL passports.
            const created = await episodeRepository.upsert({
              seasonId,
              title: `Episode ${targetOrder}`,
              order: targetOrder,
            });
            matchedEpisode = { ...created, videoSources: [] } as typeof seasonEpisodes[number];
            seasonEpisodes.push(matchedEpisode);
          }

          // Only scrape if the matched episode currently has ZERO video sources
          if (matchedEpisode.videoSources && matchedEpisode.videoSources.length > 0) {
            continue;
          }

          const rawSources = await provider.resolveVideoSources(
            scrapedEp.url,
            fetchHtml,
            undefined,
            options?.browserFn
          );

          // Exclude S3 storage, only direct and embed
          const filteredSources = rawSources.filter((s) => s.type === "embed" || s.type === "direct");

          if (filteredSources.length > 0) {
            for (const vs of filteredSources) {
              await videoSourceRepository.upsert({
                episodeId: matchedEpisode.id,
                type: vs.type,
                url: vs.url,
                label: vs.label,
                quality: vs.quality ?? null,
              });
              sourcesSaved++;
            }
            episodesScraped++;
          }
        }

        // Re-fetch season episodes to check auto-completion
        const refreshedSeries = await seriesRepository.findByIdWithEpisodes(targetSeason.seriesId);
        const refreshedSeasonEpisodes = refreshedSeries?.seasons?.find((s) => s.id === seasonId)?.episodes ?? [];

        let seasonCompleted = false;
        if (
          refreshedSeasonEpisodes.length > 0 &&
          refreshedSeasonEpisodes.every((e) => e.videoSources && e.videoSources.length > 0)
        ) {
          seasonCompleted = true;
          await seasonsRepository.updateSeason(seasonId, {
            status: "completed",
            lastScrapedAt: new Date(),
            lastScrapeError: null,
          });
        } else {
          await seasonsRepository.updateSeason(seasonId, {
            lastScrapedAt: new Date(),
            lastScrapeError: null,
          });
        }

        return {
          seasonId,
          seriesId: targetSeason.seriesId,
          success: true,
          tmdbSynced,
          episodesScraped,
          sourcesSaved,
          seasonCompleted,
        };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        await seasonsRepository.updateSeason(seasonId, {
          lastScrapedAt: new Date(),
          lastScrapeError: errorMsg,
        });
        return {
          seasonId,
          seriesId: targetSeason.seriesId,
          success: false,
          tmdbSynced: false,
          episodesScraped: 0,
          sourcesSaved: 0,
          seasonCompleted: false,
          error: errorMsg,
        };
      }
    },

    async scrapeAllOngoingSeasons(): Promise<BatchOngoingScrapeResult> {
      const seasonsRepository = createSeasonsRepositoryInternal(db);
      const ongoingSeasons = await seasonsRepository.findOngoingWithScraperUrl();
      const results: OngoingScrapeResult[] = [];

      for (const season of ongoingSeasons) {
        try {
          const result = await this.syncAndScrapeOngoingSeason(season.id);
          results.push(result);
        } catch (err) {
          results.push({
            seasonId: season.id,
            seriesId: season.seriesId,
            success: false,
            tmdbSynced: false,
            episodesScraped: 0,
            sourcesSaved: 0,
            seasonCompleted: false,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      return {
        totalProcessed: results.length,
        successCount: results.filter((r) => r.success).length,
        failureCount: results.filter((r) => !r.success).length,
        results,
      };
    },
  };
}

export const createSaveEpisodeService = createMediaService;
