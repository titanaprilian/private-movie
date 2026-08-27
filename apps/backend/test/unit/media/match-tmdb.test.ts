import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { episodes, seasons, series, videoSources } from "@repo/db";
import { createMediaService } from "@repo/media-service";
import { db } from "../../utils/db";

describe("createMediaService matchTmdb reparenting and stub destruction", () => {
  const service = createMediaService(db);

  beforeEach(async () => {
    process.env.TMDB_API_KEY = "test-tmdb-key";
    vi.restoreAllMocks();
    await db.delete(videoSources);
    await db.delete(episodes);
    await db.delete(seasons);
    await db.delete(series);
  });

  it("updates series table with TMDB attributes for single series match", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockImplementation(async (input) => {
      const url = input.toString();
      if (url.includes("/tv/500")) {
        return new Response(
          JSON.stringify({
            id: 500,
            name: "Frieren: Beyond Journey's End",
            poster_path: "/frieren.jpg",
            overview: "An elf magician...",
            backdrop_path: "/frieren_bg.jpg",
            vote_average: 9.3,
            seasons: [
              {
                season_number: 1,
                name: "Season 1",
                poster_path: "/frieren_s1.jpg",
                overview: "Season 1 overview",
              },
            ],
          }),
          { status: 200 }
        );
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    });

    const [stubSeries] = await db
      .insert(series)
      .values({
        id: "series-stub-single",
        title: "Frieren Stub",
        type: "tv",
        tmdbSyncStatus: "PENDING",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    const [season] = await db
      .insert(seasons)
      .values({
        id: "season-1",
        seriesId: stubSeries.id,
        title: "Frieren Season 1",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    const result = await service.matchTmdb({
      seriesId: stubSeries.id,
      type: "tv",
      tmdbId: 500,
      season: 1,
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.themoviedb.org/3/tv/500?language=en-US",
      expect.anything()
    );

    expect(result.id).toBe(stubSeries.id);
    expect(result.title).toBe("Frieren: Beyond Journey's End");
    expect(result.tmdbId).toBe(500);
    expect(result.tmdbSyncStatus).toBe("SYNCED");

    const [updatedSeriesRow] = await db
      .select()
      .from(series)
      .where(eq(series.id, stubSeries.id));
    expect(updatedSeriesRow.tmdbId).toBe(500);
    expect(updatedSeriesRow.tmdbSyncStatus).toBe("SYNCED");
    expect(updatedSeriesRow.title).toBe("Frieren: Beyond Journey's End");
    expect(updatedSeriesRow.description).toBe("An elf magician...");

    const [updatedSeasonRow] = await db
      .select()
      .from(seasons)
      .where(eq(seasons.id, season.id));
    expect(updatedSeasonRow.seasonNumber).toBe(1);
    expect(updatedSeasonRow.description).toBe("Season 1 overview");
    expect(updatedSeasonRow.posterUrl).toBe("/frieren_s1.jpg");
    expect(updatedSeasonRow.tmdbSyncStatus).toBe("SYNCED");
  });

  it("reparents season and deletes orphan stub when TMDB ID matches existing series", async () => {
    vi.spyOn(global, "fetch").mockImplementation(async (input) => {
      const url = input.toString();
      if (url.includes("/tv/600")) {
        return new Response(
          JSON.stringify({
            id: 600,
            name: "Kaguya-sama: Love Is War",
            poster_path: "/kaguya.jpg",
            overview: "Student council battle",
            backdrop_path: "/kaguya_bg.jpg",
            vote_average: 8.9,
            seasons: [
              {
                season_number: 2,
                name: "Season 2",
                poster_path: "/kaguya_s2.jpg",
                overview: "Season 2 overview",
              },
            ],
          }),
          { status: 200 }
        );
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    });

    // 1. Pre-existing matched series (Season 1 already matched to TMDB 600)
    const [existingSeries] = await db
      .insert(series)
      .values({
        id: "series-parent-existing",
        title: "Kaguya-sama: Love Is War",
        type: "tv",
        tmdbId: 600,
        tmdbSyncStatus: "SYNCED",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    const [season1] = await db
      .insert(seasons)
      .values({
        id: "season-existing-1",
        seriesId: existingSeries.id,
        title: "Kaguya S1",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    // 2. Newly scraped Season 2 sitting in its own stub series
    const [stubSeries] = await db
      .insert(series)
      .values({
        id: "series-stub-to-delete",
        title: "Kaguya-sama S2 Scraped",
        type: "tv",
        tmdbSyncStatus: "PENDING",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    const [season2] = await db
      .insert(seasons)
      .values({
        id: "season-stub-2",
        seriesId: stubSeries.id,
        title: "Kaguya S2",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    // Perform match on the stub series
    const result = await service.matchTmdb({
      seriesId: stubSeries.id,
      type: "tv",
      tmdbId: 600,
      season: 2,
    });

    // Returned series should be the existing parent series
    expect(result.id).toBe(existingSeries.id);

    // Verify season2 repointed to existingSeries.id
    const [updatedSeason2] = await db
      .select()
      .from(seasons)
      .where(eq(seasons.id, season2.id));
    expect(updatedSeason2.seriesId).toBe(existingSeries.id);

    // Verify stubSeries is destroyed (deleted from series table)
    const stubRows = await db
      .select()
      .from(series)
      .where(eq(series.id, stubSeries.id));
    expect(stubRows).toHaveLength(0);
  });

  it("adheres to strict isolation: only updates the target season row and ignores other seasons", async () => {
    vi.spyOn(global, "fetch").mockImplementation(async (input) => {
      const url = input.toString();
      if (url.includes("/tv/700")) {
        return new Response(
          JSON.stringify({
            id: 700,
            name: "Multi Season Show",
            poster_path: "/show.jpg",
            overview: "Overview of show",
            backdrop_path: "/show_bg.jpg",
            vote_average: 8.0,
            seasons: [
              { season_number: 1, name: "TMDB Season 1", poster_path: "/tmdb_s1.jpg", overview: "TMDB S1 overview" },
              { season_number: 2, name: "TMDB Season 2", poster_path: "/tmdb_s2.jpg", overview: "TMDB S2 overview" },
            ],
          }),
          { status: 200 }
        );
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    });

    const [targetSeries] = await db
      .insert(series)
      .values({
        id: "series-multi-season",
        title: "Multi Season Show",
        type: "tv",
        tmdbSyncStatus: "PENDING",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    const [season1] = await db
      .insert(seasons)
      .values({
        id: "season-local-1",
        seriesId: targetSeries.id,
        title: "Local Season 1",
        description: "Original S1 desc",
        posterUrl: "/original_s1.jpg",
        seasonNumber: 1,
        tmdbSyncStatus: "SYNCED",
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
      })
      .returning();

    const [season2] = await db
      .insert(seasons)
      .values({
        id: "season-local-2",
        seriesId: targetSeries.id,
        title: "Local Season 2",
        tmdbSyncStatus: "PENDING",
        createdAt: new Date("2024-01-02"),
        updatedAt: new Date("2024-01-02"),
      })
      .returning();

    // Match specifically season 2
    await service.matchTmdb({
      seriesId: targetSeries.id,
      type: "tv",
      tmdbId: 700,
      season: 2,
    });

    // Check Season 2 was updated
    const [updatedSeason2] = await db.select().from(seasons).where(eq(seasons.id, season2.id));
    expect(updatedSeason2.seasonNumber).toBe(2);
    expect(updatedSeason2.description).toBe("TMDB S2 overview");
    expect(updatedSeason2.posterUrl).toBe("/tmdb_s2.jpg");
    expect(updatedSeason2.tmdbSyncStatus).toBe("SYNCED");

    // Check Season 1 remained untouched (Strict Isolation)
    const [untouchedSeason1] = await db.select().from(seasons).where(eq(seasons.id, season1.id));
    expect(untouchedSeason1.seasonNumber).toBe(1);
    expect(untouchedSeason1.description).toBe("Original S1 desc");
    expect(untouchedSeason1.posterUrl).toBe("/original_s1.jpg");
    expect(untouchedSeason1.tmdbSyncStatus).toBe("SYNCED");
  });
});
