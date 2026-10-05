import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { MediaScraper, type FetchFn as ScraperFetchFn, type BrowserFn } from "@repo/media-scraper";
import {
  createSeasonsRepositoryInternal,
  SeasonNotFoundError,
  type SeasonsRepository,
} from "../seasons/repository";
import {
  createSeriesRepositoryInternal,
  type SeriesRepository,
  type SeriesWithEpisodes,
} from "../series/repository";
import {
  createEpisodeRepositoryInternal,
  type EpisodeRepository,
} from "../episodes/repository";
import {
  createVideoSourceRepositoryInternal,
  type VideoSourceRepository,
} from "../video-sources/repository";
import { parseBulkScrapedEpisodeNumber, SeriesFetchError } from "../../index";
import type { TmdbSyncInput } from "../tmdb/service";

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

export interface TmdbOrchestrator {
  syncTmdb(seriesId: string, input: TmdbSyncInput): Promise<SeriesWithEpisodes>;
}

export interface OngoingScraperServiceDependencies {
  seasonsRepository?: SeasonsRepository;
  seriesRepository?: SeriesRepository;
  episodeRepository?: EpisodeRepository;
  videoSourceRepository?: VideoSourceRepository;
  mediaScraper?: typeof MediaScraper;
  tmdbOrchestrator?: TmdbOrchestrator;
  ongoingScraper?: Pick<OngoingScraperService, "syncAndScrapeOngoingSeason">;
  fetchHtml?: ScraperFetchFn;
  browserFn?: BrowserFn;
}

export interface OngoingScraperService {
  syncAndScrapeOngoingSeason(seasonId: string): Promise<OngoingScrapeResult>;
  scrapeAllOngoingSeasons(): Promise<BatchOngoingScrapeResult>;
}

export function createOngoingScraperService<
  THKT extends PgQueryResultHKT,
  TSchema extends Record<string, unknown> = Record<string, unknown>,
>(
  db: PgDatabase<THKT, TSchema>,
  deps?: OngoingScraperServiceDependencies
): OngoingScraperService {
  const seasonsRepository = deps?.seasonsRepository ?? createSeasonsRepositoryInternal(db);
  const seriesRepository = deps?.seriesRepository ?? createSeriesRepositoryInternal(db);
  const episodeRepository = deps?.episodeRepository ?? createEpisodeRepositoryInternal(db);
  const videoSourceRepository = deps?.videoSourceRepository ?? createVideoSourceRepositoryInternal(db);
  const mediaScraper = deps?.mediaScraper ?? MediaScraper;
  const fetchHtml = deps?.fetchHtml ?? {
    get: async (url: string) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      return res.text();
    },
    post: async (url: string, body?: string) => {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      return res.text();
    },
  };
  const browserFn = deps?.browserFn;

  const service: OngoingScraperService = {
    async syncAndScrapeOngoingSeason(seasonId: string): Promise<OngoingScrapeResult> {
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
        if (targetSeries?.tmdbId && deps?.tmdbOrchestrator) {
          try {
            await deps.tmdbOrchestrator.syncTmdb(targetSeries.id, {
              type: targetSeries.type === "movie" ? "movie" : "tv",
              tmdbId: targetSeries.tmdbId,
              skipGenres: true,
            });
            tmdbSynced = true;
          } catch (tmdbErr) {
            console.warn(
              `[media-service] TMDB sync failed for series ${targetSeries.id} during ongoing scrape:`,
              tmdbErr instanceof Error ? tmdbErr.message : tmdbErr
            );
          }
        }

        const provider = mediaScraper.getProviderForUrl(targetSeason.scraperUrl);
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
            browserFn
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
      const ongoingSeasons = await seasonsRepository.findOngoingWithScraperUrl();
      const results: OngoingScrapeResult[] = [];
      const scrapeSingle = deps?.ongoingScraper?.syncAndScrapeOngoingSeason
        ? deps.ongoingScraper.syncAndScrapeOngoingSeason.bind(deps.ongoingScraper)
        : service.syncAndScrapeOngoingSeason;

      for (const season of ongoingSeasons) {
        try {
          const result = await scrapeSingle(season.id);
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

  return service;
}
