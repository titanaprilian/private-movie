import { describe, expect, it, beforeAll, afterEach, vi } from "vitest";
import { buildApp, request, type App } from "../../utils/app";
import { registerUser, authHeaders } from "../../utils/auth";
import crypto from "node:crypto";
import { createSaveEpisodeService, type SeriesWithEpisodes, type TmdbSyncPreviewResult } from "@repo/media-service";
import { createDbClient } from "@repo/db";

interface ErrorResponseBody {
  error: {
    code: string;
    message: string;
  };
}

interface SuccessResponseBody<T> {
  data: T;
}

const db = createDbClient(process.env.DATABASE_URL);

describe("POST /series/:id/tmdb-sync", () => {
  let app: App;
  let headers: Record<string, string>;

  beforeAll(async () => {
    process.env.TMDB_API_KEY = "test-tmdb-key";
    app = await buildApp();
    const user = await registerUser(app, {
      email: `series-tmdb-sync-${crypto.randomUUID()}@example.com`,
      password: "password123",
      name: "Series TMDB Sync Tester",
    });
    headers = authHeaders(user.accessToken);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 Unauthorized when Bearer token is missing or invalid", async () => {
    const validUuid = crypto.randomUUID();
    const resNoToken = await request(app, {
      method: "POST",
      path: `/series/${validUuid}/tmdb-sync`,
      body: { type: "tv", tmdbId: 100 },
    });
    expect(resNoToken.status).toBe(401);

    const resInvalidToken = await request(app, {
      method: "POST",
      path: `/series/${validUuid}/tmdb-sync`,
      headers: { authorization: "Bearer invalid-token" },
      body: { type: "tv", tmdbId: 100 },
    });
    expect(resInvalidToken.status).toBe(401);
  });

  it("returns 404 Not Found when target series ID does not exist", async () => {
    const nonExistentId = crypto.randomUUID();
    const res = await request(app, {
      method: "POST",
      path: `/series/${nonExistentId}/tmdb-sync`,
      headers,
      body: { type: "tv", tmdbId: 100 },
    });

    expect(res.status).toBe(404);
    const body = res.body as ErrorResponseBody;
    expect(body.error.code).toBe("SERIES_NOT_FOUND");
  });

  it("returns 400 Bad Request when request body has invalid types or missing fields", async () => {
    const validUuid = crypto.randomUUID();

    const resMissingBody = await request(app, {
      method: "POST",
      path: `/series/${validUuid}/tmdb-sync`,
      headers,
      body: { type: "invalid_type" },
    });
    expect(resMissingBody.status).toBe(400);

    const resInvalidIdParam = await request(app, {
      method: "POST",
      path: `/series/not-a-uuid/tmdb-sync`,
      headers,
      body: { type: "tv", tmdbId: 100 },
    });
    expect(resInvalidIdParam.status).toBe(400);
  });

  it("returns 404 Not Found when TMDB returns 404 for tmdbId", async () => {
    const mediaService = createSaveEpisodeService(db);
    const initial = await mediaService.saveMedia({
      episode: {
        sourceUrl: "https://example.com/ep1",
        source: "otakudesu",
        title: "Test Ep 1",
        metadata: {},
      },
      series: {
        sourceUrl: "https://example.com/series",
        source: "otakudesu",
        title: `Series For TMDB 404 Test ${crypto.randomUUID()}`,
      },
    });

    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({ status_message: "The resource you requested could not be found." }),
        { status: 404 }
      )
    );

    const res = await request(app, {
      method: "POST",
      path: `/series/${initial.series!.id}/tmdb-sync`,
      headers,
      body: { type: "tv", tmdbId: 999999 },
    });

    expect(res.status).toBe(404);
    const body = res.body as ErrorResponseBody;
    expect(body.error.code).toBe("TMDB_FETCH");
  });

  it("updates series metadata, inserts new episodes, and preserves existing episode IDs and video sources", async () => {
    const mediaService = createSaveEpisodeService(db);
    const initial = await mediaService.saveMedia({
      episode: {
        sourceUrl: "https://example.com/anime/ep1",
        source: "otakudesu",
        title: "Episode 1",
        metadata: {},
        videoSources: [
          {
            type: "embed",
            url: "https://embed.example.com/v1",
            label: "Server 1",
          },
        ],
      },
      series: {
        sourceUrl: "https://example.com/anime/series",
        source: "otakudesu",
        title: `Original Series Title ${crypto.randomUUID()}`,
      },
    });

    const seriesId = initial.series!.id;
    const existingEpisodeId = initial.episode.id;

    vi.spyOn(global, "fetch").mockImplementation(async (input) => {
      const url = input.toString();
      if (url.includes("/tv/200/season/1")) {
        return new Response(
          JSON.stringify({
            season_number: 1,
            name: "Season 1",
            overview: "Synced Season 1 Overview",
            poster_path: "/season1.jpg",
            episodes: [
              {
                episode_number: 1,
                name: "Synced Episode 1 Title",
                overview: "Synced Episode 1 Overview",
                still_path: "/ep1.jpg",
                vote_average: 8.5,
                air_date: "2024-01-01",
                runtime: 24,
              },
              {
                episode_number: 2,
                name: "Newly Aired Episode 2",
                overview: "Newly Aired Episode 2 Overview",
                still_path: "/ep2.jpg",
                vote_average: 8.7,
                air_date: "2024-01-08",
                runtime: 24,
              },
            ],
          }),
          { status: 200 }
        );
      }
      if (url.includes("/tv/200")) {
        return new Response(
          JSON.stringify({
            id: 200,
            name: "Synced Series Title",
            overview: "Synced Series Description",
            poster_path: "/series_poster.jpg",
            backdrop_path: "/series_backdrop.jpg",
            vote_average: 9.1,
            genres: [{ id: 1, name: "Action" }],
            seasons: [
              {
                season_number: 1,
                name: "Season 1",
                poster_path: "/season1.jpg",
                episode_count: 2,
              },
            ],
          }),
          { status: 200 }
        );
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    });

    const res = await request(app, {
      method: "POST",
      path: `/series/${seriesId}/tmdb-sync`,
      headers,
      body: { type: "tv", tmdbId: 200 },
    });

    expect(res.status).toBe(200);

    const body = res.body as SuccessResponseBody<SeriesWithEpisodes>;
    expect(body.data.id).toBe(seriesId);
    expect(body.data.title).toBe("Synced Series Title");
    expect(body.data.description).toBe("Synced Series Description");
    expect(body.data.tmdbSyncStatus).toBe("SYNCED");
    expect(body.data.tmdbId).toBe(200);

    const season1 = body.data.seasons.find((s) => s.seasonNumber === 1);
    expect(season1).toBeDefined();
    expect(season1?.episodes).toHaveLength(2);

    const ep1 = season1?.episodes.find((e) => e.order === 1);
    const ep2 = season1?.episodes.find((e) => e.order === 2);

    expect(ep1).toBeDefined();
    expect(ep1?.id).toBe(existingEpisodeId);
    expect(ep1?.title).toBe("Synced Episode 1 Title");
    expect(ep1?.videoSources).toHaveLength(1);
    expect(ep1?.videoSources[0].url).toBe("https://embed.example.com/v1");

    expect(ep2).toBeDefined();
    expect(ep2?.id).not.toBe(existingEpisodeId);
    expect(ep2?.title).toBe("Newly Aired Episode 2");
  });
});

