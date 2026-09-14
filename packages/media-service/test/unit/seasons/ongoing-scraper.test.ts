import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  createMediaService,
  SeasonNotFoundError,
  type MediaService,
} from "../../../src/index";
import { seasons, series, episodes, videoSources } from "@repo/db";
import { MediaScraper } from "@repo/media-scraper";
import * as tmdbService from "../../../src/internal/tmdb/service";

describe("syncAndScrapeOngoingSeason & scrapeAllOngoingSeasons", () => {
  let mockDb: any;
  let mockFetchHtml: any;
  let service: MediaService;

  beforeEach(() => {
    mockFetchHtml = {
      get: vi.fn(),
      post: vi.fn(),
    };
  });

  describe("validation & error handling", () => {
    it("throws SeasonNotFoundError if season does not exist", async () => {
      mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
      };
      service = createMediaService(mockDb, { fetchHtml: mockFetchHtml });
      await expect(service.syncAndScrapeOngoingSeason("non-existent-season")).rejects.toThrow(
        SeasonNotFoundError
      );
    });

    it("returns error result and records lastScrapeError if season is not ongoing", async () => {
      const seasonRow = {
        id: "s-1",
        seriesId: "series-1",
        title: "Season 1",
        status: "completed",
        scraperUrl: "https://otakudesu.cloud/anime/example",
        source: "otakudesu",
        episodeOffset: 0,
      };

      let updateSet: any = null;
      mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([seasonRow]),
          }),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockImplementation((data) => {
            updateSet = data;
            return {
              where: vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([{ ...seasonRow, ...data }]),
              }),
            };
          }),
        }),
      };

      service = createMediaService(mockDb, { fetchHtml: mockFetchHtml });
      const result = await service.syncAndScrapeOngoingSeason("s-1");

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/ongoing/i);
      expect(updateSet.lastScrapeError).toMatch(/ongoing/i);
      expect(updateSet.lastScrapedAt).toBeInstanceOf(Date);
    });

    it("returns error result and records lastScrapeError if scraperUrl or source is missing", async () => {
      const seasonRow = {
        id: "s-1",
        seriesId: "series-1",
        title: "Season 1",
        status: "ongoing",
        scraperUrl: null,
        source: null,
        episodeOffset: 0,
      };

      let updateSet: any = null;
      mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([seasonRow]),
          }),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockImplementation((data) => {
            updateSet = data;
            return {
              where: vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([{ ...seasonRow, ...data }]),
              }),
            };
          }),
        }),
      };

      service = createMediaService(mockDb, { fetchHtml: mockFetchHtml });
      const result = await service.syncAndScrapeOngoingSeason("s-1");

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/scraperUrl/i);
      expect(updateSet.lastScrapeError).toBeDefined();
    });

    it("records lastScrapeError and returns failure if scraping provider throws", async () => {
      const seasonRow = {
        id: "s-1",
        seriesId: "series-1",
        title: "Season 1",
        status: "ongoing",
        scraperUrl: "https://otakudesu.cloud/anime/example",
        source: "otakudesu",
        episodeOffset: 0,
      };
      const seriesRow = {
        id: "series-1",
        title: "Example Anime",
        tmdbId: null,
      };

      let updateSet: any = null;
      mockDb = {
        select: vi.fn().mockImplementation(() => ({
          from: vi.fn().mockImplementation((table) => ({
            where: vi.fn().mockImplementation(() => {
              if (table === seasons) return Promise.resolve([seasonRow]);
              if (table === series) return Promise.resolve([seriesRow]);
              return Promise.resolve([]);
            }),
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockResolvedValue([]),
              }),
            }),
            orderBy: vi.fn().mockResolvedValue([]),
          })),
        })),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockImplementation((data) => {
            updateSet = data;
            return {
              where: vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([{ ...seasonRow, ...data }]),
              }),
            };
          }),
        }),
      };

      const mockProvider = {
        name: "otakudesu",
        canHandle: vi.fn().mockReturnValue(true),
        parseSeries: vi.fn().mockRejectedValue(new Error("Cloudflare 503 blocked")),
        parseEpisode: vi.fn(),
        resolveVideoSources: vi.fn(),
      };
      vi.spyOn(MediaScraper, "getProviderForUrl").mockReturnValue(mockProvider as any);

      service = createMediaService(mockDb, { fetchHtml: mockFetchHtml });
      const result = await service.syncAndScrapeOngoingSeason("s-1");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Cloudflare 503 blocked");
      expect(updateSet.lastScrapeError).toContain("Cloudflare 503 blocked");
      expect(updateSet.lastScrapedAt).toBeInstanceOf(Date);
    });
  });

  describe("TMDB sync & episode source scraping & auto-completion", () => {
    it("runs TMDB sync first if series has tmdbId, scrapes missing sources, and sets season to completed if all TMDB episodes have sources", async () => {
      const seasonRow = {
        id: "s-1",
        seriesId: "series-1",
        seasonNumber: 1,
        title: "Season 1",
        status: "ongoing",
        scraperUrl: "https://otakudesu.cloud/anime/example",
        source: "otakudesu",
        episodeOffset: 0,
      };
      const seriesRow = {
        id: "series-1",
        title: "Example Anime",
        type: "tv",
        tmdbId: 9999,
      };

      const tmdbFullData = {
        tmdbId: 9999,
        type: "tv" as const,
        title: "Example Anime",
        description: "Test description",
        posterPath: null,
        backdropPath: null,
        firstAirDate: null,
        voteAverage: null,
        genres: [],
        seasons: [
          {
            seasonNumber: 1,
            name: "Season 1",
            overview: null,
            posterPath: null,
            airDate: null,
            episodes: [
              { episode_number: 1, name: "Episode 1" },
              { episode_number: 2, name: "Episode 2" },
            ],
          },
        ],
      };

      vi.spyOn(tmdbService, "fetchTmdbSeriesData").mockResolvedValue(tmdbFullData);

      const ep1 = {
        id: "ep-1",
        seasonId: "s-1",
        order: 1,
        title: "Episode 1",
      };
      const ep2 = {
        id: "ep-2",
        seasonId: "s-1",
        order: 2,
        title: "Episode 2",
      };
      const vs1 = {
        id: "vs-1",
        episodeId: "ep-1",
        type: "embed",
        url: "https://stream.com/embed1",
        label: "StreamSB",
        quality: "720p",
      };

      const mockProvider = {
        name: "otakudesu",
        canHandle: vi.fn().mockReturnValue(true),
        parseSeries: vi.fn().mockResolvedValue({
          title: "Example Anime",
          episodes: [
            { title: "Episode 2 Sub Indo", url: "https://otakudesu.cloud/episode/ep-2" },
            { title: "Episode 1 Sub Indo", url: "https://otakudesu.cloud/episode/ep-1" },
          ],
        }),
        parseEpisode: vi.fn(),
        resolveVideoSources: vi.fn().mockImplementation((url) => {
          if (url === "https://otakudesu.cloud/episode/ep-2") {
            return Promise.resolve([
              { type: "embed", url: "https://stream.com/embed2", label: "StreamSB", quality: "720p" },
              { type: "direct", url: "https://stream.com/direct2.mp4", label: "MP4Upload", quality: "720p" },
              { type: "s3", url: "s3://bucket/ignored.mp4", label: "S3", quality: "720p" },
            ]);
          }
          return Promise.resolve([]);
        }),
      };
      vi.spyOn(MediaScraper, "getProviderForUrl").mockReturnValue(mockProvider as any);

      const insertedSources: any[] = [];
      let updatedSeasonStatus: string | null = null;
      let lastScrapedAtRecorded: Date | null = null;
      let lastScrapeErrorRecorded: any = "initial";

      mockDb = {
        transaction: vi.fn().mockImplementation(async (cb) => {
          const tx = {
            update: vi.fn().mockReturnValue({
              set: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([]),
              }),
            }),
            delete: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([]),
            }),
            insert: vi.fn().mockReturnValue({
              values: vi.fn().mockReturnValue({
                onConflictDoUpdate: vi.fn().mockReturnValue({
                  returning: vi.fn().mockResolvedValue([{ id: "s-1" }]),
                }),
                onConflictDoNothing: vi.fn().mockResolvedValue([]),
              }),
            }),
          };
          return await cb(tx);
        }),
        select: vi.fn().mockImplementation((selectFields) => ({
          from: vi.fn().mockImplementation((table) => ({
            where: vi.fn().mockImplementation((cond) => {
              if (table === seasons) {
                return {
                  orderBy: vi.fn().mockResolvedValue([seasonRow]),
                  then: (resolve: any) => resolve([seasonRow]),
                };
              }
              if (table === series) {
                return Promise.resolve([seriesRow]);
              }
              if (table === episodes) {
                return {
                  orderBy: vi.fn().mockResolvedValue([ep1, ep2]),
                  then: (resolve: any) => resolve([ep1, ep2]),
                };
              }
              if (table === videoSources) {
                return {
                  orderBy: vi.fn().mockResolvedValue([vs1, ...insertedSources]),
                  then: (resolve: any) => resolve([vs1, ...insertedSources]),
                };
              }
              return Promise.resolve([]);
            }),
            orderBy: vi.fn().mockResolvedValue([]),
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockResolvedValue([]),
              }),
            }),
          })),
        })),
        insert: vi.fn().mockImplementation((table) => ({
          values: vi.fn().mockImplementation((val) => {
            if (table === videoSources) {
              insertedSources.push(val);
            }
            return {
              onConflictDoUpdate: vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([val]),
              }),
            };
          }),
        })),
        update: vi.fn().mockImplementation((table) => ({
          set: vi.fn().mockImplementation((data) => {
            if (table === seasons) {
              if (data.status) updatedSeasonStatus = data.status;
              if ("lastScrapedAt" in data) lastScrapedAtRecorded = data.lastScrapedAt;
              if ("lastScrapeError" in data) lastScrapeErrorRecorded = data.lastScrapeError;
            }
            return {
              where: vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([{ ...seasonRow, ...data }]),
              }),
            };
          }),
        })),
      };

      service = createMediaService(mockDb, { fetchHtml: mockFetchHtml });
      const result = await service.syncAndScrapeOngoingSeason("s-1");

      expect(result.success).toBe(true);
      expect(result.tmdbSynced).toBe(true);
      expect(result.episodesScraped).toBe(1); // Only ep 2 was scraped, ep 1 already had sources
      expect(result.sourcesSaved).toBe(2); // Only embed and direct, s3 excluded
      expect(result.seasonCompleted).toBe(true); // All 2 episodes now have sources

      // Ep 1 was NOT re-resolved
      expect(mockProvider.resolveVideoSources).toHaveBeenCalledTimes(1);
      expect(mockProvider.resolveVideoSources).toHaveBeenCalledWith(
        "https://otakudesu.cloud/episode/ep-2",
        expect.anything(),
        undefined,
        undefined
      );

      // Verify S3 sources were excluded
      expect(insertedSources.some((s) => s.type === "s3")).toBe(false);
      expect(insertedSources.length).toBe(2);

      // Verify season update
      expect(updatedSeasonStatus).toBe("completed");
      expect(lastScrapedAtRecorded).toBeInstanceOf(Date);
      expect(lastScrapeErrorRecorded).toBeNull();
    });

    it("applies episodeOffset when matching scraped episodes", async () => {
      const seasonRow = {
        id: "s-2",
        seriesId: "series-1",
        seasonNumber: 2,
        title: "Season 2",
        status: "ongoing",
        scraperUrl: "https://otakudesu.cloud/anime/season-2",
        source: "otakudesu",
        episodeOffset: 12,
      };
      const seriesRow = {
        id: "series-1",
        title: "Example Anime",
        type: "tv",
        tmdbId: null,
      };

      const ep13 = {
        id: "ep-13",
        seasonId: "s-2",
        order: 13,
        title: "Episode 13",
      };

      const mockProvider = {
        name: "otakudesu",
        canHandle: vi.fn().mockReturnValue(true),
        parseSeries: vi.fn().mockResolvedValue({
          title: "Example Anime Season 2",
          episodes: [
            { title: "Episode 1 Sub Indo", url: "https://otakudesu.cloud/episode/s2-ep-1" },
          ],
        }),
        parseEpisode: vi.fn(),
        resolveVideoSources: vi.fn().mockResolvedValue([
          { type: "embed", url: "https://stream.com/s2ep1", label: "StreamSB" },
        ]),
      };
      vi.spyOn(MediaScraper, "getProviderForUrl").mockReturnValue(mockProvider as any);

      const insertedSources: any[] = [];
      mockDb = {
        select: vi.fn().mockImplementation(() => ({
          from: vi.fn().mockImplementation((table) => ({
            where: vi.fn().mockImplementation(() => {
              if (table === seasons) {
                return {
                  orderBy: vi.fn().mockResolvedValue([seasonRow]),
                  then: (resolve: any) => resolve([seasonRow]),
                };
              }
              if (table === series) return Promise.resolve([seriesRow]);
              if (table === episodes) {
                return {
                  orderBy: vi.fn().mockResolvedValue([ep13]),
                  then: (resolve: any) => resolve([ep13]),
                };
              }
              if (table === videoSources) {
                return {
                  orderBy: vi.fn().mockResolvedValue(insertedSources),
                  then: (resolve: any) => resolve(insertedSources),
                };
              }
              return Promise.resolve([]);
            }),
            orderBy: vi.fn().mockResolvedValue([]),
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockResolvedValue([]),
              }),
            }),
          })),
        })),
        insert: vi.fn().mockImplementation((table) => ({
          values: vi.fn().mockImplementation((val) => {
            if (table === videoSources) insertedSources.push(val);
            return {
              onConflictDoUpdate: vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([val]),
              }),
            };
          }),
        })),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([seasonRow]),
            }),
          }),
        }),
      };

      service = createMediaService(mockDb, { fetchHtml: mockFetchHtml });
      const result = await service.syncAndScrapeOngoingSeason("s-2");

      expect(result.success).toBe(true);
      expect(result.episodesScraped).toBe(1);
      expect(insertedSources.length).toBe(1);
      expect(insertedSources[0].episodeId).toBe("ep-13");
    });

    it("works with Dramula provider as well", async () => {
      const seasonRow = {
        id: "s-dramula",
        seriesId: "series-kdrama",
        seasonNumber: 1,
        title: "Season 1",
        status: "ongoing",
        scraperUrl: "https://dramula.com/series/example-kdrama",
        source: "dramula",
        episodeOffset: 0,
      };
      const seriesRow = {
        id: "series-kdrama",
        title: "Example KDrama",
        type: "tv",
        tmdbId: null,
      };

      const ep1 = {
        id: "ep-d1",
        seasonId: "s-dramula",
        order: 1,
        title: "Episode 1",
      };

      const mockProvider = {
        name: "dramula",
        canHandle: vi.fn().mockReturnValue(true),
        parseSeries: vi.fn().mockResolvedValue({
          title: "Example KDrama",
          episodes: [
            { title: "Episode 1", url: "https://dramula.com/watch/example-kdrama/s1e1" },
          ],
        }),
        parseEpisode: vi.fn(),
        resolveVideoSources: vi.fn().mockResolvedValue([
          { type: "embed", url: "https://bellocloud.com/embed1", label: "BelloCloud" },
        ]),
      };
      vi.spyOn(MediaScraper, "getProviderForUrl").mockReturnValue(mockProvider as any);

      const insertedSources: any[] = [];
      mockDb = {
        select: vi.fn().mockImplementation(() => ({
          from: vi.fn().mockImplementation((table) => ({
            where: vi.fn().mockImplementation(() => {
              if (table === seasons) {
                return {
                  orderBy: vi.fn().mockResolvedValue([seasonRow]),
                  then: (resolve: any) => resolve([seasonRow]),
                };
              }
              if (table === series) return Promise.resolve([seriesRow]);
              if (table === episodes) {
                return {
                  orderBy: vi.fn().mockResolvedValue([ep1]),
                  then: (resolve: any) => resolve([ep1]),
                };
              }
              if (table === videoSources) {
                return {
                  orderBy: vi.fn().mockResolvedValue(insertedSources),
                  then: (resolve: any) => resolve(insertedSources),
                };
              }
              return Promise.resolve([]);
            }),
            orderBy: vi.fn().mockResolvedValue([]),
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockResolvedValue([]),
              }),
            }),
          })),
        })),
        insert: vi.fn().mockImplementation((table) => ({
          values: vi.fn().mockImplementation((val) => {
            if (table === videoSources) insertedSources.push(val);
            return {
              onConflictDoUpdate: vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([val]),
              }),
            };
          }),
        })),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([seasonRow]),
            }),
          }),
        }),
      };

      service = createMediaService(mockDb, { fetchHtml: mockFetchHtml });
      const result = await service.syncAndScrapeOngoingSeason("s-dramula");

      expect(result.success).toBe(true);
      expect(result.episodesScraped).toBe(1);
      expect(insertedSources.length).toBe(1);
      expect(insertedSources[0].episodeId).toBe("ep-d1");
      expect(insertedSources[0].url).toBe("https://bellocloud.com/embed1");
    });
  });

  describe("scrapeAllOngoingSeasons", () => {
    it("processes all ongoing seasons with scraper URLs and isolates errors", async () => {
      const season1 = {
        id: "s-1",
        seriesId: "series-1",
        title: "Season 1",
        status: "ongoing",
        scraperUrl: "https://otakudesu.cloud/anime/s1",
        source: "otakudesu",
        episodeOffset: 0,
      };
      const season2 = {
        id: "s-2",
        seriesId: "series-2",
        title: "Season 2",
        status: "ongoing",
        scraperUrl: "https://otakudesu.cloud/anime/s2",
        source: "otakudesu",
        episodeOffset: 0,
      };

      mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([season1, season2]),
          }),
        }),
      };

      service = createMediaService(mockDb, { fetchHtml: mockFetchHtml });

      vi.spyOn(service, "syncAndScrapeOngoingSeason").mockImplementation(async (id) => {
        if (id === "s-1") {
          return {
            seasonId: "s-1",
            seriesId: "series-1",
            success: true,
            tmdbSynced: false,
            episodesScraped: 1,
            sourcesSaved: 2,
            seasonCompleted: false,
          };
        }
        throw new Error("Scraper crashed for season 2");
      });

      const batchResult = await service.scrapeAllOngoingSeasons();

      expect(batchResult.totalProcessed).toBe(2);
      expect(batchResult.successCount).toBe(1);
      expect(batchResult.failureCount).toBe(1);
      expect(batchResult.results[0].success).toBe(true);
      expect(batchResult.results[1].success).toBe(false);
      expect(batchResult.results[1].error).toContain("Scraper crashed for season 2");
    });
  });
});
