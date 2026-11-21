import { describe, it, expect, vi, afterEach } from "vitest";
import { db } from "../../utils/db";
import { series, seasons, episodes, videoSources } from "@repo/db";
import { createMediaService } from "../../../src";
import { MediaScraper } from "@repo/media-scraper";
import { setupTmdbFetchMock } from "../../fixtures/tmdb";

describe("ongoing scraper (integration)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("syncAndScrapeOngoingSeason end-to-end", () => {
    it("runs TMDB sync, scrapes missing sources, and sets season to completed if all episodes have sources", async () => {
      setupTmdbFetchMock();
      const now = new Date();
      const seriesId = "series-scrape-complete";
      const seasonId = "season-scrape-complete";

      await db.insert(series).values({
        id: seriesId,
        title: "Breaking Code",
        type: "tv",
        tmdbId: 100,
        isOngoingHighlighted: true,
        createdAt: now,
        updatedAt: now,
      });

      await db.insert(seasons).values({
        id: seasonId,
        seriesId,
        seasonNumber: 1,
        title: "Season 1",
        status: "ongoing",
        scraperUrl: "https://otakudesu.cloud/anime/breaking-code",
        source: "otakudesu",
        episodeOffset: 0,
        createdAt: now,
        updatedAt: now,
      });

      // Provider returns 2 episodes corresponding to the 2 TMDB episodes
      vi.spyOn(MediaScraper, "getProviderForUrl").mockReturnValue({
        parseSeries: vi.fn().mockResolvedValue({
          title: "Breaking Code",
          episodes: [
            {
              episodeNumber: 1,
              title: "Episode 1",
              url: "https://otakudesu.cloud/ep1",
            },
            {
              episodeNumber: 2,
              title: "Episode 2",
              url: "https://otakudesu.cloud/ep2",
            },
          ],
        }),
        resolveVideoSources: vi.fn().mockResolvedValue([
          {
            type: "direct",
            quality: "720p",
            label: "Direct 720p",
            url: "https://storage.example.com/video.mp4",
          },
        ]),
      } as any);

      const service = createMediaService(db, {
        fetchHtml: { get: vi.fn(), post: vi.fn() },
      });

      const result = await service.syncAndScrapeOngoingSeason(seasonId);
      expect(result.error).toBeUndefined();
      expect(result.success).toBe(true);
      expect(result.tmdbSynced).toBe(true);
      expect(result.seasonCompleted).toBe(true);

      // Verify real DB state
      const dbSeason = await db
        .select()
        .from(seasons)
        .where((db) => ({}) as any);
      const foundSeason = (await db.select().from(seasons)).find(
        (s) => s.id === seasonId,
      );
      expect(foundSeason?.status).toBe("completed");

      const dbSeries = (await db.select().from(series)).find(
        (s) => s.id === seriesId,
      );
      expect(dbSeries?.isOngoingHighlighted).toBe(false);

      const dbSources = await db.select().from(videoSources);
      expect(dbSources.length).toBeGreaterThanOrEqual(2);
    });

    it("applies episodeOffset when matching scraped episodes", async () => {
      setupTmdbFetchMock();
      const now = new Date();
      const seriesId = "series-offset";
      const seasonId = "season-offset";

      await db.insert(series).values({
        id: seriesId,
        title: "Offset Series",
        type: "tv",
        tmdbId: 100,
        createdAt: now,
        updatedAt: now,
      });

      await db.insert(seasons).values({
        id: seasonId,
        seriesId,
        seasonNumber: 1,
        title: "Season 1",
        status: "ongoing",
        scraperUrl: "https://otakudesu.cloud/anime/offset",
        source: "otakudesu",
        episodeOffset: 10,
        createdAt: now,
        updatedAt: now,
      });

      // Provider returns episode 11 (which corresponds to 11 - 10 = episode 1)
      vi.spyOn(MediaScraper, "getProviderForUrl").mockReturnValue({
        parseSeries: vi.fn().mockResolvedValue({
          title: "Offset Series",
          episodes: [
            {
              episodeNumber: 11,
              title: "Episode 11",
              url: "https://otakudesu.cloud/ep11",
            },
          ],
        }),
        resolveVideoSources: vi.fn().mockResolvedValue([
          {
            type: "direct",
            quality: "1080p",
            label: "Direct 1080p",
            url: "https://storage.example.com/11.mp4",
          },
        ]),
      } as any);

      const service = createMediaService(db, {
        fetchHtml: { get: vi.fn(), post: vi.fn() },
      });

      const result = await service.syncAndScrapeOngoingSeason(seasonId);
      expect(result.error).toBeUndefined();
      expect(result.success).toBe(true);
      expect(result.sourcesSaved).toBe(1);

      const dbSources = await db.select().from(videoSources);
      expect(dbSources.length).toBe(1);
    });
  });

  describe("scrapeAllOngoingSeasons batch isolation", () => {
    it("processes all ongoing seasons with scraper URLs and isolates errors", async () => {
      setupTmdbFetchMock();
      const now = new Date();
      const seriesId = "series-batch";

      await db.insert(series).values({
        id: seriesId,
        title: "Batch Series",
        type: "tv",
        tmdbId: 100,
        createdAt: now,
        updatedAt: now,
      });

      // Season 1: valid ongoing season
      await db.insert(seasons).values({
        id: "season-batch-ok",
        seriesId,
        seasonNumber: 1,
        title: "Season 1",
        status: "ongoing",
        scraperUrl: "https://otakudesu.cloud/anime/batch1",
        source: "otakudesu",
        episodeOffset: 0,
        createdAt: now,
        updatedAt: now,
      });

      // Season 2: ongoing season whose provider will fail
      await db.insert(seasons).values({
        id: "season-batch-fail",
        seriesId,
        seasonNumber: 2,
        title: "Season 2",
        status: "ongoing",
        scraperUrl: "https://otakudesu.cloud/anime/batch2",
        source: "otakudesu",
        episodeOffset: 0,
        createdAt: now,
        updatedAt: now,
      });

      vi.spyOn(MediaScraper, "getProviderForUrl").mockImplementation(((
        url: string,
      ) => {
        if (url.includes("batch1")) {
          return {
            parseSeries: vi.fn().mockResolvedValue({
              title: "Batch 1",
              episodes: [
                {
                  episodeNumber: 1,
                  title: "Episode 1",
                  url: "https://otakudesu.cloud/b1-ep1",
                },
              ],
            }),
            resolveVideoSources: vi.fn().mockResolvedValue([
              {
                type: "direct",
                quality: "720p",
                label: "Direct 720p",
                url: "https://storage.example.com/b1.mp4",
              },
            ]),
          };
        }
        throw new Error("Scraper network error on batch2");
      }) as any);

      const service = createMediaService(db, {
        fetchHtml: { get: vi.fn(), post: vi.fn() },
      });

      const batchResult = await service.scrapeAllOngoingSeasons();

      expect(batchResult.totalProcessed).toBe(2);
      expect(batchResult.successCount).toBe(1);
      expect(batchResult.failureCount).toBe(1);

      const failedSeason = (await db.select().from(seasons)).find(
        (s) => s.id === "season-batch-fail",
      );
      expect(failedSeason?.lastScrapeError).toMatch(/scraper network error/i);
    });
  });
});
