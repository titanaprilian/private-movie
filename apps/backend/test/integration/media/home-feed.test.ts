import { describe, expect, it, beforeAll } from "vitest";
import { genres, series, seasons, episodes, videoSources, seriesToGenres } from "@repo/db";
import { buildApp, request, type App } from "../../utils/app";
import { db } from "../../utils/db";

describe("GET /series/home-feed", () => {
  let app: App;

  beforeAll(async () => {
    app = await buildApp();
  });

  it("returns null hero and empty rows items when database has 0 series", async () => {
    const response = await request(app, { path: "/series/home-feed" });

    expect(response.status).toBe(200);
    const body = response.body as {
      data: {
        hero: unknown;
        rows: Array<{ title: string; items: unknown[] }>;
      };
    };

    expect(body.data.hero).toBeNull();
    expect(body.data.rows).toHaveLength(3);
    expect(body.data.rows[0].title).toBe("Ongoing");
    expect(body.data.rows[0].items).toEqual([]);
    expect(body.data.rows[1].title).toBe("Korean Drama");
    expect(body.data.rows[1].items).toEqual([]);
    expect(body.data.rows[2].title).toBe("Recently Added");
    expect(body.data.rows[2].items).toEqual([]);
  });

  it("excludes series without video sources from hero, ongoing, and recently added rows", async () => {
    const now = new Date();

    // Series A: Featured and has an Ongoing season, but NO video sources attached
    const seriesNoSourcesId = crypto.randomUUID();
    await db.insert(series).values({
      id: seriesNoSourcesId,
      title: "Empty Series",
      description: "No video sources",
      type: "tv",
      isFeatured: true,
      createdAt: now,
      updatedAt: now,
    });

    const seasonId = crypto.randomUUID();
    await db.insert(seasons).values({
      id: seasonId,
      seriesId: seriesNoSourcesId,
      title: "Season 1",
      seasonNumber: 1,
      status: "ongoing",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(episodes).values({
      id: crypto.randomUUID(),
      title: "Episode 1",
      order: 1,
      seasonId,
      createdAt: now,
      updatedAt: now,
    });
    // Intentionally no video_sources inserted!

    const response = await request(app, { path: "/series/home-feed" });

    expect(response.status).toBe(200);
    const body = response.body as {
      data: {
        hero: unknown;
        rows: Array<{ title: string; items: unknown[] }>;
      };
    };

    expect(body.data.hero).toBeNull();
    expect(body.data.rows).toHaveLength(3);
    expect(body.data.rows[0].title).toBe("Ongoing");
    expect(body.data.rows[0].items).toHaveLength(0);
    expect(body.data.rows[1].title).toBe("Korean Drama");
    expect(body.data.rows[1].items).toHaveLength(0);
    expect(body.data.rows[2].title).toBe("Recently Added");
    expect(body.data.rows[2].items).toHaveLength(0);
  });

  it("returns populated hero, ongoing, and recently added rows when series have video sources", async () => {
    const now = new Date();
    const olderDate = new Date(now.getTime() - 100000);
    const newerDate = new Date(now.getTime() - 10000);

    const genreId = crypto.randomUUID();
    await db.insert(genres).values({
      id: genreId,
      name: "Action",
      slug: "action",
      createdAt: now,
      updatedAt: now,
    });

    // Series 1: Featured & Has an Ongoing season with video sources
    const tvSeriesId = crypto.randomUUID();
    await db.insert(series).values({
      id: tvSeriesId,
      title: "Demon Slayer",
      description: "Demon hunting anime",
      type: "tv",
      isFeatured: true,
      posterUrl: "https://example.com/demon.jpg",
      createdAt: olderDate,
      updatedAt: newerDate,
    });

    await db.insert(seriesToGenres).values({
      seriesId: tvSeriesId,
      genreId,
    });

    const season1Id = crypto.randomUUID();
    await db.insert(seasons).values({
      id: season1Id,
      seriesId: tvSeriesId,
      title: "Season 1",
      seasonNumber: 1,
      status: "completed",
      createdAt: olderDate,
      updatedAt: olderDate,
    });

    const season2Id = crypto.randomUUID();
    await db.insert(seasons).values({
      id: season2Id,
      seriesId: tvSeriesId,
      title: "Season 2",
      seasonNumber: 2,
      status: "ongoing",
      createdAt: now,
      updatedAt: now,
    });

    const ep1Id = crypto.randomUUID();
    await db.insert(episodes).values({
      id: ep1Id,
      title: "Episode 1",
      order: 1,
      seasonId: season1Id,
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(videoSources).values({
      id: crypto.randomUUID(),
      episodeId: ep1Id,
      type: "hls",
      url: "https://example.com/stream.m3u8",
      label: "720p",
      createdAt: now,
      updatedAt: now,
    });

    // Series 2: Completed seasons only, with video sources
    const movieSeriesId = crypto.randomUUID();
    await db.insert(series).values({
      id: movieSeriesId,
      title: "Your Name",
      description: "Anime film",
      type: "movie",
      isFeatured: false,
      posterUrl: "https://example.com/yourname.jpg",
      createdAt: now,
      updatedAt: olderDate,
    });

    const movieSeasonId = crypto.randomUUID();
    await db.insert(seasons).values({
      id: movieSeasonId,
      seriesId: movieSeriesId,
      title: "Movie Season",
      seasonNumber: 1,
      status: "completed",
      createdAt: now,
      updatedAt: now,
    });

    const ep2Id = crypto.randomUUID();
    await db.insert(episodes).values({
      id: ep2Id,
      title: "Movie Episode",
      order: 1,
      seasonId: movieSeasonId,
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(videoSources).values({
      id: crypto.randomUUID(),
      episodeId: ep2Id,
      type: "hls",
      url: "https://example.com/movie.m3u8",
      label: "1080p",
      createdAt: now,
      updatedAt: now,
    });

    // Series 3: Featured & Ongoing season WITHOUT video sources (should be excluded)
    const emptyOngoingId = crypto.randomUUID();
    await db.insert(series).values({
      id: emptyOngoingId,
      title: "Empty Ongoing Series",
      type: "tv",
      isFeatured: true,
      createdAt: now,
      updatedAt: now,
    });

    const emptySeasonId = crypto.randomUUID();
    await db.insert(seasons).values({
      id: emptySeasonId,
      seriesId: emptyOngoingId,
      title: "Season 1",
      seasonNumber: 1,
      status: "ongoing",
      createdAt: now,
      updatedAt: now,
    });

    const response = await request(app, { path: "/series/home-feed" });

    expect(response.status).toBe(200);
    const body = response.body as {
      data: {
        hero: {
          id: string;
          title: string;
          type: string;
          tags: string[];
          genres: Array<{ id: string; name: string; slug: string }>;
          seasonsCount: number;
          episodesCount: number;
        };
        rows: Array<{
          title: string;
          items: Array<{
            id: string;
            title: string;
            type: string;
            genres: Array<{ id: string; name: string }>;
            seasonsCount: number;
            episodesCount: number;
          }>;
        }>;
      };
    };

    expect(body.data.hero).not.toBeNull();
    expect(body.data.hero.id).toBe(tvSeriesId);
    expect(body.data.hero.title).toBe("Demon Slayer");
    expect(body.data.hero.tags).toContain("TV Series");
    expect(body.data.hero.tags).toContain("Action");
    expect(body.data.hero.genres).toHaveLength(1);
    expect(body.data.hero.genres[0].name).toBe("Action");
    expect(body.data.hero.seasonsCount).toBe(2);
    expect(body.data.hero.episodesCount).toBe(1);

    expect(body.data.rows).toHaveLength(3);

    const ongoingRow = body.data.rows[0];
    expect(ongoingRow.title).toBe("Ongoing");
    expect(ongoingRow.items).toHaveLength(1);
    expect(ongoingRow.items[0].id).toBe(tvSeriesId);

    const koreanDramaRow = body.data.rows[1];
    expect(koreanDramaRow.title).toBe("Korean Drama");
    expect(koreanDramaRow.items).toHaveLength(0);

    const recentlyAddedRow = body.data.rows[2];
    expect(recentlyAddedRow.title).toBe("Recently Added");
    expect(recentlyAddedRow.items).toHaveLength(2);
    expect(recentlyAddedRow.items.map((i) => i.id)).toEqual([movieSeriesId, tvSeriesId]);
  });

  it("returns Korean Drama row at index 1 with up to 10 latest Korean Drama series", async () => {
    const now = new Date();
    const olderDate = new Date(now.getTime() - 100000);

    const koreanDramaGenreId = crypto.randomUUID();
    await db.insert(genres).values({
      id: koreanDramaGenreId,
      name: "Korean Drama",
      slug: "korean-drama",
      createdAt: now,
      updatedAt: now,
    });

    const otherGenreId = crypto.randomUUID();
    await db.insert(genres).values({
      id: otherGenreId,
      name: "Action",
      slug: "action",
      createdAt: now,
      updatedAt: now,
    });

    // Korean Drama series with video sources - should appear in Korean Drama row
    const kdSeriesId = crypto.randomUUID();
    await db.insert(series).values({
      id: kdSeriesId,
      title: "Squid Game",
      description: "Korean survival drama",
      type: "tv",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(seriesToGenres).values({
      seriesId: kdSeriesId,
      genreId: koreanDramaGenreId,
    });

    const kdSeasonId = crypto.randomUUID();
    await db.insert(seasons).values({
      id: kdSeasonId,
      seriesId: kdSeriesId,
      title: "Season 1",
      seasonNumber: 1,
      status: "ongoing",
      createdAt: now,
      updatedAt: now,
    });

    const kdEpId = crypto.randomUUID();
    await db.insert(episodes).values({
      id: kdEpId,
      title: "Episode 1",
      order: 1,
      seasonId: kdSeasonId,
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(videoSources).values({
      id: crypto.randomUUID(),
      episodeId: kdEpId,
      type: "hls",
      url: "https://example.com/squidgame.m3u8",
      label: "1080p",
      createdAt: now,
      updatedAt: now,
    });

    // Generic series with video sources but NOT Korean Drama - should NOT appear in Korean Drama row
    const genericSeriesId = crypto.randomUUID();
    await db.insert(series).values({
      id: genericSeriesId,
      title: "Generic Show",
      description: "Not Korean Drama",
      type: "tv",
      createdAt: olderDate,
      updatedAt: olderDate,
    });

    await db.insert(seriesToGenres).values({
      seriesId: genericSeriesId,
      genreId: otherGenreId,
    });

    const genericSeasonId = crypto.randomUUID();
    await db.insert(seasons).values({
      id: genericSeasonId,
      seriesId: genericSeriesId,
      title: "Season 1",
      seasonNumber: 1,
      status: "completed",
      createdAt: olderDate,
      updatedAt: olderDate,
    });

    const genericEpId = crypto.randomUUID();
    await db.insert(episodes).values({
      id: genericEpId,
      title: "Episode 1",
      order: 1,
      seasonId: genericSeasonId,
      createdAt: olderDate,
      updatedAt: olderDate,
    });

    await db.insert(videoSources).values({
      id: crypto.randomUUID(),
      episodeId: genericEpId,
      type: "hls",
      url: "https://example.com/generic.m3u8",
      label: "720p",
      createdAt: olderDate,
      updatedAt: olderDate,
    });

    // Korean Drama series WITHOUT video sources - should be excluded from Korean Drama row
    const kdNoSourceId = crypto.randomUUID();
    await db.insert(series).values({
      id: kdNoSourceId,
      title: "No Source Drama",
      type: "tv",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(seriesToGenres).values({
      seriesId: kdNoSourceId,
      genreId: koreanDramaGenreId,
    });

    const noSourceSeasonId = crypto.randomUUID();
    await db.insert(seasons).values({
      id: noSourceSeasonId,
      seriesId: kdNoSourceId,
      title: "Season 1",
      seasonNumber: 1,
      status: "completed",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(episodes).values({
      id: crypto.randomUUID(),
      title: "Episode 1",
      order: 1,
      seasonId: noSourceSeasonId,
      createdAt: now,
      updatedAt: now,
    });
    // No videoSources for this series

    const response = await request(app, { path: "/series/home-feed" });

    expect(response.status).toBe(200);
    const body = response.body as {
      data: {
        rows: Array<{
          title: string;
          items: Array<{ id: string; title: string }>;
        }>;
      };
    };

    expect(body.data.rows).toHaveLength(3);
    expect(body.data.rows[0].title).toBe("Ongoing");
    expect(body.data.rows[1].title).toBe("Korean Drama");
    expect(body.data.rows[2].title).toBe("Recently Added");

    const kdRow = body.data.rows[1];
    expect(kdRow.items).toHaveLength(1);
    expect(kdRow.items[0].id).toBe(kdSeriesId);
    expect(kdRow.items[0].title).toBe("Squid Game");

    // Generic series should not be in Korean Drama row
    expect(kdRow.items.map((i) => i.id)).not.toContain(genericSeriesId);
    // No-source drama should not be in Korean Drama row
    expect(kdRow.items.map((i) => i.id)).not.toContain(kdNoSourceId);

    // Korean Drama series with ongoing season should also appear in Ongoing row (duplicates allowed)
    const ongoingRow2 = body.data.rows[0];
    expect(ongoingRow2.items.map((i) => i.id)).toContain(kdSeriesId);
  });
});
