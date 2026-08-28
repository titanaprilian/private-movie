import { describe, expect, it, beforeAll } from "vitest";
import { genres, series, seasons, episodes, seriesToGenres } from "@repo/db";
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
    expect(body.data.rows).toHaveLength(4);
    expect(body.data.rows[0].title).toBe("Trending Now");
    expect(body.data.rows[0].items).toEqual([]);
    expect(body.data.rows[1].title).toBe("Recently Added");
    expect(body.data.rows[1].items).toEqual([]);
    expect(body.data.rows[2].title).toBe("Simulcasts");
    expect(body.data.rows[2].items).toEqual([]);
    expect(body.data.rows[3].title).toBe("Movies");
    expect(body.data.rows[3].items).toEqual([]);
  });

  it("returns populated hero and rows with genre tags and counts", async () => {
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

    const tvSeriesId = crypto.randomUUID();
    await db.insert(series).values({
      id: tvSeriesId,
      title: "Demon Slayer",
      description: "Demon hunting anime",
      type: "tv",
      posterUrl: "https://example.com/demon.jpg",
      createdAt: olderDate,
      updatedAt: newerDate,
    });

    const movieSeriesId = crypto.randomUUID();
    await db.insert(series).values({
      id: movieSeriesId,
      title: "Your Name",
      description: "Anime film",
      type: "movie",
      posterUrl: "https://example.com/yourname.jpg",
      createdAt: now,
      updatedAt: olderDate,
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
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(episodes).values({
      id: crypto.randomUUID(),
      title: "Episode 1",
      order: 1,
      seasonId: season1Id,
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
    expect(body.data.hero.seasonsCount).toBe(1);
    expect(body.data.hero.episodesCount).toBe(1);

    const simulcastRow = body.data.rows.find((r) => r.title === "Simulcasts");
    expect(simulcastRow).toBeDefined();
    expect(simulcastRow?.items).toHaveLength(1);
    expect(simulcastRow?.items[0].id).toBe(tvSeriesId);

    const movieRow = body.data.rows.find((r) => r.title === "Movies");
    expect(movieRow).toBeDefined();
    expect(movieRow?.items).toHaveLength(1);
    expect(movieRow?.items[0].id).toBe(movieSeriesId);
  });
});
