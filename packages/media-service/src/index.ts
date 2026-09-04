import { randomUUID } from "node:crypto";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { and, asc, eq, inArray, ne } from "drizzle-orm";
import { episodes, genres, seasons, series, seriesToGenres, slugifyGenre, type SeriesRow } from "@repo/db";
import {
  MediaScraper,
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
  type CreateStealthBrowserFnOptions,
} from "@repo/media-scraper";

import {
  createS3StorageService,
  extractS3Key,
  S3NotConfiguredError,
  type S3StorageService,
  type S3StorageServiceOptions,
} from "./internal/s3/s3-storage-service";
export { createS3StorageService, S3NotConfiguredError, extractS3Key };
export type { S3StorageService, S3StorageServiceOptions };

export type { BrowserFn, CreateStealthBrowserFnOptions };
import {
  normalizePlaybackUrl,
  normalizeVideoSource,
  normalizeVideoSources,
  normalizeVideoSourceSync,
  normalizeVideoSourcesSync,
} from "./internal/playback/normalization";
export {
  normalizePlaybackUrl,
  normalizeVideoSource,
  normalizeVideoSources,
  normalizeVideoSourceSync,
  normalizeVideoSourcesSync,
};
import { createEpisodeRepositoryInternal, EpisodeNotFoundError, type EpisodeWithVideoSources } from "./internal/episodes/repository";
import { createSeasonsRepositoryInternal, SeasonNotFoundError, SeasonNotLinkedToTmdbError } from "./internal/seasons/repository";
import { createSeriesRepositoryInternal, SeriesNotFoundError } from "./internal/series/repository";
import { createVideoSourceRepositoryInternal, VideoSourceNotFoundError } from "./internal/video-sources/repository";
import {
  fetchFromTmdb,
  fetchTmdbSeasonDetails,
  fetchTmdbSeriesData,
  getTmdbPreview,
  saveTmdbSeries,
  TmdbFetchError,
  type FetchTmdbSeriesOptions,
  type TmdbEpisodeDetails,
  type TmdbImportInput,
  type TmdbPreviewResult,
  type TmdbSeasonDetailsResponse,
  type TmdbSeasonEpisodeItem,
  type TmdbSeasonFullData,
  type TmdbSeasonResponse,
  type TmdbSeriesDetailsResponse,
  type TmdbSeriesFullData,
  type TmdbSeriesSeasonMeta,
} from "./internal/tmdb/service";

export { TmdbFetchError, fetchTmdbSeriesData, saveTmdbSeries };
export type {
  FetchTmdbSeriesOptions,
  TmdbEpisodeDetails,
  TmdbImportInput,
  TmdbPreviewResult,
  TmdbSeasonDetailsResponse,
  TmdbSeasonEpisodeItem,
  TmdbSeasonFullData,
  TmdbSeasonResponse,
  TmdbSeriesDetailsResponse,
  TmdbSeriesFullData,
  TmdbSeriesSeasonMeta,
};

export interface TmdbMatchInput {
  seriesId: string;
  type: "movie" | "tv";
  tmdbId: number;
  season?: number;
  localSeasonId?: string;
}

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
} from "./internal/series/repository";
export { EpisodeNotFoundError, createEpisodeRepositoryInternal } from "./internal/episodes/repository";
export { SeasonNotFoundError, SeasonNotEmptyError, SeasonNotLinkedToTmdbError, createSeasonsRepositoryInternal } from "./internal/seasons/repository";
export type { SeasonUpsertInput, CreateSeasonInput } from "./internal/seasons/repository";
export { SeriesNotFoundError, createSeriesRepositoryInternal } from "./internal/series/repository";
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

import type { SeriesWithSeasons } from "./internal/series/repository";

export interface SaveMediaResult {
  episode: EpisodeWithVideoSources;
  series: SeriesWithSeasons | null;
}

