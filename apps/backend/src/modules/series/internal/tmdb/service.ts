import type { DbClient } from "@repo/db";
import {
  MediaScraper,
  type FetchFn as ScraperFetchFn,
} from "@repo/media-scraper";
import { SeriesNotFoundError, SeriesFetchError } from "../errors";
import { createSeriesRepository } from "../catalog/repository";
import { createTmdbRepository } from "./repository";
import { fetchTmdbSeriesData, getTmdbPreview, defaultFetchHtml } from "./utils/tmdb-client";
import { matchScrapedEpisodes } from "./utils/episode-matcher";
import { computeSyncDiff } from "./utils/sync-diff";
import type {
  BulkPreviewLocalEpisodeItem,
  PreviewBulkSourcesInput,
  PreviewBulkSourcesResult,
  PreviewScrapeSeriesInput,
  PreviewScrapeSeriesResult,
  TmdbImportInput,
  TmdbService,
  TmdbServiceOptions,
  TmdbSyncInput,
  TmdbSyncPreviewInput,
  TmdbSyncPreviewResult,
  VideoSource,
} from "./types";

export function tmdbService(db: DbClient, options?: TmdbServiceOptions): TmdbService {
  const tmdbRepository = createTmdbRepository(db);
  const catalogRepository = createSeriesRepository(db);
  const fetchHtml = options?.fetchHtml ?? defaultFetchHtml;

  async function previewScrapeSeries(
    input: PreviewScrapeSeriesInput
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
        if (url === input.sourceUrl && html) return html;
        return fetchHtml.get(url);
      },
      post: (url: string, body: string) => fetchHtml.post(url, body),
    };

    const parsed = await provider.parseSeries(input.sourceUrl, effectiveFetch);
    return {
      series: {
        sourceUrl: input.sourceUrl,
        source: input.source as VideoSource,
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
  }

  async function previewBulkSources(
    input: PreviewBulkSourcesInput
  ): Promise<PreviewBulkSourcesResult> {
    const targetSeries = await catalogRepository.findById(input.seriesId);
    if (!targetSeries) {
      throw new SeriesNotFoundError(`Series with id ${input.seriesId} not found`);
    }

    const parsedSeries = await previewScrapeSeries({
      sourceUrl: input.sourceUrl,
      source: input.source,
      html: input.html,
    });

    const fullSeries = await catalogRepository.findByIdWithEpisodes(input.seriesId);
    const localEpisodes: BulkPreviewLocalEpisodeItem[] = [];
    const localEpisodesMapByOrder = new Map<number, string>();

    if (fullSeries?.seasons) {
      for (const s of fullSeries.seasons) {
        if (input.seasonId && s.id !== input.seasonId) continue;
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

    const scrapedEpisodes = matchScrapedEpisodes(
      parsedSeries.episodes,
      localEpisodesMapByOrder,
      input.episodeOffset ?? 0
    );

    return { scrapedEpisodes, localEpisodes };
  }

  async function getTmdbSyncPreview(
    seriesId: string,
    input: TmdbSyncPreviewInput
  ): Promise<TmdbSyncPreviewResult> {
    const existingSeries = await tmdbRepository.findByIdWithEpisodes(seriesId);
    if (!existingSeries) {
      throw new SeriesNotFoundError(`Series with id ${seriesId} not found`);
    }

    const data = await fetchTmdbSeriesData(input.tmdbId, {
      type: input.type,
      includeSpecials: input.includeSpecials,
    });

    const diff = computeSyncDiff(existingSeries, data);
    const incomingRating = data.voteAverage ? String(data.voteAverage) : null;

    return {
      seriesId,
      seriesUpdated: diff.seriesUpdated,
      series: {
        title: data.title,
        overview: data.description,
        posterUrl: data.posterPath,
        backdropUrl: data.backdropPath,
        logoUrl: data.logoUrl,
        rating: incomingRating,
        releaseDate: data.firstAirDate,
        genres: data.genres,
      },
      totalNewEpisodes: diff.totalNewEpisodes,
      totalNewSeasons: diff.totalNewSeasons,
      totalUpdatedEpisodes: diff.totalUpdatedEpisodes,
      seasonDiffs: diff.seasonDiffs,
      episodeChanges: diff.episodeChanges,
    };
  }

  return {
    async getTmdbPreview(type: "tv" | "movie", tmdbId: number, includeSpecials?: boolean) {
      return getTmdbPreview(tmdbId, { type, includeSpecials });
    },

    async importTmdb(input: TmdbImportInput) {
      const data = await fetchTmdbSeriesData(input.tmdbId, {
        type: input.type,
        includeSpecials: input.includeSpecials,
      });
      return tmdbRepository.saveTmdbSeries(data);
    },

    getTmdbSyncPreview,

    async syncTmdb(seriesId: string, input: TmdbSyncInput) {
      const existingSeries = await tmdbRepository.findById(seriesId);
      if (!existingSeries) {
        throw new SeriesNotFoundError(`Series with id ${seriesId} not found`);
      }

      const data = await fetchTmdbSeriesData(input.tmdbId, {
        type: input.type,
        includeSpecials: input.includeSpecials,
      });

      await tmdbRepository.syncTmdbSeries(seriesId, data, {
        skipGenres: input.skipGenres,
        type: input.type,
      });

      const updated = await tmdbRepository.findByIdWithEpisodes(seriesId);
      return updated!;
    },

    previewScrapeSeries,
    previewBulkSources,
  };
}

