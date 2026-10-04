import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import crypto from "node:crypto";
import { describe, expect, it, beforeAll, afterEach, vi } from "vitest";
import { episodes, genres, seasons, series, seriesToGenres } from "@repo/db";
import { buildApp, request, type App } from "../../utils/app";
import { registerUser, authHeaders } from "../../utils/auth";
import { db } from "../../utils/db";
import { eq } from "drizzle-orm";

const sampleOneSeasonHtml = readFileSync(
  resolve(import.meta.dirname, "../../fixtures/episodes/sample-one-season.html"),
  "utf8"
);
const sampleEpisodeHtml = readFileSync(
  resolve(import.meta.dirname, "../../fixtures/episodes/sample-a.html"),
  "utf8"
);

describe("POST /seasons/:id/scrape-ongoing preserves series genres", () => {
  let app: App;
  let headers: Record<string, string>;

  beforeAll(async () => {
    process.env.TMDB_API_KEY = "test-tmdb-key";
    app = await buildApp({
      fetchHtml: {
        get: async (url) => {
          if (url.includes("otakudesu.blog/episode")) return sampleEpisodeHtml;
          return sampleOneSeasonHtml;
        },
        post: async () => "",
      },
    });
    const user = await registerUser(app, {
      email: `scrape-ongoing-genres-${crypto.randomUUID()}@example.com`,
      password: "password123",
      name: "Scrape Ongoing Genres Tester",
    });
    headers = authHeaders(user.accessToken);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not wipe or alter pre-existing series genres during auto-scrape", async () => {
    const seriesId = crypto.randomUUID();
    await db.insert(series).values({
      id: seriesId,
      title: `Genre Preserve Series ${crypto.randomUUID()}`,
      type: "tv",
      tmdbId: 424200 + Math.floor(Math.random() * 100000),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const customGenreId = crypto.randomUUID();
    await db.insert(genres).values({
      id: customGenreId,
      name: `CustomGenre ${crypto.randomUUID()}`,
      slug: `custom-genre-${crypto.randomUUID()}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(seriesToGenres).values({ seriesId, genreId: customGenreId });

    const tmdbId = (await db.select().from(series).where(eq(series.id, seriesId)))[0].tmdbId;

    const [seasonRow] = await db
      .insert(seasons)
      .values({
        id: crypto.randomUUID(),
        seriesId,
        title: "Season 1",
        status: "ongoing",
        scraperUrl: "https://otakudesu.blog/anime/grand-blue-s3-sub-indo",
        source: "otakudesu",
        episodeOffset: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    await db.insert(episodes).values({
      id: crypto.randomUUID(),
      title: "Episode 1",
      order: 1,
      seasonId: seasonRow.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // TMDB returns a *different* genre; auto-scrape must NOT adopt it.
    vi.spyOn(global, "fetch").mockImplementation(async (input) => {
      const url = input.toString();
      if (url.includes(`/tv/${tmdbId}`) && url.includes("/season/")) {
        return new Response(
          JSON.stringify({ season_number: 1, name: "Season 1", episodes: [] }),
          { status: 200 }
        );
      }
      if (url.includes(`/tv/${tmdbId}`)) {
        return new Response(
          JSON.stringify({
            id: tmdbId,
            name: "TMDB Title",
            overview: "TMDB overview",
            poster_path: null,
            backdrop_path: null,
            vote_average: 7,
            genres: [{ id: 99, name: "TMDB Only Genre" }],
            seasons: [],
          }),
          { status: 200 }
        );
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    });

    const result = await request(app, {
      method: "POST",
      path: `/seasons/${seasonRow.id}/scrape-ongoing`,
      headers,
    });

    expect(result.status).toBe(200);

    const links = await db.select().from(seriesToGenres).where(eq(seriesToGenres.seriesId, seriesId));
    expect(links).toHaveLength(1);
    expect(links[0].genreId).toBe(customGenreId);
  });
});
