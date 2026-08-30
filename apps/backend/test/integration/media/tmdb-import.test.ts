import { describe, expect, it, beforeAll, afterEach, vi } from "vitest";
import { buildApp, request, type App } from "../../utils/app";
import { registerUser, authHeaders } from "../../utils/auth";
import { createDbClient } from "@repo/db";

const db = createDbClient(process.env.DATABASE_URL);

describe("POST /series/tmdb-import", () => {
  let app: App;
  let headers: Record<string, string>;

  beforeAll(async () => {
    process.env.TMDB_API_KEY = "test-tmdb-key";
    app = await buildApp();
    const user = await registerUser(app, {
      email: "tmdb-importer@example.com",
      password: "password123",
      name: "TMDB Importer",
    });
    headers = authHeaders(user.accessToken);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 when authorization header is missing", async () => {
    const reqOptions = {
      method: "POST",
      path: "/series/tmdb-import",
      body: { type: "tv", tmdbId: 100 },
    };

    const result = await request(app, reqOptions);
    expect(result.status).toBe(401);
  });

  it("returns 401 when authorization header is invalid", async () => {
    const reqOptions = {
      method: "POST",
      path: "/series/tmdb-import",
      headers: { authorization: "Bearer invalid-token" },
      body: { type: "tv", tmdbId: 100 },
    };

    const result = await request(app, reqOptions);
    expect(result.status).toBe(401);
  });

  it("returns 400 when type is invalid", async () => {
    const reqOptions = {
      method: "POST",
      path: "/series/tmdb-import",
      headers,
      body: { type: "anime", tmdbId: 100 },
    };

    const result = await request(app, reqOptions);
    expect(result.status).toBe(400);
  });

  it("returns 400 when tmdbId is missing", async () => {
    const reqOptions = {
      method: "POST",
      path: "/series/tmdb-import",
      headers,
      body: { type: "tv" },
    };

    const result = await request(app, reqOptions);
    expect(result.status).toBe(400);
  });

  it("successfully imports a TV show from TMDB", async () => {
    vi.spyOn(global, "fetch").mockImplementation(async (input) => {
      const url = input.toString();
      if (url.includes("/tv/100/season/1")) {
        return new Response(
          JSON.stringify({
            id: 1001,
            season_number: 1,
            name: "Season 1",
            overview: "Season 1 details",
            poster_path: "/s1_poster.jpg",
            episodes: [
              {
                episode_number: 1,
                name: "Pilot Episode",
                overview: "First episode overview",
                still_path: "/ep1_still.jpg",
                air_date: "2023-01-01",
              },
            ],
          }),
          { status: 200 }
        );
      }
      if (url.includes("/tv/100")) {
        return new Response(
          JSON.stringify({
            id: 100,
            name: "Mock TV Show",
            overview: "A great TV show from TMDB.",
            poster_path: "/tv_poster.jpg",
            backdrop_path: "/tv_backdrop.jpg",
            vote_average: 8.4,
            seasons: [
              {
                season_number: 1,
                name: "Season 1",
                poster_path: "/s1_poster.jpg",
                overview: "Season 1 overview",
                air_date: "2023-01-01",
              },
            ],
            genres: [{ id: 1, name: "Action" }],
          }),
          { status: 200 }
        );
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    });

    const reqOptions = {
      method: "POST",
      path: "/series/tmdb-import",
      headers,
      body: { type: "tv", tmdbId: 100 },
    };

    const result = await request(app, reqOptions);
    expect(result.status).toBe(200);

    const body = result.body as any;
    expect(body.data.title).toBe("Mock TV Show");
    expect(body.data.type).toBe("tv");
    expect(body.data.tmdbId).toBe(100);
    expect(body.data.tmdbSyncStatus).toBe("SYNCED");
    expect(body.data.seasons).toHaveLength(1);
    expect(body.data.seasons[0].seasonNumber).toBe(1);
  });

  it("successfully imports a Movie from TMDB", async () => {
    vi.spyOn(global, "fetch").mockImplementation(async (input) => {
      const url = input.toString();
      if (url.includes("/movie/500")) {
        return new Response(
          JSON.stringify({
            id: 500,
            title: "Mock Movie Title",
            overview: "A great movie overview.",
            poster_path: "/movie_poster.jpg",
            backdrop_path: "/movie_backdrop.jpg",
            release_date: "2024-05-15",
            vote_average: 9.0,
            genres: [{ id: 2, name: "Sci-Fi" }],
          }),
          { status: 200 }
        );
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    });

    const reqOptions = {
      method: "POST",
      path: "/series/tmdb-import",
      headers,
      body: { type: "movie", tmdbId: 500 },
    };

    const result = await request(app, reqOptions);
    expect(result.status).toBe(200);

    const body = result.body as any;
    expect(body.data.title).toBe("Mock Movie Title");
    expect(body.data.type).toBe("movie");
    expect(body.data.tmdbId).toBe(500);
    expect(body.data.tmdbSyncStatus).toBe("SYNCED");
    expect(body.data.seasons).toHaveLength(1);
    expect(body.data.seasons[0].seasonNumber).toBe(1);
  });

  it("returns 404 when TMDB returns 404 Not Found", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({ status_message: "The resource you requested could not be found." }),
        { status: 404 }
      )
    );

    const reqOptions = {
      method: "POST",
      path: "/series/tmdb-import",
      headers,
      body: { type: "movie", tmdbId: 999999 },
    };

    const result = await request(app, reqOptions);
    expect(result.status).toBe(404);
    const body = result.body as any;
    expect(body.error.code).toBe("TMDB_FETCH");
  });
});
