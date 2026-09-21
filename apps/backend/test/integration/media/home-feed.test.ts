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
    expect(body.data.rows).toEqual([]);
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
    expect(body.data.rows).toEqual([]);
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
    expect(body.data.rows[0].title).toBe("Ongoing Korean Drama");
    expect(body.data.rows[1].title).toBe("Korean Drama");
    expect(body.data.rows[2].title).toBe("Anime");
    expect(body.data.rows[3].title).toBe("Recently Added");

    expect(body.data.rows[0].items).toHaveLength(1);
    expect(body.data.rows[0].items[0].id).toBe(kdSeriesId);

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

  it("partitions ongoing rows per big genre ordered by display order with latest-update ordering", async () => {
    const baseTime = Date.now();
    const now = new Date(baseTime);

    const animId = crypto.randomUUID();
    await db.insert(genres).values({
      id: animId,
      name: "Animation",
      slug: "animation",
      isBigGenre: true,
      displayOrder: 2,
      createdAt: now,
      updatedAt: now,
    });

    const kdId = crypto.randomUUID();
    await db.insert(genres).values({
      id: kdId,
      name: "Korean Drama",
      slug: "korean-drama",
      isBigGenre: true,
      displayOrder: 1,
      createdAt: now,
      updatedAt: now,
    });

    async function seedOngoingSeries(
      title: string,
      genreId: string,
      updatedAt: Date,
      withSources: boolean,
      status: "ongoing" | "completed" = "ongoing"
    ): Promise<string> {
      const sId = crypto.randomUUID();
      await db.insert(series).values({
        id: sId,
        title,
        type: "tv",
        createdAt: now,
        updatedAt,
      });
      await db.insert(seriesToGenres).values({ seriesId: sId, genreId });
      const seasonId = crypto.randomUUID();
      await db.insert(seasons).values({
        id: seasonId,
        seriesId: sId,
        title: "Season 1",
        seasonNumber: 1,
        status,
        createdAt: now,
        updatedAt: now,
      });
      const epId = crypto.randomUUID();
      await db.insert(episodes).values({
        id: epId,
        title: "Episode 1",
        order: 1,
        seasonId,
        createdAt: now,
        updatedAt: now,
      });
      if (withSources) {
        await db.insert(videoSources).values({
          id: crypto.randomUUID(),
          episodeId: epId,
          type: "hls",
          url: `https://example.com/${sId}.m3u8`,
          label: "1080p",
          createdAt: now,
          updatedAt: now,
        });
      }
      return sId;
    }

    // KD: newer updates should come first; one completed (excluded), one without sources (excluded)
    const kdNew = await seedOngoingSeries("KD New", kdId, new Date(baseTime + 3000), true);
    const kdOld = await seedOngoingSeries("KD Old", kdId, new Date(baseTime + 1000), true);
    await seedOngoingSeries("KD No Sources", kdId, new Date(baseTime + 5000), false);
    await seedOngoingSeries("KD Completed", kdId, new Date(baseTime + 4000), true, "completed");
    const animId1 = await seedOngoingSeries("Anim 1", animId, new Date(baseTime + 2000), true);

    const response = await request(app, { path: "/series/home-feed" });
    expect(response.status).toBe(200);
    const body = response.body as {
      data: {
        rows: Array<{ title: string; items: Array<{ id: string; title: string }> }>;
      };
    };

    const titles = body.data.rows.map((r) => r.title);
    // Ongoing rows first in display order: KD (1) before Animation (2)
    expect(titles[0]).toBe("Ongoing Korean Drama");
    expect(titles[1]).toBe("Ongoing Animation");
    // Catalog + recently added follow ongoing rows
    expect(titles.indexOf("Korean Drama")).toBeGreaterThan(1);
    expect(titles.indexOf("Animation")).toBeGreaterThan(1);
    expect(titles[titles.length - 1]).toBe("Recently Added");

    const kdRow = body.data.rows.find((r) => r.title === "Ongoing Korean Drama")!;
    expect(kdRow.items.map((i) => i.id)).toEqual([kdNew, kdOld]);

    const animRow = body.data.rows.find((r) => r.title === "Ongoing Animation")!;
    expect(animRow.items.map((i) => i.id)).toEqual([animId1]);

    // No generic Ongoing fallback when per-genre ongoing exists
    expect(titles).not.toContain("Ongoing");
  });

  it("omits empty ongoing rows and falls back to generic Ongoing when no big genre has ongoing titles", async () => {
    const now = new Date();
    const emptyBigId = crypto.randomUUID();
    await db.insert(genres).values({
      id: emptyBigId,
      name: "Animation",
      slug: "animation",
      isBigGenre: true,
      displayOrder: 1,
      createdAt: now,
      updatedAt: now,
    });

    // Series with ongoing season but NO genre link and with sources -> only visible via fallback
    const sId = crypto.randomUUID();
    await db.insert(series).values({
      id: sId,
      title: "Lone Ongoing",
      type: "tv",
      createdAt: now,
      updatedAt: now,
    });
    const seasonId = crypto.randomUUID();
    await db.insert(seasons).values({
      id: seasonId,
      seriesId: sId,
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
      seasonId,
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(videoSources).values({
      id: crypto.randomUUID(),
      episodeId: epId,
      type: "hls",
      url: "https://example.com/lone.m3u8",
      label: "1080p",
      createdAt: now,
      updatedAt: now,
    });

    const response = await request(app, { path: "/series/home-feed" });
    expect(response.status).toBe(200);
    const body = response.body as {
      data: {
        rows: Array<{ title: string; items: Array<{ id: string }> }>;
      };
    };
    const titles = body.data.rows.map((r) => r.title);
    expect(titles).toContain("Ongoing");
    expect(titles).not.toContain("Ongoing Animation");
    const ongoing = body.data.rows.find((r) => r.title === "Ongoing")!;
    expect(ongoing.items.map((i) => i.id)).toContain(sId);
  });

  it("orders highlighted ongoing series before non-highlighted backfill in Big Genre rows", async () => {
    const baseTime = Date.now();
    const now = new Date(baseTime);
    const bigId = crypto.randomUUID();
    await db.insert(genres).values({
      id: bigId,
      name: "Anime",
      slug: "anime",
      isBigGenre: true,
      displayOrder: 1,
      createdAt: now,
      updatedAt: now,
    });

    async function seedOngoing(
      title: string,
      updatedAt: Date,
      highlighted: boolean,
      status: "ongoing" | "completed" = "ongoing",
      withSources = true,
    ): Promise<string> {
      const sId = crypto.randomUUID();
      await db.insert(series).values({
        id: sId,
        title,
        type: "tv",
        isOngoingHighlighted: highlighted,
        createdAt: now,
        updatedAt,
      });
      await db.insert(seriesToGenres).values({ seriesId: sId, genreId: bigId });
      const seasonId = crypto.randomUUID();
      await db.insert(seasons).values({
        id: seasonId,
        seriesId: sId,
        title: "Season 1",
        seasonNumber: 1,
        status,
        createdAt: now,
        updatedAt: now,
      });
      const epId = crypto.randomUUID();
      await db.insert(episodes).values({
        id: epId,
        title: "Episode 1",
        order: 1,
        seasonId,
        createdAt: now,
        updatedAt: now,
      });
      if (withSources) {
        await db.insert(videoSources).values({
          id: crypto.randomUUID(),
          episodeId: epId,
          type: "hls",
          url: `https://example.com/${sId}.m3u8`,
          label: "1080p",
          createdAt: now,
          updatedAt: now,
        });
      }
      return sId;
    }

    // Non-highlighted has the newest updatedAt, but highlighted must still come first
    const plainNewest = await seedOngoing("Plain Newest", new Date(baseTime + 5000), false);
    const highlightedOld = await seedOngoing("Highlighted Old", new Date(baseTime + 1000), true);
    const highlightedNew = await seedOngoing("Highlighted New", new Date(baseTime + 2000), true);
    // Highlighted but completed-only -> safety gate must exclude it
    await seedOngoing("Highlighted Completed", new Date(baseTime + 9000), true, "completed");
    // Highlighted but sourceless -> safety gate must exclude it
    await seedOngoing("Highlighted No Sources", new Date(baseTime + 8000), true, "ongoing", false);

    const response = await request(app, { path: "/series/home-feed" });
    expect(response.status).toBe(200);
    const body = response.body as {
      data: {
        rows: Array<{ title: string; items: Array<{ id: string; title: string }> }>;
      };
    };
    const row = body.data.rows.find((r) => r.title === "Ongoing Anime")!;
    expect(row).toBeDefined();
    const ids = row.items.map((i) => i.id);
    // Highlighted first (newest highlighted before older highlighted), then backfill
    expect(ids).toEqual([highlightedNew, highlightedOld, plainNewest]);
  });

  it("applies soft-cap expansion and backfill: 0, 3, 10, and 12 highlighted series", async () => {
    const baseTime = Date.now();
    const now = new Date(baseTime);

    async function seedCase(suffix: string, highlightedCount: number, plainCount: number) {
      const bigId = crypto.randomUUID();
      await db.insert(genres).values({
        id: bigId,
        name: `Big ${suffix}`,
        slug: `big-${suffix}`,
        isBigGenre: true,
        displayOrder: 1,
        createdAt: now,
        updatedAt: now,
      });
      const highlightedIds: string[] = [];
      for (let i = 0; i < highlightedCount; i++) {
        const sId = crypto.randomUUID();
        highlightedIds.push(sId);
        await db.insert(series).values({
          id: sId,
          title: `H ${suffix} ${i}`,
          type: "tv",
          isOngoingHighlighted: true,
          createdAt: now,
          updatedAt: new Date(baseTime + i * 1000),
        });
        await db.insert(seriesToGenres).values({ seriesId: sId, genreId: bigId });
        const seasonId = crypto.randomUUID();
        await db.insert(seasons).values({
          id: seasonId,
          seriesId: sId,
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
          seasonId,
          createdAt: now,
          updatedAt: now,
        });
        await db.insert(videoSources).values({
          id: crypto.randomUUID(),
          episodeId: epId,
          type: "hls",
          url: `https://example.com/${sId}.m3u8`,
          label: "1080p",
          createdAt: now,
          updatedAt: now,
        });
      }
      for (let i = 0; i < plainCount; i++) {
        const sId = crypto.randomUUID();
        await db.insert(series).values({
          id: sId,
          title: `P ${suffix} ${i}`,
          type: "tv",
          isOngoingHighlighted: false,
          createdAt: now,
          updatedAt: new Date(baseTime + 50000 + i * 1000),
        });
        await db.insert(seriesToGenres).values({ seriesId: sId, genreId: bigId });
        const seasonId = crypto.randomUUID();
        await db.insert(seasons).values({
          id: seasonId,
          seriesId: sId,
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
          seasonId,
          createdAt: now,
          updatedAt: now,
        });
        await db.insert(videoSources).values({
          id: crypto.randomUUID(),
          episodeId: epId,
          type: "hls",
          url: `https://example.com/${sId}.m3u8`,
          label: "1080p",
          createdAt: now,
          updatedAt: now,
        });
      }
      return { bigId, highlightedIds };
    }

    async function fetchOngoingRow(slug: string) {
      const response = await request(app, { path: "/series/home-feed" });
      expect(response.status).toBe(200);
      const body = response.body as {
        data: {
          rows: Array<{ title: string; items: Array<{ id: string }> }>;
        };
      };
      const row = body.data.rows.find((r) =>
        r.title.toLowerCase().includes(`ongoing big ${slug}`),
      );
      return row!;
    }

    // Case 0 highlighted + 2 plain -> backfill to 2 (never sparse-driven beyond availability)
    await seedCase("zero", 0, 2);
    let row = await fetchOngoingRow("zero");
    expect(row.items).toHaveLength(2);

    // Case 3 highlighted + 10 plain -> 3 highlighted + 7 backfill = 10
    await seedCase("three", 3, 10);
    row = await fetchOngoingRow("three");
    expect(row.items).toHaveLength(10);

    // Case 10 highlighted + 5 plain -> exactly 10 highlighted, no backfill needed
    await seedCase("ten", 10, 5);
    row = await fetchOngoingRow("ten");
    expect(row.items).toHaveLength(10);

    // Case 12 highlighted + 10 plain -> all 12 highlighted surface (expansion past 10, ceiling 20)
    const twelve = await seedCase("twelve", 12, 10);
    row = await fetchOngoingRow("twelve");
    expect(row.items).toHaveLength(12);
    // Highlighted items come first; plain backfill would only appear past position 12 (none here)
    for (const hId of twelve.highlightedIds) {
      expect(row.items.map((i) => i.id)).toContain(hId);
    }
  });

  it("orders highlighted series first in the fallback Ongoing row with the same safety gate", async () => {
    const baseTime = Date.now();
    const now = new Date(baseTime);

    async function seedFallback(title: string, updatedAt: Date, highlighted: boolean) {
      const sId = crypto.randomUUID();
      await db.insert(series).values({
        id: sId,
        title,
        type: "tv",
        isOngoingHighlighted: highlighted,
        createdAt: now,
        updatedAt,
      });
      const seasonId = crypto.randomUUID();
      await db.insert(seasons).values({
        id: seasonId,
        seriesId: sId,
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
        seasonId,
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(videoSources).values({
        id: crypto.randomUUID(),
        episodeId: epId,
        type: "hls",
        url: `https://example.com/${sId}.m3u8`,
        label: "1080p",
        createdAt: now,
        updatedAt: now,
      });
      return sId;
    }

    const plain = await seedFallback("Fallback Plain", new Date(baseTime + 5000), false);
    const highlighted = await seedFallback("Fallback Highlighted", new Date(baseTime + 1000), true);

    const response = await request(app, { path: "/series/home-feed" });
    expect(response.status).toBe(200);
    const body = response.body as {
      data: {
        rows: Array<{ title: string; items: Array<{ id: string }> }>;
      };
    };
    const row = body.data.rows.find((r) => r.title === "Ongoing")!;
    expect(row).toBeDefined();
    expect(row.items.map((i) => i.id)).toEqual([highlighted, plain]);
  });

  it("omits rows with zero items in category-scoped feeds", async () => {
    const now = new Date();
    const genreId = crypto.randomUUID();
    await db.insert(genres).values({
      id: genreId,
      name: "Drama",
      slug: "drama",
      createdAt: now,
      updatedAt: now,
    });
    // Completed-only series with sources: ongoing row should be omitted
    const sId = crypto.randomUUID();
    await db.insert(series).values({
      id: sId,
      title: "Completed Drama",
      type: "tv",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(seriesToGenres).values({ seriesId: sId, genreId });
    const seasonId = crypto.randomUUID();
    await db.insert(seasons).values({
      id: seasonId,
      seriesId: sId,
      title: "Season 1",
      seasonNumber: 1,
      status: "completed",
      createdAt: now,
      updatedAt: now,
    });
    const epId = crypto.randomUUID();
    await db.insert(episodes).values({
      id: epId,
      title: "Episode 1",
      order: 1,
      seasonId,
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(videoSources).values({
      id: crypto.randomUUID(),
      episodeId: epId,
      type: "hls",
      url: "https://example.com/completed.m3u8",
      label: "1080p",
      createdAt: now,
      updatedAt: now,
    });

    const response = await request(app, { path: "/series/home-feed?genre=drama" });
    expect(response.status).toBe(200);
    const body = response.body as {
      data: {
        rows: Array<{ title: string; items: Array<{ id: string }> }>;
      };
    };
    const titles = body.data.rows.map((r) => r.title);
    expect(titles).not.toContain("Ongoing");
    for (const row of body.data.rows) {
      expect(row.items.length).toBeGreaterThan(0);
    }
  });
});

describe("GET /series/home-feed recentlyAddedEpisodes", () => {
  let app: App;

  beforeAll(async () => {
    app = await buildApp();
  });

  type RecentlyAddedEpisodeBody = {
    id: string;
    title: string;
    order: number;
    thumbnailUrl: string | null;
    duration: number | null;
    rating: string | null;
    createdAt: string;
    series: {
      id: string;
      title: string;
      posterUrl: string | null;
      backdropUrl: string | null;
    };
    season: {
      id: string;
      seasonNumber: number | null;
      title: string;
    };
    videoSources: Array<{ id: string; episodeId: string; type: string; url: string }>;
  };

  type FeedBody = {
    data: {
      rows: Array<{ title: string; items: Array<{ id: string }> }>;
      recentlyAddedEpisodes: RecentlyAddedEpisodeBody[];
    };
  };

  async function seedEpisodeWithSource(opts: {
    seriesTitle: string;
    seasonNumber?: number;
    episodeTitle: string;
    episodeOrder?: number;
    sourceCreatedAt: Date;
  }): Promise<{ seriesId: string; seasonId: string; episodeId: string }> {
    const now = new Date();
    const seriesId = crypto.randomUUID();
    await db.insert(series).values({
      id: seriesId,
      title: opts.seriesTitle,
      type: "tv",
      createdAt: now,
      updatedAt: now,
    });
    const seasonId = crypto.randomUUID();
    await db.insert(seasons).values({
      id: seasonId,
      seriesId,
      title: `Season ${opts.seasonNumber ?? 1}`,
      seasonNumber: opts.seasonNumber ?? 1,
      status: "completed",
      createdAt: now,
      updatedAt: now,
    });
    const episodeId = crypto.randomUUID();
    await db.insert(episodes).values({
      id: episodeId,
      title: opts.episodeTitle,
      order: opts.episodeOrder ?? 1,
      seasonId,
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(videoSources).values({
      id: crypto.randomUUID(),
      episodeId,
      type: "hls",
      url: `https://example.com/${episodeId}.m3u8`,
      label: "1080p",
      createdAt: opts.sourceCreatedAt,
      updatedAt: opts.sourceCreatedAt,
    });
    return { seriesId, seasonId, episodeId };
  }

  it("populates recentlyAddedEpisodes with episode, series, season, and video source metadata", async () => {
    const seeded = await seedEpisodeWithSource({
      seriesTitle: "Meta Show",
      episodeTitle: "Fresh Episode",
      sourceCreatedAt: new Date(),
    });

    const response = await request(app, { path: "/series/home-feed" });
    expect(response.status).toBe(200);
    const body = response.body as FeedBody;

    expect(body.data.recentlyAddedEpisodes).toHaveLength(1);
    const ep = body.data.recentlyAddedEpisodes[0];
    expect(ep.id).toBe(seeded.episodeId);
    expect(ep.title).toBe("Fresh Episode");
    expect(ep.series.id).toBe(seeded.seriesId);
    expect(ep.series.title).toBe("Meta Show");
    expect(ep.season.id).toBe(seeded.seasonId);
    expect(ep.season.seasonNumber).toBe(1);
    expect(ep.videoSources.length).toBeGreaterThanOrEqual(1);
    expect(ep.videoSources[0].episodeId).toBe(seeded.episodeId);
  });

  it("strictly excludes episodes without video sources", async () => {
    const now = new Date();
    const emptySeriesId = crypto.randomUUID();
    await db.insert(series).values({
      id: emptySeriesId,
      title: "Sourceless Show",
      type: "tv",
      createdAt: now,
      updatedAt: now,
    });
    const emptySeasonId = crypto.randomUUID();
    await db.insert(seasons).values({
      id: emptySeasonId,
      seriesId: emptySeriesId,
      title: "Season 1",
      seasonNumber: 1,
      status: "completed",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(episodes).values({
      id: crypto.randomUUID(),
      title: "Lonely Episode",
      order: 1,
      seasonId: emptySeasonId,
      createdAt: now,
      updatedAt: now,
    });

    await seedEpisodeWithSource({
      seriesTitle: "Sourced Show",
      episodeTitle: "Playable Episode",
      sourceCreatedAt: now,
    });

    const response = await request(app, { path: "/series/home-feed" });
    expect(response.status).toBe(200);
    const body = response.body as FeedBody;

    expect(body.data.recentlyAddedEpisodes).toHaveLength(1);
    expect(body.data.recentlyAddedEpisodes[0].series.id).not.toBe(emptySeriesId);
    expect(body.data.recentlyAddedEpisodes[0].title).toBe("Playable Episode");
  });

  it("orders episodes by newest video source creation timestamp descending", async () => {
    const base = Date.now();
    const oldest = await seedEpisodeWithSource({
      seriesTitle: "Old Show",
      episodeTitle: "Old Episode",
      sourceCreatedAt: new Date(base - 30000),
    });
    const middle = await seedEpisodeWithSource({
      seriesTitle: "Mid Show",
      episodeTitle: "Mid Episode",
      sourceCreatedAt: new Date(base - 20000),
    });
    const newest = await seedEpisodeWithSource({
      seriesTitle: "New Show",
      episodeTitle: "New Episode",
      sourceCreatedAt: new Date(base - 10000),
    });

    const response = await request(app, { path: "/series/home-feed" });
    expect(response.status).toBe(200);
    const body = response.body as FeedBody;

    expect(body.data.recentlyAddedEpisodes.map((e) => e.id)).toEqual([
      newest.episodeId,
      middle.episodeId,
      oldest.episodeId,
    ]);
  });

  it("returns at most 1 episode per series (newest release for that show)", async () => {
    const base = Date.now();
    const now = new Date(base);
    const seriesId = crypto.randomUUID();
    await db.insert(series).values({
      id: seriesId,
      title: "Bulk Show",
      type: "tv",
      createdAt: now,
      updatedAt: now,
    });
    const seasonId = crypto.randomUUID();
    await db.insert(seasons).values({
      id: seasonId,
      seriesId,
      title: "Season 1",
      seasonNumber: 1,
      status: "completed",
      createdAt: now,
      updatedAt: now,
    });

    const oldEpId = crypto.randomUUID();
    await db.insert(episodes).values({
      id: oldEpId,
      title: "Episode 1",
      order: 1,
      seasonId,
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(videoSources).values({
      id: crypto.randomUUID(),
      episodeId: oldEpId,
      type: "hls",
      url: `https://example.com/${oldEpId}.m3u8`,
      label: "1080p",
      createdAt: new Date(base - 20000),
      updatedAt: new Date(base - 20000),
    });

    const newEpId = crypto.randomUUID();
    await db.insert(episodes).values({
      id: newEpId,
      title: "Episode 2",
      order: 2,
      seasonId,
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(videoSources).values({
      id: crypto.randomUUID(),
      episodeId: newEpId,
      type: "hls",
      url: `https://example.com/${newEpId}.m3u8`,
      label: "1080p",
      createdAt: new Date(base - 5000),
      updatedAt: new Date(base - 5000),
    });

    await seedEpisodeWithSource({
      seriesTitle: "Other Show",
      episodeTitle: "Other Episode",
      sourceCreatedAt: new Date(base - 10000),
    });

    const response = await request(app, { path: "/series/home-feed" });
    expect(response.status).toBe(200);
    const body = response.body as FeedBody;

    const bulkEntries = body.data.recentlyAddedEpisodes.filter(
      (e) => e.series.id === seriesId
    );
    expect(bulkEntries).toHaveLength(1);
    expect(bulkEntries[0].id).toBe(newEpId);
  });

  it("keeps the legacy Recently Added series row for Android TV backward compatibility", async () => {
    await seedEpisodeWithSource({
      seriesTitle: "Legacy Show",
      episodeTitle: "Legacy Episode",
      sourceCreatedAt: new Date(),
    });

    const response = await request(app, { path: "/series/home-feed" });
    expect(response.status).toBe(200);
    const body = response.body as FeedBody;

    const legacyRow = body.data.rows.find((r) => r.title === "Recently Added");
    expect(legacyRow).toBeDefined();
    expect(legacyRow!.items.length).toBeGreaterThan(0);
    expect(body.data.recentlyAddedEpisodes.length).toBeGreaterThan(0);
  });

  it("ignores genre and sourceTypes query parameters for recentlyAddedEpisodes", async () => {
    const now = new Date();
    const genreId = crypto.randomUUID();
    await db.insert(genres).values({
      id: genreId,
      name: "Action",
      slug: "action",
      createdAt: now,
      updatedAt: now,
    });

    const tagged = await seedEpisodeWithSource({
      seriesTitle: "Tagged Show",
      episodeTitle: "Tagged Episode",
      sourceCreatedAt: new Date(now.getTime() - 1000),
    });
    await db.insert(seriesToGenres).values({ seriesId: tagged.seriesId, genreId });

    const untagged = await seedEpisodeWithSource({
      seriesTitle: "Untagged Show",
      episodeTitle: "Untagged Episode",
      sourceCreatedAt: new Date(now.getTime()),
    });

    const plain = await request(app, { path: "/series/home-feed" });
    const genreScoped = await request(app, { path: "/series/home-feed?genre=action" });
    const sourceFiltered = await request(app, {
      path: "/series/home-feed?sourceTypes=embed",
    });

    expect(plain.status).toBe(200);
    expect(genreScoped.status).toBe(200);
    expect(sourceFiltered.status).toBe(200);

    const plainIds = (plain.body as FeedBody).data.recentlyAddedEpisodes.map((e) => e.id);
    const genreIds = (genreScoped.body as FeedBody).data.recentlyAddedEpisodes.map((e) => e.id);
    const sourceIds = (sourceFiltered.body as FeedBody).data.recentlyAddedEpisodes.map((e) => e.id);

    expect(plainIds).toContain(tagged.episodeId);
    expect(plainIds).toContain(untagged.episodeId);
    expect(genreIds).toEqual(plainIds);
    expect(sourceIds).toEqual(plainIds);
  });
});
