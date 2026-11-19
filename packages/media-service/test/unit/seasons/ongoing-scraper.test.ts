import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  createMediaService,
  SeasonNotFoundError,
  type MediaService,
} from "../../../src/index";
import { seasons, series } from "@repo/db";
import { MediaScraper } from "@repo/media-scraper";

describe("syncAndScrapeOngoingSeason (unit guards)", () => {
  let mockDb: any;
  let mockFetchHtml: any;
  let service: MediaService;

  beforeEach(() => {
    mockFetchHtml = {
      get: vi.fn(),
      post: vi.fn(),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
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
      await expect(
        service.syncAndScrapeOngoingSeason("non-existent-season"),
      ).rejects.toThrow(SeasonNotFoundError);
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
                returning: vi
                  .fn()
                  .mockResolvedValue([{ ...seasonRow, ...data }]),
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
                returning: vi
                  .fn()
                  .mockResolvedValue([{ ...seasonRow, ...data }]),
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
                returning: vi
                  .fn()
                  .mockResolvedValue([{ ...seasonRow, ...data }]),
              }),
            };
          }),
        }),
      };

      const mockProvider = {
        name: "otakudesu",
        canHandle: () => true,
        parseSeries: vi
          .fn()
          .mockRejectedValue(new Error("Cloudflare 503 blocked")),
        parseEpisode: () => {},
        resolveVideoSources: () => {},
      };
      vi.spyOn(MediaScraper, "getProviderForUrl").mockReturnValue(
        mockProvider as any,
      );

      service = createMediaService(mockDb, { fetchHtml: mockFetchHtml });
      const result = await service.syncAndScrapeOngoingSeason("s-1");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Cloudflare 503 blocked");
      expect(updateSet.lastScrapeError).toContain("Cloudflare 503 blocked");
      expect(updateSet.lastScrapedAt).toBeInstanceOf(Date);
    });
  });
});
