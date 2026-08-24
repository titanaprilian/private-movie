import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { and, asc, eq, inArray } from "drizzle-orm";
import { episodes, seasons, type SeriesRow } from "@repo/db";
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
} from "@repo/media-scraper";
import { createEpisodeRepositoryInternal, EpisodeNotFoundError, type EpisodeWithVideoSources } from "./internal/episodes/repository";
import { createSeasonsRepositoryInternal, SeasonNotFoundError } from "./internal/seasons/repository";
import { createSeriesRepositoryInternal, SeriesNotFoundError } from "./internal/series/repository";
import { createVideoSourceRepositoryInternal, VideoSourceNotFoundError } from "./internal/video-sources/repository";
import { fetchFromTmdb, getTmdbPreview, TmdbFetchError, type TmdbPreviewResult } from "./internal/tmdb/service";

export { TmdbFetchError };
export type { TmdbPreviewResult };

export interface TmdbMatchInput {
  seriesId: string;
  type: "movie" | "tv";
  tmdbId: number;
  season?: number;
  localSeasonId?: string;
}

export type VideoSource = "otakudesu";

export type { EpisodeRow as SavedEpisode, SeasonRow as SavedSeason, SeriesRow as SavedSeries } from "@repo/db";
export type { EpisodeWithVideoSources };
export type { SeriesWithEpisodes, SeriesWithSeasons, SeasonWithEpisodes } from "./internal/series/repository";
export { EpisodeNotFoundError, createEpisodeRepositoryInternal } from "./internal/episodes/repository";
export { SeasonNotFoundError, createSeasonsRepositoryInternal } from "./internal/seasons/repository";
export { SeriesNotFoundError, createSeriesRepositoryInternal } from "./internal/series/repository";
export { VideoSourceNotFoundError, createVideoSourceRepositoryInternal } from "./internal/video-sources/repository";
export type {
  EpisodeUpsertInput,
  UpdateEpisodeInput,
  EpisodeOrderUpdateInput,
  EpisodeListParams,
  EpisodeListResult,
} from "./internal/episodes/repository";
export type {
  SeriesUpsertInput,
  UpdateSeriesInput,
  SeriesListParams,
  SeriesListResult,
} from "./internal/series/repository";
export type {
  VideoSourceUpsertInput,
  UpdateVideoSourceInput,
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
}

export interface MergeSeasonsInput {
  seriesId: string;
  orderedSeasonIds: string[];
}

export interface MediaService {
  previewScrape(input: SaveEpisodeInput): Promise<PreviewScrapeResult>;
  previewScrapeSeries(input: SaveEpisodeInput): Promise<PreviewScrapeSeriesResult>;
  saveMedia(input: SaveMediaInput): Promise<SaveMediaResult>;
  getTmdbPreview(type: "movie" | "tv", tmdbId: number, season?: number): Promise<TmdbPreviewResult>;
  matchTmdb(input: TmdbMatchInput): Promise<SeriesWithSeasons>;
  mergeSeasons(input: MergeSeasonsInput): Promise<{ success: true }>;
}

export type SaveEpisodeService = MediaService;

export function createMediaService<
  THKT extends PgQueryResultHKT,
  TSchema extends Record<string, unknown> = Record<string, unknown>,
>(
  db: PgDatabase<THKT, TSchema>,
  options?: SaveEpisodeServiceOptions
): MediaService {
  const episodeRepository = createEpisodeRepositoryInternal(db);
  const seriesRepository = createSeriesRepositoryInternal(db);
  const videoSourceRepository = createVideoSourceRepositoryInternal(db);
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
          videoSources,
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

    async saveMedia(input: SaveMediaInput): Promise<SaveMediaResult> {
      return await db.transaction(async (tx) => {
        const episodeRepositoryTx = createEpisodeRepositoryInternal(tx);
        const seriesRepositoryTx = createSeriesRepositoryInternal(tx);
        const seasonsRepositoryTx = createSeasonsRepositoryInternal(tx);
        const videoSourceRepositoryTx = createVideoSourceRepositoryInternal(tx);

        let seasonId: string | null = null;
        let seriesRow: SeriesRow | null = null;

        const seriesInput: SaveMediaSeriesInput = input.series ?? {
          sourceUrl: input.episode.sourceUrl,
          source: input.episode.source,
          title: input.episode.title,
          description: null,
          posterUrl: null,
        };

        let existingSeason = await seasonsRepositoryTx.findBySourceUrl(seriesInput.sourceUrl);
        let parentSeriesId: string;

        if (existingSeason) {
          parentSeriesId = existingSeason.seriesId;
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
          sourceUrl: seriesInput.sourceUrl,
          source: seriesInput.source,
          title: seriesInput.title,
          description: seriesInput.description ?? null,
          posterUrl: seriesInput.posterUrl ?? null,
        });
        seasonId = seasonRow.id;

        let order = parseEpisodeOrder(input.episode.title);
        if (order === null) {
          const existing = await episodeRepositoryTx.findBySourceUrl(
            input.episode.sourceUrl
          );
          if (existing) {
            order = existing.order;
          } else {
            const maxOrder = await episodeRepositoryTx.getMaxOrder(seasonId);
            order = maxOrder + 1;
          }
        }

        const episodeRow = await episodeRepositoryTx.upsert({
          sourceUrl: input.episode.sourceUrl,
          source: input.episode.source,
          title: input.episode.title,
          order,
          videoType: input.episode.videoType ?? null,
          metadata: input.episode.metadata as ParsedMetadata,
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
            targetSeasonRow = childSeasons.find((s) => s.tmdbSeason === seasonNum);
          }

          if (!targetSeasonRow) {
            targetSeasonRow = childSeasons.find((s) => s.tmdbSeason == null) ?? childSeasons[0];
          }

          if (targetSeasonRow) {
            const seasonOverview = seasonDetails?.overview || details.overview;
            const seasonPoster = seasonDetails?.poster_path || details.poster_path;

            await seasonsRepositoryTx.updateSeason(targetSeasonRow.id, {
              tmdbId: details.id,
              tmdbSeason: seasonNum,
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
  };
}

export const createSaveEpisodeService = createMediaService;
