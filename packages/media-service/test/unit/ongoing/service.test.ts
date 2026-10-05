import { describe, expect, it, vi } from "vitest";
import type { PgDatabase } from "drizzle-orm/pg-core";
import { createOngoingScraperService } from "../../../src/internal/ongoing/service";
import { SeasonNotFoundError } from "../../../src/internal/seasons/repository";
import type { SeasonsRepository } from "../../../src/internal/seasons/repository";
import type { SeriesRepository } from "../../../src/internal/series/repository";
import type { EpisodeRepository } from "../../../src/internal/episodes/repository";
import type { VideoSourceRepository } from "../../../src/internal/video-sources/repository";
import type { SeasonRow, SeriesRow, EpisodeRow, VideoSourceRow } from "@repo/db";
import type { MediaScraper } from "@repo/media-scraper";

describe("createOngoingScraperService", () => {
  const dummyDb = {} as unknown as PgDatabase<never, Record<string, unknown>>;

  it("throws SeasonNotFoundError if target season is missing", async () => {
    const mockSeasonsRepo: SeasonsRepository = {
      findById: vi.fn().mockResolvedValue(null),
      upsert: vi.fn(),
      findBySeriesIdAndSeasonNumber: vi.fn(),
      updateSeason: vi.fn(),
      reparentSeasons: vi.fn(),
      deleteSeason: vi.fn(),
      findOngoingWithScraperUrl: vi.fn(),
      create: vi.fn(),
    };

    const service = createOngoingScraperService(dummyDb, {
      seasonsRepository: mockSeasonsRepo,
    });

    await expect(service.syncAndScrapeOngoingSeason("missing-season-id")).rejects.toThrow(
      SeasonNotFoundError
    );
  });

  it("returns error result and records lastScrapeError when season is not ongoing", async () => {
    const seasonRow: SeasonRow = {
      id: "s-1",
      seriesId: "series-1",
      title: "Season 1",
      description: null,
      posterUrl: null,
      seasonNumber: 1,
      status: "completed",
      scraperUrl: "https://otakudesu.cloud/anime/s1",
      source: "otakudesu",
      episodeOffset: 0,
      lastScrapedAt: null,
      lastScrapeError: null,
      tmdbSyncStatus: "PENDING",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const updateSeason = vi.fn().mockResolvedValue(seasonRow);
    const mockSeasonsRepo: SeasonsRepository = {
      findById: vi.fn().mockResolvedValue(seasonRow),
      updateSeason,
      upsert: vi.fn(),
      findBySeriesIdAndSeasonNumber: vi.fn(),
      reparentSeasons: vi.fn(),
      deleteSeason: vi.fn(),
      findOngoingWithScraperUrl: vi.fn(),
      create: vi.fn(),
    };

    const service = createOngoingScraperService(dummyDb, {
      seasonsRepository: mockSeasonsRepo,
    });

    const result = await service.syncAndScrapeOngoingSeason("s-1");

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not in ongoing status/i);
    expect(updateSeason).toHaveBeenCalledWith(
      "s-1",
      expect.objectContaining({
        lastScrapeError: expect.stringMatching(/not in ongoing status/i),
      })
    );
  });

  it("returns error result when scraperUrl is missing", async () => {
    const seasonRow: SeasonRow = {
      id: "s-1",
      seriesId: "series-1",
      title: "Season 1",
      description: null,
      posterUrl: null,
      seasonNumber: 1,
      status: "ongoing",
      scraperUrl: null,
      source: "otakudesu",
      episodeOffset: 0,
      lastScrapedAt: null,
      lastScrapeError: null,
      tmdbSyncStatus: "PENDING",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const updateSeason = vi.fn().mockResolvedValue(seasonRow);
    const mockSeasonsRepo: SeasonsRepository = {
      findById: vi.fn().mockResolvedValue(seasonRow),
      updateSeason,
      upsert: vi.fn(),
      findBySeriesIdAndSeasonNumber: vi.fn(),
      reparentSeasons: vi.fn(),
      deleteSeason: vi.fn(),
      findOngoingWithScraperUrl: vi.fn(),
      create: vi.fn(),
    };

    const service = createOngoingScraperService(dummyDb, {
      seasonsRepository: mockSeasonsRepo,
    });

    const result = await service.syncAndScrapeOngoingSeason("s-1");

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/missing scraperUrl or source/i);
    expect(updateSeason).toHaveBeenCalledWith(
      "s-1",
      expect.objectContaining({
        lastScrapeError: expect.stringMatching(/missing scraperUrl or source/i),
      })
    );
  });

  it("orchestrates TMDB sync and scrapes video sources into episode/videoSource repositories", async () => {
    const season: SeasonRow = {
      id: "s-1",
      seriesId: "series-1",
      title: "Season 1",
      description: null,
      posterUrl: null,
      seasonNumber: 1,
      status: "ongoing",
      scraperUrl: "https://otakudesu.cloud/anime/s1",
      source: "otakudesu",
      episodeOffset: 0,
      lastScrapedAt: null,
      lastScrapeError: null,
      tmdbSyncStatus: "PENDING",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const seriesData: SeriesRow = {
      id: "series-1",
      sourceUrl: "https://otakudesu.cloud/anime/series1",
      source: "otakudesu",
      title: "Test Anime",
      description: null,
      type: "tv",
      posterUrl: null,
      logoUrl: null,
      backdropUrl: null,
      rating: null,
      isFeatured: false,
      isOngoingHighlighted: false,
      tmdbId: 12345,
      seasonNumber: null,
      tmdbSyncStatus: "SYNCED",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockSeasonsRepo: SeasonsRepository = {
      findById: vi.fn().mockResolvedValue(season),
      updateSeason: vi.fn().mockResolvedValue(season),
      upsert: vi.fn(),
      findBySeriesIdAndSeasonNumber: vi.fn(),
      reparentSeasons: vi.fn(),
      deleteSeason: vi.fn(),
      findOngoingWithScraperUrl: vi.fn(),
      create: vi.fn(),
    };

    const mockSeriesRepo: SeriesRepository = {
      findById: vi.fn().mockResolvedValue(seriesData),
      findByIdWithEpisodes: vi
        .fn()
        // First call: before scraping
        .mockResolvedValueOnce({
          ...seriesData,
          seasons: [
            {
              ...season,
              episodes: [
                {
                  id: "ep-1",
                  seasonId: "s-1",
                  title: "Episode 1",
                  order: 1,
                  description: null,
                  duration: null,
                  rating: null,
                  airDate: null,
                  thumbnailUrl: null,
                  tmdbSeasonNumber: null,
                  tmdbEpisodeNumber: null,
                  isUnassigned: false,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                  videoSources: [],
                },
              ],
            },
          ],
          episodes: [],
        })
        // Second call: after scraping (for auto-completion check)
        .mockResolvedValueOnce({
          ...seriesData,
          seasons: [
            {
              ...season,
              episodes: [
                {
                  id: "ep-1",
                  seasonId: "s-1",
                  title: "Episode 1",
                  order: 1,
                  description: null,
                  duration: null,
                  rating: null,
                  airDate: null,
                  thumbnailUrl: null,
                  tmdbSeasonNumber: null,
                  tmdbEpisodeNumber: null,
                  isUnassigned: false,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                  videoSources: [
                    {
                      id: "vs-1",
                      episodeId: "ep-1",
                      type: "embed",
                      url: "https://embed.test/1",
                      label: "HD",
                      quality: "720p",
                      storageProviderId: null,
                      createdAt: new Date(),
                      updatedAt: new Date(),
                    },
                  ],
                },
              ],
            },
          ],
          episodes: [],
        }),
      upsert: vi.fn(),
      findByTmdbId: vi.fn(),
      list: vi.fn(),
      updateSeries: vi.fn(),
      deleteSeries: vi.fn(),
      getHomeFeed: vi.fn(),
    };

    const mockVideoSourceRepo: VideoSourceRepository = {
      upsert: vi.fn().mockResolvedValue({
        id: "vs-1",
        episodeId: "ep-1",
        type: "embed",
        url: "https://embed.test/1",
        label: "HD",
        quality: "720p",
        storageProviderId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } satisfies VideoSourceRow),
      findById: vi.fn(),
      findByEpisodeId: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteByEpisodeId: vi.fn(),
    };

    const mockEpisodeRepo: EpisodeRepository = {
      upsert: vi.fn().mockResolvedValue({
        id: "ep-1",
        seasonId: "s-1",
        title: "Episode 1",
        order: 1,
        description: null,
        duration: null,
        rating: null,
        airDate: null,
        thumbnailUrl: null,
        tmdbSeasonNumber: null,
        tmdbEpisodeNumber: null,
        isUnassigned: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      } satisfies EpisodeRow),
      findBySeasonIdAndOrder: vi.fn(),
      findById: vi.fn(),
      getMaxOrder: vi.fn(),
      list: vi.fn(),
      updateEpisode: vi.fn(),
      updateOrders: vi.fn(),
      deleteEpisode: vi.fn(),
    };

    const mockTmdbOrchestrator = {
      syncTmdb: vi.fn().mockResolvedValue({
        ...seriesData,
        seasons: [],
        episodes: [],
      }),
    };

    const mockProvider = {
      parseSeries: vi.fn().mockResolvedValue({
        title: "Test Anime",
        episodes: [
          {
            title: "Test Anime Episode 1",
            url: "https://otakudesu.cloud/episode/1",
          },
        ],
      }),
      resolveVideoSources: vi.fn().mockResolvedValue([
        {
          type: "embed" as const,
          url: "https://embed.test/1",
          label: "HD",
          quality: "720p",
        },
      ]),
    };

    const mockMediaScraper = {
      getProviderForUrl: vi.fn().mockReturnValue(mockProvider),
    } as unknown as typeof MediaScraper;

    const service = createOngoingScraperService(dummyDb, {
      seasonsRepository: mockSeasonsRepo,
      seriesRepository: mockSeriesRepo,
      episodeRepository: mockEpisodeRepo,
      videoSourceRepository: mockVideoSourceRepo,
      mediaScraper: mockMediaScraper,
      tmdbOrchestrator: mockTmdbOrchestrator,
    });

    const result = await service.syncAndScrapeOngoingSeason("s-1");

    expect(mockTmdbOrchestrator.syncTmdb).toHaveBeenCalledWith(
      "series-1",
      expect.objectContaining({ tmdbId: 12345, skipGenres: true })
    );
    expect(mockVideoSourceRepo.upsert).toHaveBeenCalledWith({
      episodeId: "ep-1",
      type: "embed",
      url: "https://embed.test/1",
      label: "HD",
      quality: "720p",
    });
    expect(result.success).toBe(true);
    expect(result.tmdbSynced).toBe(true);
    expect(result.episodesScraped).toBe(1);
    expect(result.sourcesSaved).toBe(1);
    expect(result.seasonCompleted).toBe(true);
  });

  it("scrapeAllOngoingSeasons iterates ongoing seasons and isolates single season failures", async () => {
    const season1: SeasonRow = {
      id: "s-1",
      seriesId: "series-1",
      title: "Season 1",
      description: null,
      posterUrl: null,
      seasonNumber: 1,
      status: "ongoing",
      scraperUrl: "https://otakudesu.cloud/anime/s1",
      source: "otakudesu",
      episodeOffset: 0,
      lastScrapedAt: null,
      lastScrapeError: null,
      tmdbSyncStatus: "PENDING",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const season2: SeasonRow = {
      ...season1,
      id: "s-2",
      seriesId: "series-2",
      title: "Season 2",
    };

    const mockSeasonsRepo: SeasonsRepository = {
      findOngoingWithScraperUrl: vi.fn().mockResolvedValue([season1, season2]),
      findById: vi.fn(),
      findBySeriesIdAndSeasonNumber: vi.fn(),
      updateSeason: vi.fn(),
      upsert: vi.fn(),
      reparentSeasons: vi.fn(),
      deleteSeason: vi.fn(),
      create: vi.fn(),
    };

    const service = createOngoingScraperService(dummyDb, {
      seasonsRepository: mockSeasonsRepo,
      ongoingScraper: {
        syncAndScrapeOngoingSeason: vi.fn().mockImplementation(async (id: string) => {
          if (id === "s-1") {
            return {
              seasonId: "s-1",
              seriesId: "series-1",
              success: true,
              tmdbSynced: true,
              episodesScraped: 1,
              sourcesSaved: 1,
              seasonCompleted: false,
            };
          }
          throw new Error("Scraper crashed for s-2");
        }),
      },
    });

    const batchResult = await service.scrapeAllOngoingSeasons();

    expect(batchResult.totalProcessed).toBe(2);
    expect(batchResult.successCount).toBe(1);
    expect(batchResult.failureCount).toBe(1);
    expect(batchResult.results[0].success).toBe(true);
    expect(batchResult.results[1].success).toBe(false);
    expect(batchResult.results[1].error).toContain("Scraper crashed for s-2");
  });
});
