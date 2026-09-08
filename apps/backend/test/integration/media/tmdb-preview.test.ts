import { describe, expect, it, beforeAll, afterEach, vi } from "vitest";
import { buildApp, request, type App } from "../../utils/app";
import { registerUser, authHeaders } from "../../utils/auth";
import type { TmdbPreviewResult } from "@repo/media-service";

interface ErrorResponseBody {
  error: {
    code: string;
    message: string;
  };
}

interface SuccessResponseBody<T> {
  data: T;
}

describe("GET /series/tmdb-preview", () => {
  let app: App;
  let headers: Record<string, string>;

  beforeAll(async () => {
    process.env.TMDB_API_KEY = "test-tmdb-key";
    app = await buildApp();
    const user = await registerUser(app, {
      email: "tmdb-previewer@example.com",
      password: "password123",
      name: "TMDB Previewer",
    });
    headers = authHeaders(user.accessToken);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 when authorization header is missing", async () => {
    const reqOptions = {
      method: "GET",
      path: "/series/tmdb-preview?type=tv&tmdbId=100",
    };

    const result = await request(app, reqOptions);
    expect(result.status).toBe(401);
  });

  it("returns 401 when authorization header is invalid", async () => {
    const reqOptions = {
      method: "GET",
      path: "/series/tmdb-preview?type=tv&tmdbId=100",
      headers: { authorization: "Bearer invalid-token" },
    };

    const result = await request(app, reqOptions);
    expect(result.status).toBe(401);
  });

  it("returns 400 when type is invalid", async () => {
    const reqOptions = {
      method: "GET",
      path: "/series/tmdb-preview?type=anime&tmdbId=100",
      headers,
    };

    const result = await request(app, reqOptions);
    expect(result.status).toBe(400);
  });

  it("returns 400 when tmdbId is missing or non-numeric", async () => {
    const reqOptionsMissing = {
      method: "GET",
      path: "/series/tmdb-preview?type=tv",
      headers,
    };
    const resMissing = await request(app, reqOptionsMissing);
    expect(resMissing.status).toBe(400);

    const reqOptionsNonNumeric = {
      method: "GET",
      path: "/series/tmdb-preview?type=tv&tmdbId=abc",
      headers,
    };
    const resNonNumeric = await request(app, reqOptionsNonNumeric);
    expect(resNonNumeric.status).toBe(400);
  });

  it("returns 404 when TMDB returns 404 Not Found", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({ status_message: "The resource you requested could not be found." }),
        { status: 404 }
      )
    );

    const reqOptions = {
      method: "GET",
      path: "/series/tmdb-preview?type=movie&tmdbId=999999",
      headers,
    };

    const result = await request(app, reqOptions);
    expect(result.status).toBe(404);
    const body = result.body as ErrorResponseBody;
    expect(body.error.code).toBe("TMDB_FETCH");
  });

  it("successfully fetches TV show preview excluding specials by default", async () => {
    vi.spyOn(global, "fetch").mockImplementation(async (input) => {
      const url = input.toString();
      if (url.includes("/tv/100")) {
        return new Response(
          JSON.stringify({
            id: 100,
            name: "Mock TV Series",
            overview: "A mock TV show preview overview.",
            poster_path: "/tv_poster.jpg",
            backdrop_path: "/tv_backdrop.jpg",
            first_air_date: "2022-03-10",
            status: "Ended",
            genres: [{ id: 1, name: "Drama" }, { id: 2, name: "Mystery" }],
            seasons: [
              { season_number: 0, name: "Specials", episode_count: 3, poster_path: "/s0.jpg" },
              { season_number: 1, name: "Season 1", episode_count: 10, poster_path: "/s1.jpg" },
              { season_number: 2, name: "Season 2", episode_count: 8, poster_path: "/s2.jpg" },
            ],
          }),
          { status: 200 }
        );
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    });

    const reqOptions = {
      method: "GET",
      path: "/series/tmdb-preview?type=tv&tmdbId=100",
      headers,
    };

    const result = await request(app, reqOptions);
    expect(result.status).toBe(200);

    const body = result.body as SuccessResponseBody<TmdbPreviewResult>;
    expect(body.data).toEqual({
      title: "Mock TV Series",
      overview: "A mock TV show preview overview.",
      posterUrl: "https://image.tmdb.org/t/p/w500/tv_poster.jpg",
      backdropUrl: "https://image.tmdb.org/t/p/w500/tv_backdrop.jpg",
      releaseDate: "2022-03-10",
      genres: ["Drama", "Mystery"],
      status: "Ended",
      totalSeasons: 2,
      totalEpisodes: 18,
      seasons: [
        {
          seasonNumber: 1,
          name: "Season 1",
          episodeCount: 10,
          posterUrl: "https://image.tmdb.org/t/p/w500/s1.jpg",
        },
        {
          seasonNumber: 2,
          name: "Season 2",
          episodeCount: 8,
          posterUrl: "https://image.tmdb.org/t/p/w500/s2.jpg",
        },
      ],
    });
  });

  it("successfully fetches TV show preview including specials when includeSpecials=true", async () => {
    vi.spyOn(global, "fetch").mockImplementation(async (input) => {
      const url = input.toString();
      if (url.includes("/tv/100")) {
        return new Response(
          JSON.stringify({
            id: 100,
            name: "Mock TV Series",
            overview: "A mock TV show preview overview.",
            poster_path: "/tv_poster.jpg",
            backdrop_path: "/tv_backdrop.jpg",
            first_air_date: "2022-03-10",
            status: "Ended",
            genres: [{ id: 1, name: "Drama" }],
            seasons: [
              { season_number: 0, name: "Specials", episode_count: 3, poster_path: "/s0.jpg" },
              { season_number: 1, name: "Season 1", episode_count: 10, poster_path: "/s1.jpg" },
            ],
          }),
          { status: 200 }
        );
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    });

    const reqOptions = {
      method: "GET",
      path: "/series/tmdb-preview?type=tv&tmdbId=100&includeSpecials=true",
      headers,
    };

    const result = await request(app, reqOptions);
    expect(result.status).toBe(200);

    const body = result.body as SuccessResponseBody<TmdbPreviewResult>;
    expect(body.data.totalSeasons).toBe(2);
    expect(body.data.totalEpisodes).toBe(13);
    expect(body.data.seasons).toHaveLength(2);
    expect(body.data.seasons[0].seasonNumber).toBe(0);
  });

  it("successfully fetches Movie preview snapshot", async () => {
    vi.spyOn(global, "fetch").mockImplementation(async (input) => {
      const url = input.toString();
      if (url.includes("/movie/500")) {
        return new Response(
          JSON.stringify({
            id: 500,
            title: "Mock Movie Title",
            overview: "A mock movie preview overview.",
            poster_path: "/movie_poster.jpg",
            backdrop_path: "/movie_backdrop.jpg",
            release_date: "2023-11-20",
            runtime: 125,
            genres: [{ id: 10, name: "Sci-Fi" }],
          }),
          { status: 200 }
        );
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    });

    const reqOptions = {
      method: "GET",
      path: "/series/tmdb-preview?type=movie&tmdbId=500",
      headers,
    };

    const result = await request(app, reqOptions);
    expect(result.status).toBe(200);

    const body = result.body as SuccessResponseBody<TmdbPreviewResult>;
    expect(body.data).toEqual({
      title: "Mock Movie Title",
      overview: "A mock movie preview overview.",
      posterUrl: "https://image.tmdb.org/t/p/w500/movie_poster.jpg",
      backdropUrl: "https://image.tmdb.org/t/p/w500/movie_backdrop.jpg",
      releaseDate: "2023-11-20",
      genres: ["Sci-Fi"],
      runtime: 125,
    });
  });
});
