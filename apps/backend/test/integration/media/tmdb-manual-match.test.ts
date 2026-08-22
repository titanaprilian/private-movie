import { describe, expect, it, beforeAll, afterEach, vi } from "vitest";
import { buildApp, request, type App } from "../../utils/app";
import { registerUser, authHeaders } from "../../utils/auth";
import { createDbClient, series } from "@repo/db";
import crypto from "node:crypto";

const db = createDbClient(process.env.DATABASE_URL);

describe("TMDB Manual Match", () => {
  let app: App;
  let headers: Record<string, string>;

  beforeAll(async () => {
    process.env.TMDB_API_KEY = "test-tmdb-key";
    app = await buildApp();
    const user = await registerUser(app, {
      email: "tmdb-tester@example.com",
      password: "password123",
      name: "TMDB Tester",
    });
    headers = authHeaders(user.accessToken);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("GET /media/series/:id/tmdb-preview", () => {
    it("fetches movie preview successfully", async () => {
      vi.spyOn(global, "fetch").mockImplementation(async (input) => {
        const url = input.toString();
        if (url.includes("/movie/123")) {
          return new Response(JSON.stringify({
            title: "Mock Movie",
            poster_path: "/movie_poster.jpg",
            overview: "A great mock movie."
          }), { status: 200 });
        }
        throw new Error(`Unexpected fetch URL: ${url}`);
      });

      const [seriesRecord] = await db.insert(series).values({
        id: crypto.randomUUID(),
        title: "Initial Title",
        sourceUrl: "http://example.com/initial",
        source: "some_source",
        posterUrl: "",
        status: "ONGOING",
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();

      const reqOptions = {
        method: "GET",
        path: `/series/${seriesRecord.id}/tmdb-preview?type=movie&tmdbId=123`,
        headers,
      };

      const result = await request(app, reqOptions);
      if (result.status !== 200) console.log(result.body);
      expect(result.status).toBe(200);

      const body = result.body as any;
      expect(body.data.title).toBe("Mock Movie");
      expect(body.data.posterUrl).toBe("https://image.tmdb.org/t/p/w500/movie_poster.jpg");
      expect(body.data.overview).toBe("A great mock movie.");
    });

    it("fetches tv preview with season successfully", async () => {
      vi.spyOn(global, "fetch").mockImplementation(async (input) => {
        const url = input.toString();
        if (url.includes("/tv/456") && !url.includes("season")) {
          return new Response(JSON.stringify({
            name: "Mock TV",
            overview: "General TV overview."
          }), { status: 200 });
        }
        if (url.includes("/tv/456/season/2")) {
          return new Response(JSON.stringify({
            name: "Mock TV Season",
            poster_path: "/tv_season_poster.jpg",
            overview: "Season 2 overview."
          }), { status: 200 });
        }
        throw new Error(`Unexpected fetch URL: ${url}`);
      });

      const [seriesRecord] = await db.insert(series).values({
        id: crypto.randomUUID(),
        title: "Initial Title",
        sourceUrl: "http://example.com/initial-tv",
        source: "some_source",
        posterUrl: "",
        status: "ONGOING",
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();

      const reqOptions = {
        method: "GET",
        path: `/series/${seriesRecord.id}/tmdb-preview?type=tv&tmdbId=456&season=2`,
        headers,
      };

      const result = await request(app, reqOptions);
      if (result.status !== 200) console.log(result.body);
      expect(result.status).toBe(200);

      const body = result.body as any;
      expect(body.data.title).toBe("Mock TV"); // Name from main /tv/ endpoint
      expect(body.data.posterUrl).toBe("https://image.tmdb.org/t/p/w500/tv_season_poster.jpg");
      expect(body.data.overview).toBe("Season 2 overview.");
    });

    it("returns 400 with error details when TMDB API key is missing", async () => {
      const originalApiKey = process.env.TMDB_API_KEY;
      delete process.env.TMDB_API_KEY;

      const [seriesRecord] = await db.insert(series).values({
        id: crypto.randomUUID(),
        title: "Test Series",
        sourceUrl: "http://example.com/missing-key",
        source: "some_source",
        posterUrl: "",
        status: "ONGOING",
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();

      const reqOptions = {
        method: "GET",
        path: `/series/${seriesRecord.id}/tmdb-preview?type=movie&tmdbId=123`,
        headers,
      };

      const result = await request(app, reqOptions);
      expect(result.status).toBe(400);
      expect((result.body as any).error.code).toBe("TMDB_FETCH");
      expect((result.body as any).error.message).toContain("Missing TMDB_API_KEY");

      process.env.TMDB_API_KEY = originalApiKey;
    });

    it("returns 404 when TMDB returns 404 Not Found", async () => {
      const originalApiKey = process.env.TMDB_API_KEY;
      process.env.TMDB_API_KEY = "dummy-key";
      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ status_message: "The resource you requested could not be found." }), { status: 404 })
      );

      const [seriesRecord] = await db.insert(series).values({
        id: crypto.randomUUID(),
        title: "Test Series 2",
        sourceUrl: "http://example.com/tmdb-404",
        source: "some_source",
        posterUrl: "",
        status: "ONGOING",
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();

      const reqOptions = {
        method: "GET",
        path: `/series/${seriesRecord.id}/tmdb-preview?type=movie&tmdbId=9999999`,
        headers,
      };

      const result = await request(app, reqOptions);
      expect(result.status).toBe(404);
      expect((result.body as any).error.code).toBe("TMDB_FETCH");

      process.env.TMDB_API_KEY = originalApiKey;
    });
  });

  describe("POST /media/series/:id/tmdb-match", () => {
    it("returns 401 when authorization header is missing", async () => {
      const reqOptions = {
        method: "POST",
        path: `/series/${crypto.randomUUID()}/tmdb-match`,
        body: { type: "movie", tmdbId: 789 },
      };

      const result = await request(app, reqOptions);
      expect(result.status).toBe(401);
    });

    it("returns 404 when series is not found", async () => {
      const nonexistentId = crypto.randomUUID();
      const reqOptions = {
        method: "POST",
        path: `/series/${nonexistentId}/tmdb-match`,
        headers,
        body: { type: "movie", tmdbId: 789 },
      };

      const result = await request(app, reqOptions);
      expect(result.status).toBe(404);
    });

    it("updates series with manual movie match successfully", async () => {
      vi.spyOn(global, "fetch").mockImplementation(async (input) => {
        const url = input.toString();
        if (url.includes("/movie/789")) {
          return new Response(JSON.stringify({
            id: 789,
            title: "Movie Manual",
            poster_path: "/movie_manual.jpg",
            overview: "Saved manual movie.",
            backdrop_path: "/movie_manual_bg.jpg",
            vote_average: 8.5,
          }), { status: 200 });
        }
        throw new Error(`Unexpected fetch URL: ${url}`);
      });

      const [seriesRecord] = await db.insert(series).values({
        id: crypto.randomUUID(),
        title: "Old Title",
        sourceUrl: "http://example.com/old",
        source: "some_source",
        posterUrl: "",
        status: "ONGOING",
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();

      const reqOptions = {
        method: "POST",
        path: `/series/${seriesRecord.id}/tmdb-match`,
        headers,
        body: { type: "movie", tmdbId: 789 },
      };

      const result = await request(app, reqOptions);
      if (result.status !== 200) console.log(result.body);
      expect(result.status).toBe(200);

      const [updated] = await db
        .select()
        .from(series)
        .where(require("drizzle-orm").eq(series.id, seriesRecord.id));
      
      expect(updated?.tmdbSyncStatus).toBe("SYNCED");
      expect(updated?.title).toBe("Movie Manual");
      expect(updated?.description).toBe("Saved manual movie.");
      expect(updated?.posterUrl).toBe("/movie_manual.jpg");
      expect(updated?.backdropUrl).toBe("/movie_manual_bg.jpg");
      expect(updated?.rating).toBe("8.5");
      expect(updated?.tmdbId).toBe(789);
      expect(updated?.tmdbSeason).toBe(1);
    });

    it("updates series with manual tv match successfully", async () => {
      vi.spyOn(global, "fetch").mockImplementation(async (input) => {
        const url = input.toString();
        if (url.includes("/tv/999") && !url.includes("season")) {
          return new Response(JSON.stringify({
            id: 999,
            name: "TV Show Manual",
            poster_path: "/tv_main_poster.jpg",
            overview: "Main TV overview.",
            backdrop_path: "/tv_bg.jpg",
            vote_average: 9.1,
          }), { status: 200 });
        }
        if (url.includes("/tv/999/season/3")) {
          return new Response(JSON.stringify({
            name: "Season 3",
            poster_path: "/tv_season_3_poster.jpg",
            overview: "Season 3 overview.",
          }), { status: 200 });
        }
        throw new Error(`Unexpected fetch URL: ${url}`);
      });

      const [seriesRecord] = await db.insert(series).values({
        id: crypto.randomUUID(),
        title: "Old TV Title",
        sourceUrl: "http://example.com/old-tv",
        source: "some_source",
        posterUrl: "",
        status: "ONGOING",
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();

      const reqOptions = {
        method: "POST",
        path: `/series/${seriesRecord.id}/tmdb-match`,
        headers,
        body: { type: "tv", tmdbId: 999, season: 3 },
      };

      const result = await request(app, reqOptions);
      if (result.status !== 200) console.log(result.body);
      expect(result.status).toBe(200);

      const [updated] = await db
        .select()
        .from(series)
        .where(require("drizzle-orm").eq(series.id, seriesRecord.id));
      
      expect(updated?.tmdbSyncStatus).toBe("SYNCED");
      expect(updated?.title).toBe("TV Show Manual");
      expect(updated?.description).toBe("Season 3 overview.");
      expect(updated?.posterUrl).toBe("/tv_season_3_poster.jpg");
      expect(updated?.backdropUrl).toBe("/tv_bg.jpg");
      expect(updated?.rating).toBe("9.1");
      expect(updated?.tmdbId).toBe(999);
      expect(updated?.tmdbSeason).toBe(3);
    });
  });
});
