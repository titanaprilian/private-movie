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
        heroes: unknown[];
        rows: Array<{ title: string; items: unknown[] }>;
      };
    };

    expect(body.data.hero).toBeNull();
    expect(body.data.heroes).toEqual([]);
    expect(body.data.rows).toHaveLength(2);
    expect(body.data.rows[0].title).toBe("Ongoing");
    expect(body.data.rows[0].items).toEqual([]);
    expect(body.data.rows[1].title).toBe("Recently Added");
    expect(body.data.rows[1].items).toEqual([]);
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
        heroes: unknown[];
        rows: Array<{ title: string; items: unknown[] }>;
      };
    };

    expect(body.data.hero).toBeNull();
    expect(body.data.heroes).toEqual([]);
    expect(body.data.rows).toHaveLength(2);
    expect(body.data.rows[0].title).toBe("Ongoing");
    expect(body.data.rows[0].items).toHaveLength(0);
    expect(body.data.rows[1].title).toBe("Recently Added");
    expect(body.data.rows[1].items).toHaveLength(0);
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
        heroes: Array<{
          id: string;
          title: string;
          type: string;
          tags: string[];
        }>;
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
    expect(body.data.heroes).toHaveLength(1);
    expect(body.data.heroes[0].id).toBe(tvSeriesId);
    expect(body.data.hero.id).toBe(tvSeriesId);
    expect(body.data.hero.title).toBe("Demon Slayer");
    expect(body.data.hero.tags).toContain("TV Series");
    expect(body.data.hero.tags).toContain("Action");
    expect(body.data.hero.genres).toHaveLength(1);
    expect(body.data.hero.genres[0].name).toBe("Action");
    expect(body.data.hero.seasonsCount).toBe(2);
    expect(body.data.hero.episodesCount).toBe(1);

    expect(body.data.rows).toHaveLength(2);

    const ongoingRow = body.data.rows[0];
    expect(ongoingRow.title).toBe("Ongoing");
    expect(ongoingRow.items).toHaveLength(1);
    expect(ongoingRow.items[0].id).toBe(tvSeriesId);

    const recentlyAddedRow = body.data.rows[1];
    expect(recentlyAddedRow.title).toBe("Recently Added");
    expect(recentlyAddedRow.items).toHaveLength(2);
    expect(recentlyAddedRow.items.map((i) => i.id)).toEqual([movieSeriesId, tvSeriesId]);
  });

  it("dynamically queries active Big Genres sorted by displayOrder asc and generates carousel rows", async () => {
    const now = new Date();

    const bigGenre1Id = crypto.randomUUID();
    await db.insert(genres).values({
      id: bigGenre1Id,
      name: "Korean Drama",
      slug: "korean-drama",
      isBigGenre: true,
      displayOrder: 1,
      createdAt: now,
      updatedAt: now,
    });

    const bigGenre2Id = crypto.randomUUID();
    await db.insert(genres).values({
      id: bigGenre2Id,
      name: "Anime",
      slug: "anime",
      isBigGenre: true,
      displayOrder: 2,
      createdAt: now,
      updatedAt: now,
    });

    const regularGenreId = crypto.randomUUID();
    await db.insert(genres).values({
      id: regularGenreId,
      name: "Action",
      slug: "action",
      isBigGenre: false,
      displayOrder: 0,
      createdAt: now,
      updatedAt: now,
    });

    const kdSeriesId = crypto.randomUUID();
    await db.insert(series).values({
      id: kdSeriesId,
      title: "Squid Game",
      type: "tv",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(seriesToGenres).values({
      seriesId: kdSeriesId,
      genreId: bigGenre1Id,
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

    const animeSeriesId = crypto.randomUUID();
    await db.insert(series).values({
      id: animeSeriesId,
      title: "Attack on Titan",
      type: "tv",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(seriesToGenres).values({
      seriesId: animeSeriesId,
      genreId: bigGenre2Id,
    });

    const animeSeasonId = crypto.randomUUID();
    await db.insert(seasons).values({
      id: animeSeasonId,
      seriesId: animeSeriesId,
      title: "Season 1",
      seasonNumber: 1,
      status: "completed",
      createdAt: now,
      updatedAt: now,
    });

    const animeEpId = crypto.randomUUID();
    await db.insert(episodes).values({
      id: animeEpId,
      title: "Episode 1",
      order: 1,
      seasonId: animeSeasonId,
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(videoSources).values({
      id: crypto.randomUUID(),
      episodeId: animeEpId,
      type: "hls",
      url: "https://example.com/aot.m3u8",
      label: "1080p",
      createdAt: now,
      updatedAt: now,
    });

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

    expect(body.data.rows).toHaveLength(4);
    expect(body.data.rows[0].title).toBe("Ongoing");
    expect(body.data.rows[1].title).toBe("Korean Drama");
    expect(body.data.rows[2].title).toBe("Anime");
    expect(body.data.rows[3].title).toBe("Recently Added");

    expect(body.data.rows[1].items).toHaveLength(1);
    expect(body.data.rows[1].items[0].id).toBe(kdSeriesId);

    expect(body.data.rows[2].items).toHaveLength(1);
    expect(body.data.rows[2].items[0].id).toBe(animeSeriesId);
  });

  it("returns category-scoped home feed when ?genre=<slug> is supplied", async () => {
    const now = new Date();

    const actionGenreId = crypto.randomUUID();
    await db.insert(genres).values({
      id: actionGenreId,
      name: "Action",
      slug: "action",
      createdAt: now,
      updatedAt: now,
    });

    const actionSeriesId = crypto.randomUUID();
    await db.insert(series).values({
      id: actionSeriesId,
      title: "John Wick",
      type: "movie",
      rating: "9.0",
      isFeatured: true,
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(seriesToGenres).values({
      seriesId: actionSeriesId,
      genreId: actionGenreId,
    });

    const seasonId = crypto.randomUUID();
    await db.insert(seasons).values({
      id: seasonId,
      seriesId: actionSeriesId,
      title: "Season 1",
      seasonNumber: 1,
      status: "ongoing",
      createdAt: now,
      updatedAt: now,
    });

    const epId = crypto.randomUUID();
    await db.insert(episodes).values({
      id: epId,
      title: "Episode 1",
      order: 1,
      seasonId: seasonId,
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(videoSources).values({
      id: crypto.randomUUID(),
      episodeId: epId,
      type: "hls",
      url: "https://example.com/johnwick.m3u8",
      label: "1080p",
      createdAt: now,
      updatedAt: now,
    });

    const response = await request(app, { path: "/series/home-feed?genre=action" });

    expect(response.status).toBe(200);
    const body = response.body as {
      data: {
        hero: { id: string; title: string } | null;
        heroes: Array<{ id: string; title: string }>;
        rows: Array<{
          title: string;
          items: Array<{ id: string; title: string }>;
        }>;
      };
    };

    expect(body.data.hero).not.toBeNull();
    expect(body.data.hero!.id).toBe(actionSeriesId);

    expect(body.data.rows).toHaveLength(3);
    expect(body.data.rows[0].title).toBe("Ongoing");
    expect(body.data.rows[1].title).toBe("Recently Added");
    expect(body.data.rows[2].title).toBe("Top Rated");

    expect(body.data.rows[0].items[0].id).toBe(actionSeriesId);
    expect(body.data.rows[1].items[0].id).toBe(actionSeriesId);
    expect(body.data.rows[2].items[0].id).toBe(actionSeriesId);
  });

  it("supports multiple featured series in heroes array (up to 10) ordered by updatedAt desc, createdAt desc, with hero set to heroes[0]", async () => {
    const baseTime = Date.now();

    // Insert 12 featured series with video sources
    const featuredSeriesIds: string[] = [];
    for (let i = 0; i < 12; i++) {
      const sId = crypto.randomUUID();
      featuredSeriesIds.push(sId);
      const updatedAt = new Date(baseTime + i * 1000);
      const createdAt = new Date(baseTime + i * 500);

      await db.insert(series).values({
        id: sId,
        title: `Featured Series ${i + 1}`,
        type: "tv",
        isFeatured: true,
        createdAt,
        updatedAt,
      });

      const sSeasonId = crypto.randomUUID();
      await db.insert(seasons).values({
        id: sSeasonId,
        seriesId: sId,
        title: "Season 1",
        seasonNumber: 1,
        status: "completed",
        createdAt,
        updatedAt,
      });

      const sEpId = crypto.randomUUID();
      await db.insert(episodes).values({
        id: sEpId,
        title: "Episode 1",
        order: 1,
        seasonId: sSeasonId,
        createdAt,
        updatedAt,
      });

      await db.insert(videoSources).values({
        id: crypto.randomUUID(),
        episodeId: sEpId,
        type: "hls",
        url: `https://example.com/featured-${i + 1}.m3u8`,
        label: "1080p",
        createdAt,
        updatedAt,
      });
    }

    const response = await request(app, { path: "/series/home-feed" });

    expect(response.status).toBe(200);
    const body = response.body as {
      data: {
        hero: { id: string; title: string } | null;
        heroes: Array<{ id: string; title: string }>;
      };
    };

    expect(body.data.heroes).toHaveLength(10);
    expect(body.data.hero).not.toBeNull();
    expect(body.data.hero!.id).toBe(body.data.heroes[0].id);

    // Expected order: latest updatedAt descending (which is index 11 down to 2)
    const expectedTop10 = featuredSeriesIds.slice().reverse().slice(0, 10);
    expect(body.data.heroes.map((h) => h.id)).toEqual(expectedTop10);
  });

  it("falls back to top recently updated series when no series are marked as featured", async () => {
    const baseTime = Date.now();

    const nonFeaturedIds: string[] = [];
    for (let i = 0; i < 3; i++) {
      const sId = crypto.randomUUID();
      nonFeaturedIds.push(sId);
      const updatedAt = new Date(baseTime + i * 1000);

      await db.insert(series).values({
        id: sId,
        title: `Non Featured Series ${i + 1}`,
        type: "tv",
        isFeatured: false,
        createdAt: new Date(baseTime),
        updatedAt,
      });

      const sSeasonId = crypto.randomUUID();
      await db.insert(seasons).values({
        id: sSeasonId,
        seriesId: sId,
        title: "Season 1",
        seasonNumber: 1,
        status: "completed",
        createdAt: new Date(baseTime),
        updatedAt,
      });

      const sEpId = crypto.randomUUID();
      await db.insert(episodes).values({
        id: sEpId,
        title: "Episode 1",
        order: 1,
        seasonId: sSeasonId,
        createdAt: new Date(baseTime),
        updatedAt,
      });

      await db.insert(videoSources).values({
        id: crypto.randomUUID(),
        episodeId: sEpId,
        type: "hls",
        url: `https://example.com/non-featured-${i + 1}.m3u8`,
        label: "720p",
        createdAt: new Date(baseTime),
        updatedAt,
      });
    }

    const response = await request(app, { path: "/series/home-feed" });

    expect(response.status).toBe(200);
    const body = response.body as {
      data: {
        hero: { id: string; title: string } | null;
        heroes: Array<{ id: string; title: string }>;
      };
    };

    expect(body.data.heroes.length).toBeGreaterThanOrEqual(3);
    expect(body.data.hero).not.toBeNull();
    expect(body.data.hero!.id).toBe(body.data.heroes[0].id);

    // Latest updated non-featured series should be first in heroes
    expect(body.data.heroes[0].id).toBe(nonFeaturedIds[2]);
  });
});