export interface SaveEpisodeServiceOptions {
  fetchHtml?: FetchFn;
  browserFn?: BrowserFn;
  s3StorageService?: S3StorageService;
}

export interface MergeSeasonsInput {
  seriesId: string;
  orderedSeasonIds: string[];
}

export interface TmdbEpisodePreviewUpdateItem {
  id: string;
  order: number;
  existingTitle: string;
  newTitle: string;
  existingDescription: string | null;
  newDescription: string | null;
  existingThumbnailUrl: string | null;
  newThumbnailUrl: string | null;
  existingRating: string | null;
  newRating: string | null;
  existingAirDate: string | null;
  newAirDate: string | null;
  existingDuration: number | null;
  newDuration: number | null;
  tmdbId: number | null;
}

export interface TmdbEpisodePreviewInsertItem {
  order: number;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  rating: string | null;
  airDate: string | null;
  duration: number | null;
  tmdbId: number | null;
}

export interface TmdbEpisodePreviewUnmappedItem {
  id: string;
  order: number;
  title: string;
}

export interface SeasonTmdbPreviewResult {
  seasonId: string;
  tmdbId: number;
  tmdbSeason: number;
  updates: TmdbEpisodePreviewUpdateItem[];
  inserts: TmdbEpisodePreviewInsertItem[];
  unmapped: TmdbEpisodePreviewUnmappedItem[];
}

export interface SeasonTmdbSyncOptions {
  tmdbId?: number;
  tmdbSeason?: number;
}

