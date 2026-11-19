import { describe, expect, it, vi, afterEach } from "vitest";
import { db } from "../../utils/db";
import { series, seasons, videoSources, episodes } from "@repo/db";
import { createOngoingScraperService } from "../../../src/internal/ongoing/service";
import { MediaScraper } from "@repo/media-scraper";

describe("createOngoingScraperService (integration)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("orchestrates TMDB sync and scrapes video sources into episode and videoSource tables", async () => {
    const now = new Date();
    const seriesId = "series-ongoing-svc";
    const seasonId = "season-ongoing-svc";

    await db.insert(series).values({
      id: seriesId,
      title: "Ongoing Service Show",
      type: "tv",
      tmdbId: 200,
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(seasons).values({
      id: seasonId,
      seriesId,
      seasonNumber: 1,
      title: "Season 1",
      status: "ongoing",
      scraperUrl: "https://otakudesu.cloud/anime/ongoing-svc",
      source: "otakudesu",
      episodeOffset: 0,
      createdAt: now,
      updatedAt: now,
    });

    vi.spyOn(MediaScraper, "getProviderForUrl").mockReturnValue({
      parseSeries: vi.fn().mockResolvedValue({
        title: "Ongoing Service Show",
        episodes: [
          {
            episodeNumber: 1,
            title: "Episode 1",
            url: "https://otakudesu.cloud/ep1",
          },
        ],
      }),
      resolveVideoSources: vi
        .fn()
        .mockResolvedValue([
          {
            type: "direct",
            quality: "720p",
            label: "Direct 720p",
            url: "https://storage.example.com/ep1.mp4",
          },
        ]),
    } as any);

    const mockTmdbOrchestrator = {
      syncTmdb: vi.fn().mockResolvedValue({ id: seriesId, seasons: [] } as any),
    };

    const service = createOngoingScraperService(db, {
      tmdbOrchestrator: mockTmdbOrchestrator,
    });

    const result = await service.syncAndScrapeOngoingSeason(seasonId);

    expect(result.success).toBe(true);
    expect(result.tmdbSynced).toBe(true);
    expect(result.episodesScraped).toBe(1);
    expect(result.sourcesSaved).toBe(1);

    expect(mockTmdbOrchestrator.syncTmdb).toHaveBeenCalledWith(
      seriesId,
      expect.objectContaining({ tmdbId: 200, skipGenres: true }),
    );

    const dbEpisodes = await db.select().from(episodes);
    expect(dbEpisodes.length).toBeGreaterThanOrEqual(1);

    const dbSources = await db.select().from(videoSources);
    expect(dbSources.length).toBeGreaterThanOrEqual(1);
    expect(dbSources[0]?.url).toBe("https://storage.example.com/ep1.mp4");
  });

  it("scrapeAllOngoingSeasons iterates ongoing seasons and isolates single season failures", async () => {
    const now = new Date();
    const seriesId = "series-batch-svc";

    await db.insert(series).values({
      id: seriesId,
      title: "Batch Show",
      type: "tv",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(seasons).values([
      {
        id: "s-ok",
        seriesId,
        seasonNumber: 1,
        title: "Season OK",
        status: "ongoing",
        scraperUrl: "https://otakudesu.cloud/anime/ok",
        source: "otakudesu",
        episodeOffset: 0,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "s-fail",
        seriesId,
        seasonNumber: 2,
        title: "Season Fail",
        status: "ongoing",
        scraperUrl: "https://otakudesu.cloud/anime/fail",
        source: "otakudesu",
        episodeOffset: 0,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    vi.spyOn(MediaScraper, "getProviderForUrl").mockImplementation(((
      url: string,
    ) => {
      if (url.includes("ok")) {
        return {
          parseSeries: vi.fn().mockResolvedValue({
            title: "OK",
            episodes: [
              {
                episodeNumber: 1,
                title: "Episode 1",
                url: "https://otakudesu.cloud/ep1",
              },
            ],
          }),
          resolveVideoSources: vi
            .fn()
            .mockResolvedValue([
              {
                type: "direct",
                quality: "720p",
                label: "720p",
                url: "https://storage.example.com/ok.mp4",
              },
            ]),
        };
      }
      throw new Error("Provider fail");
    }) as any);

    const service = createOngoingScraperService(db);
    const batch = await service.scrapeAllOngoingSeasons();

    expect(batch.totalProcessed).toBe(2);
    expect(batch.successCount).toBe(1);
    expect(batch.failureCount).toBe(1);
  });
});