describe("GET /series/:id/tmdb-sync-preview", () => {
  let app: App;
  let headers: Record<string, string>;

  beforeAll(async () => {
    process.env.TMDB_API_KEY = "test-tmdb-key";
    app = await buildApp();
    const user = await registerUser(app, {
      email: `series-tmdb-preview-${crypto.randomUUID()}@example.com`,
      password: "password123",
      name: "Series TMDB Sync Preview Tester",
    });
    headers = authHeaders(user.accessToken);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 Unauthorized when Bearer token is missing or invalid", async () => {
    const validUuid = crypto.randomUUID();
    const resNoToken = await request(app, {
      method: "GET",
      path: `/series/${validUuid}/tmdb-sync-preview?type=tv&tmdbId=100`,
    });
    expect(resNoToken.status).toBe(401);

    const resInvalidToken = await request(app, {
      method: "GET",
      path: `/series/${validUuid}/tmdb-sync-preview?type=tv&tmdbId=100`,
      headers: { authorization: "Bearer invalid-token" },
    });
    expect(resInvalidToken.status).toBe(401);
  });

  it("returns 404 Not Found when target series ID does not exist", async () => {
    const nonExistentId = crypto.randomUUID();
    const res = await request(app, {
      method: "GET",
      path: `/series/${nonExistentId}/tmdb-sync-preview?type=tv&tmdbId=100`,
      headers,
    });

    expect(res.status).toBe(404);
    const body = res.body as ErrorResponseBody;
    expect(body.error.code).toBe("SERIES_NOT_FOUND");
  });

  it("returns 404 Not Found when TMDB returns 404 for tmdbId", async () => {
    const mediaService = createSaveEpisodeService(db);
    const initial = await mediaService.saveMedia({
      episode: {
        sourceUrl: "https://example.com/ep1",
        source: "otakudesu",
        title: "Initial Episode",
        metadata: {},
      },
      series: {
        sourceUrl: "https://example.com/anime/test-series-sync-prev-404",
        source: "otakudesu",
        title: "Test Series Sync Prev 404",
        description: "Initial description",
        posterUrl: "https://example.com/poster.jpg",
      },
    });

    const seriesId = initial.series!.id;

    vi.spyOn(global, "fetch").mockImplementation(async (input) => {
      const url = input.toString();
      if (url.includes("/tv/999999")) {
        return new Response(JSON.stringify({ status_message: "The resource you requested could not be found." }), {
          status: 404,
        });
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    });

    const res = await request(app, {
      method: "GET",
      path: `/series/${seriesId}/tmdb-sync-preview?type=tv&tmdbId=999999`,
      headers,
    });

    expect(res.status).toBe(404);
  });

  it("returns detailed diff including episodeChanges, seasonDiffs, and seriesUpdated=true", async () => {
    const mediaService = createSaveEpisodeService(db);
    const initial = await mediaService.saveMedia({
      episode: {
        sourceUrl: "https://example.com/ep1",
        source: "otakudesu",
        title: "Old Episode 1 Title",
        metadata: {},
      },
      series: {
        sourceUrl: "https://example.com/anime/test-series-sync-prev-diff",
        source: "otakudesu",
        title: "Old Series Title",
        description: "Old Series Description",
        posterUrl: "https://example.com/old_poster.jpg",
      },
    });

    const seriesId = initial.series!.id;

    vi.spyOn(global, "fetch").mockImplementation(async (input) => {
      const url = input.toString();
      if (url.includes("/tv/500/season/1")) {
        return new Response(
          JSON.stringify({
            season_number: 1,
            name: "Season 1",
            overview: "Season 1 overview",
            poster_path: "/s1.jpg",
            episodes: [
              {
                episode_number: 1,
                name: "Updated Episode 1 Title",
                overview: "Freshly translated overview from TMDB",
                still_path: "/ep1_thumb.jpg",
                air_date: "2023-01-01",
              },
              {
                episode_number: 2,
                name: "New Episode 2",
                overview: "New ep overview",
                still_path: "/ep2_thumb.jpg",
                air_date: "2023-01-08",
              },
            ],
          }),
          { status: 200 }
        );
      }
      if (url.includes("/tv/500")) {
        return new Response(
          JSON.stringify({
            id: 500,
            name: "Updated Series Title",
            overview: "Updated Series Description",
            poster_path: "/new_poster.jpg",
            backdrop_path: "/new_backdrop.jpg",
            vote_average: 8.8,
            first_air_date: "2023-01-01",
            genres: [{ id: 1, name: "Anime" }],
            seasons: [
              {
                season_number: 1,
                name: "Season 1",
                poster_path: "/season1.jpg",
                episode_count: 2,
              },
            ],
          }),
          { status: 200 }
        );
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    });

    const res = await request(app, {
      method: "GET",
      path: `/series/${seriesId}/tmdb-sync-preview?type=tv&tmdbId=500`,
      headers,
    });

    expect(res.status).toBe(200);

    const body = res.body as SuccessResponseBody<TmdbSyncPreviewResult>;
    expect(body.data.seriesId).toBe(seriesId);
    expect(body.data.seriesUpdated).toBe(true);
    expect(body.data.series.title).toBe("Updated Series Title");
    expect(body.data.series.overview).toBe("Updated Series Description");
    expect(body.data.totalNewEpisodes).toBe(1); // Episode 2 is new
    expect(body.data.totalUpdatedEpisodes).toBe(1); // Episode 1 has changed title/overview/thumbnail
    expect(body.data.seasonDiffs).toHaveLength(1);
    expect(body.data.seasonDiffs[0].diff).toBe(1);
    expect(body.data.episodeChanges).toHaveLength(1);
    expect(body.data.episodeChanges[0]).toEqual(
      expect.objectContaining({
        seasonNumber: 1,
        episodeNumber: 1,
        oldTitle: "Old Episode 1 Title",
        newTitle: "Updated Episode 1 Title",
        newOverview: "Freshly translated overview from TMDB",
        titleChanged: true,
        overviewChanged: true,
        thumbnailChanged: true,
      })
    );
  });
});