export interface SeasonTmdbSyncResult {
  success: true;
  seasonId: string;
  updatedCount: number;
  insertedCount: number;
  unmappedCount: number;
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

export interface BulkSourceItemVideoSource {
  type: "embed" | "direct";
  url: string;
  label: string;
  quality?: string | null;
}

export interface BulkSourceItem {
  episodeId: string | null;
  videoSources: BulkSourceItemVideoSource[];
}

export interface SaveBulkSourcesInput {
  seriesId: string;
  mappings: BulkSourceItem[];
}

export interface SaveBulkSourcesResult {
  success: true;
  savedCount: number;
  skippedCount: number;
}

export function parseBulkScrapedEpisodeNumber(title: string): number | null {
  const decimalEpMatch = title.match(/(?:episode|eps|ep|#)\.?\s*(\d+\.\d+)/i);
  if (decimalEpMatch) {
    const num = parseFloat(decimalEpMatch[1]);
    if (!Number.isNaN(num)) return num;
  }

  const epMatch = title.match(/(?:episode|eps|ep|#)\.?\s*(\d+)/i);
  if (epMatch) {
    const num = parseInt(epMatch[1], 10);
    if (!Number.isNaN(num)) return num;
  }

  const titleWithoutSeason = title.replace(/\bseason\s*\d+/gi, "").replace(/\bs\d+\b/gi, "");

  const decimalMatch = titleWithoutSeason.match(/\b(\d+\.\d+)\b/);
  if (decimalMatch) {
    const num = parseFloat(decimalMatch[1]);
    if (!Number.isNaN(num)) return num;
  }

  const numMatch = titleWithoutSeason.match(/\b(\d+)\b/);
  if (numMatch) {
    const num = parseInt(numMatch[1], 10);
    if (!Number.isNaN(num) && (num < 1900 || num > 2100)) return num;
  }

  return null;
}

export interface MediaService {
  previewScrape(input: SaveEpisodeInput): Promise<PreviewScrapeResult>;
  previewScrapeSeries(input: SaveEpisodeInput): Promise<PreviewScrapeSeriesResult>;
  previewBulkSources(input: PreviewBulkSourcesInput): Promise<PreviewBulkSourcesResult>;
  scrapeAndSaveSources(episodeId: string, sourceUrl: string): Promise<EpisodeWithVideoSources>;
  saveMedia(input: SaveMediaInput): Promise<SaveMediaResult>;
  getTmdbPreview(type: "movie" | "tv", tmdbId: number, season?: number): Promise<TmdbPreviewResult>;
  getSeasonTmdbPreview(seasonId: string, options?: SeasonTmdbSyncOptions): Promise<SeasonTmdbPreviewResult>;
  syncSeasonTmdb(seasonId: string, options?: SeasonTmdbSyncOptions): Promise<SeasonTmdbSyncResult>;
  matchTmdb(input: TmdbMatchInput): Promise<SeriesWithSeasons>;
  mergeSeasons(input: MergeSeasonsInput): Promise<{ success: true }>;
  importTmdb(input: TmdbImportInput): Promise<SeriesWithSeasons>;
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
          videoSources: normalizeVideoSourcesSync(videoSources),
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
      const targetSeries = await seriesRepository.findById(input.seriesId);
      if (!targetSeries) {
        throw new SeriesNotFoundError(`Series with id ${input.seriesId} not found`);
      }

      const parsedSeries = await this.previewScrapeSeries({
        sourceUrl: input.sourceUrl,
        source: input.source,
        html: input.html,
      });

      const fullSeries = await seriesRepository.findByIdWithEpisodes(input.seriesId);
      const localEpisodes: BulkPreviewLocalEpisodeItem[] = [];
      const localEpisodesMapByOrder = new Map<number, string>();

      if (fullSeries && fullSeries.seasons) {
        for (const s of fullSeries.seasons) {
          if (input.seasonId && s.id !== input.seasonId) {
            continue;
          }
          for (const ep of s.episodes) {
            localEpisodes.push({
              id: ep.id,
              title: ep.title,
              order: ep.order,
              seasonId: s.id,
              seasonNumber: s.seasonNumber ?? null,
              seasonTitle: s.title,
              hasSources: Array.isArray(ep.videoSources) && ep.videoSources.length > 0,
            });
            if (!localEpisodesMapByOrder.has(ep.order)) {
              localEpisodesMapByOrder.set(ep.order, ep.id);
            }
          }
        }
      }

      const offset = input.episodeOffset ?? 0;
      const scrapedEpisodes: ScrapedBulkEpisodeItem[] = parsedSeries.episodes.map((scrapedEp) => {
        const epNum = parseBulkScrapedEpisodeNumber(scrapedEp.title);
        let calculatedOrder: number | null = null;
        let matchedLocalEpisodeId: string | null = null;
        let matchStatus: "matched" | "unmatched" = "unmatched";

        if (epNum !== null && Number.isInteger(epNum)) {
          const targetOrder = epNum + offset;
          calculatedOrder = targetOrder;
          const matchedId = localEpisodesMapByOrder.get(targetOrder);
          if (matchedId) {
            matchedLocalEpisodeId = matchedId;
            matchStatus = "matched";
          }
        }

        return {
          scrapedTitle: scrapedEp.title,
          scrapedUrl: scrapedEp.url,
          episodeNumber: epNum,
          calculatedOrder,
          matchedLocalEpisodeId,
          matchStatus,
        };
      });

      return {
        scrapedEpisodes,
        localEpisodes,
      };
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

    async getTmdbPreview(type: "movie" | "tv", tmdbId: number, season?: number): Promise<TmdbPreviewResult> {
      return getTmdbPreview(type, tmdbId, season);
    },

    async matchTmdb(input: TmdbMatchInput): Promise<SeriesWithSeasons> {
      const targetSeries = await seriesRepository.findById(input.seriesId);
      if (!targetSeries) {
        throw new SeriesNotFoundError(`Series not found`);
      }

      let details: any;
      let seasonDetails: any = null;
      let poster_path = null;
      let backdrop_path = null;
      let title = "";
      let overview = "";
      let vote_average = null;
      const seasonNum = input.season ?? 1;

      if (input.type === "movie") {
        details = await fetchFromTmdb<any>(`/movie/${input.tmdbId}?language=en-US`);
        title = details.title;
        overview = details.overview;
        poster_path = details.poster_path;
        backdrop_path = details.backdrop_path;
        vote_average = details.vote_average;
      } else {
        details = await fetchFromTmdb<any>(`/tv/${input.tmdbId}?language=en-US`);
        const targetSeasonData = Array.isArray(details.seasons)
          ? details.seasons.find((s: any) => s.season_number === seasonNum)
          : null;
        seasonDetails = targetSeasonData ?? null;

        title = details.name;
        overview = details.overview;
        poster_path = details.poster_path;
        backdrop_path = details.backdrop_path;
        vote_average = details.vote_average;
      }

      const ratingStr = vote_average ? String(vote_average) : undefined;

      return await db.transaction(async (tx) => {
        const seriesRepositoryTx = createSeriesRepositoryInternal(tx);
        const seasonsRepositoryTx = createSeasonsRepositoryInternal(tx);

        const existingTmdbSeries = await seriesRepositoryTx.findByTmdbId(details.id);

        let activeSeriesId: string;

        if (existingTmdbSeries && existingTmdbSeries.id !== targetSeries.id) {
          await seasonsRepositoryTx.reparentSeasons(targetSeries.id, existingTmdbSeries.id);

          const updatedDescription = overview || existingTmdbSeries.description;
          const updatedPoster = poster_path || existingTmdbSeries.posterUrl;

          const payload = {
            title: title || existingTmdbSeries.title,
            description: updatedDescription,
            posterUrl: updatedPoster,
            backdropUrl: backdrop_path || existingTmdbSeries.backdropUrl,
            rating: ratingStr || existingTmdbSeries.rating,
            tmdbId: details.id,
            tmdbSyncStatus: "SYNCED" as const,
          };

          await seriesRepositoryTx.updateSeries(existingTmdbSeries.id, payload);
          await seriesRepositoryTx.deleteSeries(targetSeries.id);
          activeSeriesId = existingTmdbSeries.id;
        } else {
          const updatedDescription = overview || targetSeries.description;
          const updatedPoster = poster_path || targetSeries.posterUrl;

          const payload = {
            title: title || targetSeries.title,
            description: updatedDescription,
            posterUrl: updatedPoster,
            backdropUrl: backdrop_path,
            rating: ratingStr,
            tmdbId: details.id,
            tmdbSyncStatus: "SYNCED" as const,
          };

          await seriesRepositoryTx.updateSeries(targetSeries.id, payload);
          activeSeriesId = targetSeries.id;
        }

        await tx
          .delete(seriesToGenres)
          .where(eq(seriesToGenres.seriesId, activeSeriesId));

        const rawGenres: string[] = Array.isArray(details.genres)
          ? details.genres.map((g: any) => (typeof g === "string" ? g : g?.name)).filter(Boolean)
          : [];
        const genreNames = Array.from(
          new Set(rawGenres.map((g) => g.trim()).filter(Boolean))
        );

        if (genreNames.length > 0) {
          const genreValues = genreNames.map((name) => ({
            id: randomUUID(),
            name,
            slug: slugifyGenre(name),
            createdAt: new Date(),
            updatedAt: new Date(),
          }));

          const genreRows = await tx
            .insert(genres)
            .values(genreValues)
            .onConflictDoUpdate({
              target: genres.name,
              set: {
                updatedAt: new Date(),
              },
            })
            .returning({ id: genres.id });

          const seriesToGenreRows = (genreRows || []).map((g: any) => ({
            seriesId: activeSeriesId,
            genreId: g.id,
          }));

          if (seriesToGenreRows.length > 0) {
            await tx
              .insert(seriesToGenres)
              .values(seriesToGenreRows)
              .onConflictDoNothing();
          }
        }

        if (input.type === "tv") {
          const childSeasons = await tx
            .select()
            .from(seasons)
            .where(eq(seasons.seriesId, activeSeriesId))
            .orderBy(asc(seasons.createdAt));

          let targetSeasonRow = input.localSeasonId
            ? childSeasons.find((s) => s.id === input.localSeasonId)
            : undefined;

          if (!targetSeasonRow) {
            targetSeasonRow = childSeasons.find((s) => s.seasonNumber === seasonNum);
          }

          if (!targetSeasonRow) {
            targetSeasonRow = childSeasons.find((s) => s.seasonNumber == null) ?? childSeasons[0];
          }

          if (targetSeasonRow) {
            const seasonOverview = seasonDetails?.overview || details.overview;
            const seasonPoster = seasonDetails?.poster_path || details.poster_path;

            await seasonsRepositoryTx.updateSeason(targetSeasonRow.id, {
              seasonNumber: seasonNum,
              posterUrl: seasonPoster,
              title: seasonDetails?.name,
              description: seasonOverview,
              tmdbSyncStatus: "SYNCED",
            });
          }
        }

        const finalSeries = await seriesRepositoryTx.findById(activeSeriesId);
        const finalSeasons = await tx
          .select()
          .from(seasons)
          .where(eq(seasons.seriesId, activeSeriesId))
          .orderBy(asc(seasons.createdAt));

        return {
          ...finalSeries!,
          seasons: finalSeasons,
          relations: [],
        };
      });
    },

    async mergeSeasons(input: MergeSeasonsInput): Promise<{ success: true }> {
      if (!input.orderedSeasonIds || input.orderedSeasonIds.length === 0) {
        throw new Error("orderedSeasonIds must contain at least one season ID");
      }

      const uniqueSeasonIds = new Set(input.orderedSeasonIds);
      if (uniqueSeasonIds.size !== input.orderedSeasonIds.length) {
        throw new Error("orderedSeasonIds must contain unique season IDs");
      }

      const primarySeasonId = input.orderedSeasonIds[0];
      const duplicateSeasonIds = input.orderedSeasonIds.slice(1);

      return await db.transaction(async (tx) => {
        const seriesRepositoryTx = createSeriesRepositoryInternal(tx);

        const targetSeries = await seriesRepositoryTx.findById(input.seriesId);
        if (!targetSeries) {
          throw new SeriesNotFoundError(`Series with id ${input.seriesId} not found`);
        }

        const foundSeasons = await tx
          .select()
          .from(seasons)
          .where(
            and(
              inArray(seasons.id, input.orderedSeasonIds),
              eq(seasons.seriesId, input.seriesId)
            )
          );

        if (foundSeasons.length !== input.orderedSeasonIds.length) {
          throw new SeasonNotFoundError(
            `One or more seasons in orderedSeasonIds were not found for series ${input.seriesId}`
          );
        }

        const allEpisodes = await tx
          .select()
          .from(episodes)
          .where(inArray(episodes.seasonId, input.orderedSeasonIds));

        const episodesBySeason = new Map<string, typeof allEpisodes>();
        for (const ep of allEpisodes) {
          if (ep.seasonId) {
            const list = episodesBySeason.get(ep.seasonId) ?? [];
            list.push(ep);
            episodesBySeason.set(ep.seasonId, list);
          }
        }

        const sortedEpisodes: typeof allEpisodes = [];
        for (const sId of input.orderedSeasonIds) {
          const sEpisodes = episodesBySeason.get(sId) ?? [];
          sEpisodes.sort((a, b) => {
            if (a.order !== b.order) {
              return a.order - b.order;
            }
            return a.createdAt.getTime() - b.createdAt.getTime();
          });
          sortedEpisodes.push(...sEpisodes);
        }

        const now = new Date();
        for (let i = 0; i < sortedEpisodes.length; i++) {
          const ep = sortedEpisodes[i];
          await tx
            .update(episodes)
            .set({
              seasonId: primarySeasonId,
              order: -(i + 100000),
              updatedAt: now,
            })
            .where(eq(episodes.id, ep.id));
        }

        for (let i = 0; i < sortedEpisodes.length; i++) {
          const ep = sortedEpisodes[i];
          await tx
            .update(episodes)
            .set({
              order: i + 1,
              updatedAt: now,
            })
            .where(eq(episodes.id, ep.id));
        }

        if (duplicateSeasonIds.length > 0) {
          await tx
            .delete(seasons)
            .where(inArray(seasons.id, duplicateSeasonIds));
        }

        return { success: true };
      });
    },

    async getSeasonTmdbPreview(
      seasonId: string,
      options?: SeasonTmdbSyncOptions
    ): Promise<SeasonTmdbPreviewResult> {
      const seasonsRepositoryTx = createSeasonsRepositoryInternal(db);
      const seriesRepositoryTx = createSeriesRepositoryInternal(db);
      const seasonRow = await seasonsRepositoryTx.findById(seasonId);
      if (!seasonRow) {
        throw new SeasonNotFoundError(`Season with id ${seasonId} not found`);
      }

      const seriesRow = await seriesRepositoryTx.findById(seasonRow.seriesId);
      const tmdbId = options?.tmdbId ?? seriesRow?.tmdbId;
      const tmdbSeason = options?.tmdbSeason ?? seasonRow.seasonNumber;

      if (tmdbId == null || tmdbSeason == null) {
        throw new SeasonNotLinkedToTmdbError("Season is not linked to TMDB");
      }

      const tmdbData = await fetchTmdbSeasonDetails(tmdbId, tmdbSeason);
      const tmdbEpisodes = Array.isArray(tmdbData.episodes) ? tmdbData.episodes : [];

      const localEpisodes = await db
        .select()
        .from(episodes)
        .where(eq(episodes.seasonId, seasonId))
        .orderBy(asc(episodes.order));

      const localMap = new Map<number, typeof localEpisodes[number]>();
      for (const ep of localEpisodes) {
        localMap.set(ep.order, ep);
      }

      const updates: TmdbEpisodePreviewUpdateItem[] = [];
      const inserts: TmdbEpisodePreviewInsertItem[] = [];
      const matchedOrders = new Set<number>();

      for (const ep of tmdbEpisodes) {
        const order = ep.episode_number;
        const newTitle = ep.name && ep.name.trim() !== "" ? ep.name : `Episode ${order}`;
        const newDescription = ep.overview ?? null;
        const newThumbnailUrl = ep.still_path ? `https://image.tmdb.org/t/p/w500${ep.still_path}` : null;
        const newRating = ep.vote_average != null ? String(ep.vote_average) : null;
        const newAirDate = ep.air_date ?? null;
        const newDuration = ep.runtime != null ? Number(ep.runtime) : null;
        const epTmdbId = ep.id != null ? Number(ep.id) : null;

        const existing = localMap.get(order);
        if (existing) {
          matchedOrders.add(order);
          updates.push({
            id: existing.id,
            order,
            existingTitle: existing.title,
            newTitle,
            existingDescription: existing.description ?? null,
            newDescription,
            existingThumbnailUrl: existing.thumbnailUrl ?? null,
            newThumbnailUrl,
            existingRating: existing.rating ?? null,
            newRating,
            existingAirDate: existing.airDate ? existing.airDate.toISOString() : null,
            newAirDate,
            existingDuration: existing.duration ?? null,
            newDuration,
            tmdbId: epTmdbId,
          });
        } else {
          inserts.push({
            order,
            title: newTitle,
            description: newDescription,
            thumbnailUrl: newThumbnailUrl,
            rating: newRating,
            airDate: newAirDate,
            duration: newDuration,
            tmdbId: epTmdbId,
          });
        }
      }

      const unmapped: TmdbEpisodePreviewUnmappedItem[] = [];
      for (const ep of localEpisodes) {
        if (!matchedOrders.has(ep.order)) {
          unmapped.push({
            id: ep.id,
            order: ep.order,
            title: ep.title,
          });
        }
      }

      return {
        seasonId,
        tmdbId,
        tmdbSeason,
        updates,
        inserts,
        unmapped,
      };
    },

    async syncSeasonTmdb(
      seasonId: string,
      options?: SeasonTmdbSyncOptions
    ): Promise<SeasonTmdbSyncResult> {
      const seasonsRepositoryTx = createSeasonsRepositoryInternal(db);
      const seriesRepositoryTx = createSeriesRepositoryInternal(db);
      const seasonRow = await seasonsRepositoryTx.findById(seasonId);
      if (!seasonRow) {
        throw new SeasonNotFoundError(`Season with id ${seasonId} not found`);
      }

      const seriesRow = await seriesRepositoryTx.findById(seasonRow.seriesId);
      const tmdbId = options?.tmdbId ?? seriesRow?.tmdbId;
      const tmdbSeason = options?.tmdbSeason ?? seasonRow.seasonNumber;

      if (tmdbId == null || tmdbSeason == null) {
        throw new SeasonNotLinkedToTmdbError("Season is not linked to TMDB");
      }

      const tmdbData = await fetchTmdbSeasonDetails(tmdbId, tmdbSeason);
      const tmdbEpisodes = Array.isArray(tmdbData.episodes) ? tmdbData.episodes : [];

      return await db.transaction(async (tx) => {
        const seasonsTx = createSeasonsRepositoryInternal(tx);
        await seasonsTx.updateSeason(seasonId, {
          seasonNumber: tmdbSeason,
          tmdbSyncStatus: "SYNCED",
        });

        const localEpisodes = await tx
          .select()
          .from(episodes)
          .where(eq(episodes.seasonId, seasonId));

        const localMap = new Map<number, typeof localEpisodes[number]>();
        for (const ep of localEpisodes) {
          localMap.set(ep.order, ep);
        }

        let updatedCount = 0;
        let insertedCount = 0;
        const matchedOrders = new Set<number>();
        const now = new Date();

        for (const ep of tmdbEpisodes) {
          const order = ep.episode_number;
          const title = ep.name && ep.name.trim() !== "" ? ep.name : `Episode ${order}`;
          const description = ep.overview ?? null;
          const thumbnailUrl = ep.still_path ? `https://image.tmdb.org/t/p/w500${ep.still_path}` : null;
          const rating = ep.vote_average != null ? String(ep.vote_average) : null;
          const duration = ep.runtime != null ? Number(ep.runtime) : null;
          const epTmdbId = ep.id != null ? Number(ep.id) : null;

          let airDate: Date | null = null;
          if (ep.air_date) {
            const d = new Date(ep.air_date);
            if (!isNaN(d.getTime())) airDate = d;
          }

          const existing = localMap.get(order);
          if (existing) {
            matchedOrders.add(order);
            await tx
              .update(episodes)
              .set({
                title,
                description,
                thumbnailUrl,
                rating,
                duration,
                airDate,
                updatedAt: now,
              })
              .where(eq(episodes.id, existing.id));
            updatedCount++;
          } else {
            await tx
              .insert(episodes)
              .values({
                id: randomUUID(),
                seasonId,
                order,
                title,
                description,
                thumbnailUrl,
                rating,
                duration,
                airDate,
                createdAt: now,
                updatedAt: now,
              });
            insertedCount++;
          }
        }

        const unmappedCount = localEpisodes.length - matchedOrders.size;

        return {
          success: true,
          seasonId,
          updatedCount,
          insertedCount,
          unmappedCount,
        };
      });
    },

    async importTmdb(input: TmdbImportInput): Promise<SeriesWithSeasons> {
      const data = await fetchTmdbSeriesData(input.tmdbId, {
        type: input.type,
        includeSpecials: input.includeSpecials,
      });
      return await saveTmdbSeries(db, data);
    },
  };
}

export const createSaveEpisodeService = createMediaService;
