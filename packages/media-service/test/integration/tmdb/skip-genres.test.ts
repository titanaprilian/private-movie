import { describe, it, expect, vi, afterEach } from "vitest";
import { db } from "../../utils/db";
import { series, seasons, genres, seriesToGenres } from "@repo/db";
import { createMediaService } from "../../../src";
import { MediaScraper } from "@repo/media-scraper";
import { setupTmdbFetchMock } from "../../fixtures/tmdb";

describe("syncTmdb skipGenres (integration)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("preserves seriesToGenres relations when skipGenres is true", async () => {
    const fetchSpy = setupTmdbFetchMock();
    const now = new Date();

    const seriesId = "s1";
    await db.insert(series).values({
      id: seriesId,
      title: "Show",
      type: "tv",
      tmdbId: 100,
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(genres).values({
      id: "custom-genre-id",
      name: "Custom Anime Genre",
      slug: "custom-anime-genre",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(seriesToGenres).values({
      seriesId,
      genreId: "custom-genre-id",
    });

    const service = createMediaService(db);
    await service.syncTmdb(seriesId, {
      type: "tv",
      tmdbId: 100,
      skipGenres: true,
    });

    const currentGenres = await db
      .select()
      .from(seriesToGenres)
      .where(
        (db) =>
          ({
            // Using drizzle query
          }) as any,
      );

    const relations = await db.select().from(seriesToGenres);
    expect(relations).toHaveLength(1);
    expect(relations[0]?.genreId).toBe("custom-genre-id");
  });

  it("deletes and replaces seriesToGenres by default", async () => {
    const fetchSpy = setupTmdbFetchMock();
    const now = new Date();

    const seriesId = "s1";
    await db.insert(series).values({
      id: seriesId,
      title: "Show",
      type: "tv",
      tmdbId: 100,
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(genres).values({
      id: "old-genre",
      name: "Old Genre",
      slug: "old-genre",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(seriesToGenres).values({
      seriesId,
      genreId: "old-genre",
    });

    const service = createMediaService(db);
    await service.syncTmdb(seriesId, { type: "tv", tmdbId: 100 });

    const relations = await db.select().from(seriesToGenres);
    // TMDB fixture has 2 genres: Drama (18) and Crime (80)
    expect(relations.length).toBeGreaterThanOrEqual(1);
    expect(relations.map((r) => r.genreId)).not.toContain("old-genre");
  });

  it("syncAndScrapeOngoingSeason preserves series genres via skipGenres:true", async () => {
    setupTmdbFetchMock();
    const now = new Date();

    const seriesId = "series-ongoing-1";
    await db.insert(series).values({
      id: seriesId,
      title: "Ongoing Show",
      type: "tv",
      tmdbId: 100,
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(genres).values({
      id: "genre-preserved",
      name: "Preserved Genre",
      slug: "preserved-genre",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(seriesToGenres).values({
      seriesId,
      genreId: "genre-preserved",
    });

    const seasonId = "season-ongoing-1";
    await db.insert(seasons).values({
      id: seasonId,
      seriesId,
      seasonNumber: 1,
      title: "Season 1",
      status: "ongoing",
      scraperUrl: "https://otakudesu.cloud/anime/example",
      source: "otakudesu",
      episodeOffset: 0,
      createdAt: now,
      updatedAt: now,
    });

    vi.spyOn(MediaScraper, "getProviderForUrl").mockReturnValue({
      parseSeries: vi
        .fn()
        .mockResolvedValue({ title: "Ongoing Show", episodes: [] }),
      resolveVideoSources: vi.fn(),
    } as any);

    const service = createMediaService(db, {
      fetchHtml: { get: vi.fn(), post: vi.fn() },
    });

    await service.syncAndScrapeOngoingSeason(seasonId);

    const relations = await db.select().from(seriesToGenres);
    expect(relations.map((r) => r.genreId)).toContain("genre-preserved");
  });
});
