import { describe, expect, it, vi } from "vitest";
import type { PgDatabase } from "drizzle-orm/pg-core";
import {
  createBulkServiceInternal,
  SeriesNotFoundError,
} from "../../../src/index";
import type {
  PreviewBulkSourcesInput,
  SaveBulkSourcesInput,
} from "../../../src/index";
import type {
  SeriesRepository,
  SeriesWithEpisodes,
} from "../../../src/internal/series/repository";
import type { VideoSourceRepository } from "../../../src/internal/video-sources/repository";
import type { SeriesRow } from "@repo/db";

describe("createBulkServiceInternal (unit)", () => {
  const dummyDb = {} as unknown as PgDatabase<never, Record<string, unknown>>;

  describe("previewBulkSources", () => {
    it("throws SeriesNotFoundError when target series does not exist", async () => {
      const mockSeriesRepo: Pick<
        SeriesRepository,
        "findById" | "findByIdWithEpisodes"
      > = {
        findById: vi.fn().mockResolvedValue(null),
        findByIdWithEpisodes: vi.fn(),
      };
      const mockPreviewScrape = vi.fn();

      const service = createBulkServiceInternal(dummyDb, {
        previewScrapeSeries: mockPreviewScrape,
        seriesRepository: mockSeriesRepo,
      });

      const input: PreviewBulkSourcesInput = {
        seriesId: "non-existent-id",
        sourceUrl: "https://otakudesu.cloud/anime/non-existent",
        source: "otakudesu",
      };

      await expect(service.previewBulkSources(input)).rejects.toThrow(
        SeriesNotFoundError,
      );
      await expect(service.previewBulkSources(input)).rejects.toThrow(
        "Series with id non-existent-id not found",
      );
      expect(mockSeriesRepo.findById).toHaveBeenCalledWith("non-existent-id");
      expect(mockPreviewScrape).not.toHaveBeenCalled();
    });

    it("previews and correlates scraped episodes with local episodes", async () => {
      const seriesRow: SeriesRow = {
        id: "series-1",
        title: "Test Anime",
        description: null,
        posterUrl: null,
        type: "tv",
        tmdbId: 12345,
        tmdbSyncStatus: "SYNCED",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const fullSeries: SeriesWithEpisodes = {
        ...seriesRow,
        genres: [],
        seasons: [
          {
            id: "season-1",
            seriesId: "series-1",
            seasonNumber: 1,
            title: "Season 1",
            description: null,
            posterUrl: null,
            status: "completed",
            scraperUrl: null,
            source: null,
            episodeOffset: 0,
            lastScrapedAt: null,
            lastScrapeError: null,
            tmdbSyncStatus: "SYNCED",
            createdAt: new Date(),
            updatedAt: new Date(),
            episodes: [
              {
                id: "ep-1",
                seasonId: "season-1",
                order: 1,
                title: "Episode 1",
                description: null,
                duration: 24,
                aired: null,
                tmdbSeasonNumber: 1,
                tmdbEpisodeNumber: 1,
                filler: false,
                recap: false,
                createdAt: new Date(),
                updatedAt: new Date(),
                videoSources: [],
              },
              {
                id: "ep-2",
                seasonId: "season-1",
                order: 2,
                title: "Episode 2",
                description: null,
                duration: 24,
                aired: null,
                tmdbSeasonNumber: 1,
                tmdbEpisodeNumber: 2,
                filler: false,
                recap: false,
                createdAt: new Date(),
                updatedAt: new Date(),
                videoSources: [
                  {
                    id: "vs-1",
                    episodeId: "ep-2",
                    type: "embed",
                    url: "https://stream.example/embed/1",
                    label: "StreamSB",
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
      };

      const mockSeriesRepo: Pick<
        SeriesRepository,
        "findById" | "findByIdWithEpisodes"
      > = {
        findById: vi.fn().mockResolvedValue(seriesRow),
        findByIdWithEpisodes: vi.fn().mockResolvedValue(fullSeries),
      };

      const mockPreviewScrape = vi.fn().mockResolvedValue({
        episodes: [
          {
            title: "Test Anime Episode 1 Sub Indo",
            url: "https://otakudesu.cloud/ep1",
          },
          {
            title: "Test Anime Episode 2 Sub Indo",
            url: "https://otakudesu.cloud/ep2",
          },
          {
            title: "Test Anime Episode 2.5 Recap",
            url: "https://otakudesu.cloud/ep2-5",
          },
          {
            title: "Test Anime Special OVA",
            url: "https://otakudesu.cloud/special",
          },
          {
            title: "Test Anime Episode 99 Sub Indo",
            url: "https://otakudesu.cloud/ep99",
          },
        ],
      });

      const service = createBulkServiceInternal(dummyDb, {
        previewScrapeSeries: mockPreviewScrape,
        seriesRepository: mockSeriesRepo,
      });

      const input: PreviewBulkSourcesInput = {
        seriesId: "series-1",
        sourceUrl: "https://otakudesu.cloud/anime/test-anime",
        source: "otakudesu",
        html: "<html>content</html>",
      };

      const result = await service.previewBulkSources(input);

      expect(mockPreviewScrape).toHaveBeenCalledWith({
        sourceUrl: input.sourceUrl,
        source: input.source,
        html: input.html,
      });

      expect(result.localEpisodes).toEqual([
        {
          id: "ep-1",
          title: "Episode 1",
          order: 1,
          seasonId: "season-1",
          seasonNumber: 1,
          seasonTitle: "Season 1",
          hasSources: false,
        },
        {
          id: "ep-2",
          title: "Episode 2",
          order: 2,
          seasonId: "season-1",
          seasonNumber: 1,
          seasonTitle: "Season 1",
          hasSources: true,
        },
      ]);

      expect(result.scrapedEpisodes).toEqual([
        {
          scrapedTitle: "Test Anime Episode 1 Sub Indo",
          scrapedUrl: "https://otakudesu.cloud/ep1",
          episodeNumber: 1,
          calculatedOrder: 1,
          matchedLocalEpisodeId: "ep-1",
          matchStatus: "matched",
        },
        {
          scrapedTitle: "Test Anime Episode 2 Sub Indo",
          scrapedUrl: "https://otakudesu.cloud/ep2",
          episodeNumber: 2,
          calculatedOrder: 2,
          matchedLocalEpisodeId: "ep-2",
          matchStatus: "matched",
        },
        {
          scrapedTitle: "Test Anime Episode 2.5 Recap",
          scrapedUrl: "https://otakudesu.cloud/ep2-5",
          episodeNumber: 2.5,
          calculatedOrder: null,
          matchedLocalEpisodeId: null,
          matchStatus: "unmatched",
        },
        {
          scrapedTitle: "Test Anime Special OVA",
          scrapedUrl: "https://otakudesu.cloud/special",
          episodeNumber: null,
          calculatedOrder: null,
          matchedLocalEpisodeId: null,
          matchStatus: "unmatched",
        },
        {
          scrapedTitle: "Test Anime Episode 99 Sub Indo",
          scrapedUrl: "https://otakudesu.cloud/ep99",
          episodeNumber: 99,
          calculatedOrder: 99,
          matchedLocalEpisodeId: null,
          matchStatus: "unmatched",
        },
      ]);
    });

    it("applies episodeOffset to calculate target order and match local episodes", async () => {
      const seriesRow: SeriesRow = {
        id: "series-offset",
        title: "Offset Anime",
        description: null,
        posterUrl: null,
        type: "tv",
        tmdbId: null,
        tmdbSyncStatus: "PENDING",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const fullSeries: SeriesWithEpisodes = {
        ...seriesRow,
        genres: [],
        seasons: [
          {
            id: "season-2",
            seriesId: "series-offset",
            seasonNumber: 2,
            title: "Season 2",
            description: null,
            posterUrl: null,
            status: "ongoing",
            scraperUrl: null,
            source: null,
            episodeOffset: 12,
            lastScrapedAt: null,
            lastScrapeError: null,
            tmdbSyncStatus: "PENDING",
            createdAt: new Date(),
            updatedAt: new Date(),
            episodes: [
              {
                id: "ep-13",
                seasonId: "season-2",
                order: 13,
                title: "Episode 13",
                description: null,
                duration: 24,
                aired: null,
                tmdbSeasonNumber: 2,
                tmdbEpisodeNumber: 1,
                filler: false,
                recap: false,
                createdAt: new Date(),
                updatedAt: new Date(),
                videoSources: [],
              },
            ],
          },
        ],
      };

      const mockSeriesRepo: Pick<
        SeriesRepository,
        "findById" | "findByIdWithEpisodes"
      > = {
        findById: vi.fn().mockResolvedValue(seriesRow),
        findByIdWithEpisodes: vi.fn().mockResolvedValue(fullSeries),
      };

      const mockPreviewScrape = vi.fn().mockResolvedValue({
        episodes: [
          {
            title: "Offset Anime Episode 1 Sub Indo",
            url: "https://otakudesu.cloud/ep1",
          },
        ],
      });

      const service = createBulkServiceInternal(dummyDb, {
        previewScrapeSeries: mockPreviewScrape,
        seriesRepository: mockSeriesRepo,
      });

      const result = await service.previewBulkSources({
        seriesId: "series-offset",
        sourceUrl: "https://otakudesu.cloud/anime/offset",
        source: "otakudesu",
        episodeOffset: 12,
      });

      expect(result.scrapedEpisodes[0]).toEqual({
        scrapedTitle: "Offset Anime Episode 1 Sub Indo",
        scrapedUrl: "https://otakudesu.cloud/ep1",
        episodeNumber: 1,
        calculatedOrder: 13,
        matchedLocalEpisodeId: "ep-13",
        matchStatus: "matched",
      });
    });

    it("filters local episodes by seasonId when seasonId is specified", async () => {
      const seriesRow: SeriesRow = {
        id: "series-filtered",
        title: "Multi Season Anime",
        description: null,
        posterUrl: null,
        type: "tv",
        tmdbId: null,
        tmdbSyncStatus: "PENDING",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const fullSeries: SeriesWithEpisodes = {
        ...seriesRow,
        genres: [],
        seasons: [
          {
            id: "season-1",
            seriesId: "series-filtered",
            seasonNumber: 1,
            title: "Season 1",
            description: null,
            posterUrl: null,
            status: "completed",
            scraperUrl: null,
            source: null,
            episodeOffset: 0,
            lastScrapedAt: null,
            lastScrapeError: null,
            tmdbSyncStatus: "PENDING",
            createdAt: new Date(),
            updatedAt: new Date(),
            episodes: [
              {
                id: "ep-s1-1",
                seasonId: "season-1",
                order: 1,
                title: "S1 Ep 1",
                description: null,
                duration: 24,
                aired: null,
                tmdbSeasonNumber: 1,
                tmdbEpisodeNumber: 1,
                filler: false,
                recap: false,
                createdAt: new Date(),
                updatedAt: new Date(),
                videoSources: [],
              },
            ],
          },
          {
            id: "season-2",
            seriesId: "series-filtered",
            seasonNumber: 2,
            title: "Season 2",
            description: null,
            posterUrl: null,
            status: "ongoing",
            scraperUrl: null,
            source: null,
            episodeOffset: 0,
            lastScrapedAt: null,
            lastScrapeError: null,
            tmdbSyncStatus: "PENDING",
            createdAt: new Date(),
            updatedAt: new Date(),
            episodes: [
              {
                id: "ep-s2-1",
                seasonId: "season-2",
                order: 1,
                title: "S2 Ep 1",
                description: null,
                duration: 24,
                aired: null,
                tmdbSeasonNumber: 2,
                tmdbEpisodeNumber: 1,
                filler: false,
                recap: false,
                createdAt: new Date(),
                updatedAt: new Date(),
                videoSources: [],
              },
            ],
          },
        ],
      };

      const mockSeriesRepo: Pick<
        SeriesRepository,
        "findById" | "findByIdWithEpisodes"
      > = {
        findById: vi.fn().mockResolvedValue(seriesRow),
        findByIdWithEpisodes: vi.fn().mockResolvedValue(fullSeries),
      };

      const mockPreviewScrape = vi.fn().mockResolvedValue({
        episodes: [
          {
            title: "Multi Season Anime Episode 1 Sub Indo",
            url: "https://otakudesu.cloud/ep1",
          },
        ],
      });

      const service = createBulkServiceInternal(dummyDb, {
        previewScrapeSeries: mockPreviewScrape,
        seriesRepository: mockSeriesRepo,
      });

      const result = await service.previewBulkSources({
        seriesId: "series-filtered",
        sourceUrl: "https://otakudesu.cloud/anime/filtered",
        source: "otakudesu",
        seasonId: "season-2",
      });

      expect(result.localEpisodes).toHaveLength(1);
      expect(result.localEpisodes[0].id).toBe("ep-s2-1");
      expect(result.scrapedEpisodes[0].matchedLocalEpisodeId).toBe("ep-s2-1");
    });

    it("handles fullSeries with no seasons gracefully", async () => {
      const seriesRow: SeriesRow = {
        id: "series-empty",
        title: "Empty Anime",
        description: null,
        posterUrl: null,
        type: "tv",
        tmdbId: null,
        tmdbSyncStatus: "PENDING",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockSeriesRepo: Pick<
        SeriesRepository,
        "findById" | "findByIdWithEpisodes"
      > = {
        findById: vi.fn().mockResolvedValue(seriesRow),
        findByIdWithEpisodes: vi.fn().mockResolvedValue(null),
      };

      const mockPreviewScrape = vi.fn().mockResolvedValue({
        episodes: [
          {
            title: "Empty Anime Episode 1 Sub Indo",
            url: "https://otakudesu.cloud/ep1",
          },
        ],
      });

      const service = createBulkServiceInternal(dummyDb, {
        previewScrapeSeries: mockPreviewScrape,
        seriesRepository: mockSeriesRepo,
      });

      const result = await service.previewBulkSources({
        seriesId: "series-empty",
        sourceUrl: "https://otakudesu.cloud/anime/empty",
        source: "otakudesu",
      });

      expect(result.localEpisodes).toEqual([]);
      expect(result.scrapedEpisodes[0]).toEqual({
        scrapedTitle: "Empty Anime Episode 1 Sub Indo",
        scrapedUrl: "https://otakudesu.cloud/ep1",
        episodeNumber: 1,
        calculatedOrder: 1,
        matchedLocalEpisodeId: null,
        matchStatus: "unmatched",
      });
    });

    it("preserves first occurrence when local episodes share duplicate orders", async () => {
      const seriesRow: SeriesRow = {
        id: "series-dup",
        title: "Dup Anime",
        description: null,
        posterUrl: null,
        type: "tv",
        tmdbId: null,
        tmdbSyncStatus: "PENDING",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const fullSeries: SeriesWithEpisodes = {
        ...seriesRow,
        genres: [],
        seasons: [
          {
            id: "season-dup",
            seriesId: "series-dup",
            seasonNumber: 1,
            title: "Season 1",
            description: null,
            posterUrl: null,
            status: "completed",
            scraperUrl: null,
            source: null,
            episodeOffset: 0,
            lastScrapedAt: null,
            lastScrapeError: null,
            tmdbSyncStatus: "PENDING",
            createdAt: new Date(),
            updatedAt: new Date(),
            episodes: [
              {
                id: "ep-dup-1",
                seasonId: "season-dup",
                order: 1,
                title: "Ep 1 First",
                description: null,
                duration: 24,
                aired: null,
                tmdbSeasonNumber: 1,
                tmdbEpisodeNumber: 1,
                filler: false,
                recap: false,
                createdAt: new Date(),
                updatedAt: new Date(),
                videoSources: [],
              },
              {
                id: "ep-dup-2",
                seasonId: "season-dup",
                order: 1,
                title: "Ep 1 Duplicate",
                description: null,
                duration: 24,
                aired: null,
                tmdbSeasonNumber: 1,
                tmdbEpisodeNumber: 1,
                filler: false,
                recap: false,
                createdAt: new Date(),
                updatedAt: new Date(),
                videoSources: [],
              },
            ],
          },
        ],
      };

      const mockSeriesRepo: Pick<
        SeriesRepository,
        "findById" | "findByIdWithEpisodes"
      > = {
        findById: vi.fn().mockResolvedValue(seriesRow),
        findByIdWithEpisodes: vi.fn().mockResolvedValue(fullSeries),
      };

      const mockPreviewScrape = vi.fn().mockResolvedValue({
        episodes: [
          {
            title: "Dup Anime Episode 1 Sub Indo",
            url: "https://otakudesu.cloud/ep1",
          },
        ],
      });

      const service = createBulkServiceInternal(dummyDb, {
        previewScrapeSeries: mockPreviewScrape,
        seriesRepository: mockSeriesRepo,
      });

      const result = await service.previewBulkSources({
        seriesId: "series-dup",
        sourceUrl: "https://otakudesu.cloud/anime/dup",
        source: "otakudesu",
      });

      expect(result.localEpisodes).toHaveLength(2);
      expect(result.scrapedEpisodes[0].matchedLocalEpisodeId).toBe("ep-dup-1");
    });
  });

  describe("saveBulkSources", () => {
    it("upserts video sources for valid mappings and counts skipped empty mappings", async () => {
      const mockVideoSourceRepo: Pick<VideoSourceRepository, "upsert"> = {
        upsert: vi.fn().mockResolvedValue({} as never),
      };

      const service = createBulkServiceInternal(dummyDb, {
        previewScrapeSeries: vi.fn(),
        videoSourceRepository: mockVideoSourceRepo,
      });

      const input: SaveBulkSourcesInput = {
        seriesId: "series-1",
        mappings: [
          {
            episodeId: "ep-1",
            videoSources: [
              {
                type: "embed",
                url: "https://stream.example/embed1",
                label: "StreamSB",
                quality: "720p",
              },
              {
                type: "direct",
                url: "https://stream.example/direct1.mp4",
                label: "Direct MP4",
              },
            ],
          },
          {
            episodeId: null,
            videoSources: [
              {
                type: "embed",
                url: "https://stream.example/skip1",
                label: "StreamSB",
              },
            ],
          },
          {
            episodeId: "ep-3",
            videoSources: [],
          },
        ],
      };

      const result = await service.saveBulkSources(input);

      expect(result).toEqual({
        success: true,
        savedCount: 1,
        skippedCount: 2,
      });

      expect(mockVideoSourceRepo.upsert).toHaveBeenCalledTimes(2);
      expect(mockVideoSourceRepo.upsert).toHaveBeenNthCalledWith(1, {
        episodeId: "ep-1",
        type: "embed",
        url: "https://stream.example/embed1",
        label: "StreamSB",
        quality: "720p",
      });
      expect(mockVideoSourceRepo.upsert).toHaveBeenNthCalledWith(2, {
        episodeId: "ep-1",
        type: "direct",
        url: "https://stream.example/direct1.mp4",
        label: "Direct MP4",
        quality: null,
      });
    });

    it("returns zero counts when mappings list is empty", async () => {
      const mockVideoSourceRepo: Pick<VideoSourceRepository, "upsert"> = {
        upsert: vi.fn(),
      };

      const service = createBulkServiceInternal(dummyDb, {
        previewScrapeSeries: vi.fn(),
        videoSourceRepository: mockVideoSourceRepo,
      });

      const result = await service.saveBulkSources({
        seriesId: "series-1",
        mappings: [],
      });

      expect(result).toEqual({
        success: true,
        savedCount: 0,
        skippedCount: 0,
      });
      expect(mockVideoSourceRepo.upsert).not.toHaveBeenCalled();
    });
  });

  describe("repository instantiation fallback", () => {
    it("instantiates default repositories when not provided in deps", () => {
      const service = createBulkServiceInternal(dummyDb, {
        previewScrapeSeries: vi.fn(),
      });

      expect(service).toBeDefined();
      expect(typeof service.previewBulkSources).toBe("function");
      expect(typeof service.saveBulkSources).toBe("function");
    });
  });
});
