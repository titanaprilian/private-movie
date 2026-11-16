import { describe, expect, it, beforeAll, afterEach, vi } from "vitest";
import { asc, eq } from "drizzle-orm";
import { series, seasons, episodes, genres, seriesToGenres } from "@repo/db";
import { buildApp, request, type App } from "../../utils/app";
import { registerUser, authHeaders } from "../../utils/auth";
import { db } from "../../utils/db";
import {
  setupTmdbFetchMock,
  MOCK_TMDB_TV_SHOW,
  MOCK_TMDB_TV_SEASON_1,
  MOCK_TMDB_TV_UPDATED,
  MOCK_TMDB_MOVIE,
} from "../../fixtures/tmdb/import-fixtures";

describe("POST /series/tmdb-import (PostgreSQL Persistence)", () => {
  let app: App;
  let headers: Record<string, string>;

  beforeAll(async () => {
    process.env.TMDB_API_KEY = "test-tmdb-key";
    app = await buildApp();
    const user = await registerUser(app, {
      email: "tmdb-persistence@example.com",
      password: "password123",
      name: "TMDB Persistence Tester",
    });
    headers = authHeaders(user.accessToken);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("persists TV series, seasons, episodes, and genre associations in PostgreSQL", async () => {
    setupTmdbFetchMock();

    const response = await request(app, {
      method: "POST",
      path: "/series/tmdb-import",
      headers,
      body: { type: "tv", tmdbId: 100 },
    });

    expect(response.status).toBe(200);

    // 1. Verify persisted series row
    const seriesRows = await db
      .select()
      .from(series)
      .where(eq(series.tmdbId, 100));

    expect(seriesRows).toHaveLength(1);
    const seriesRow = seriesRows[0];
    expect(seriesRow.title).toBe(MOCK_TMDB_TV_SHOW.name);
    expect(seriesRow.description).toBe(MOCK_TMDB_TV_SHOW.overview);
    expect(seriesRow.posterUrl).toBe(
      `https://image.tmdb.org/t/p/w500${MOCK_TMDB_TV_SHOW.poster_path}`,
    );
    expect(seriesRow.backdropUrl).toBe(
      `https://image.tmdb.org/t/p/original${MOCK_TMDB_TV_SHOW.backdrop_path}`,
    );
    expect(seriesRow.logoUrl).toBe(
      "https://image.tmdb.org/t/p/w500/tv_logo_en.png",
    );
    expect(seriesRow.rating).toBe(String(MOCK_TMDB_TV_SHOW.vote_average));
    expect(seriesRow.type).toBe("tv");
    expect(seriesRow.tmdbSyncStatus).toBe("SYNCED");

    // 2. Verify persisted season row linked to series
    const seasonRows = await db
      .select()
      .from(seasons)
      .where(eq(seasons.seriesId, seriesRow.id));

    expect(seasonRows).toHaveLength(1);
    const seasonRow = seasonRows[0];
    expect(seasonRow.seasonNumber).toBe(1);
    expect(seasonRow.title).toBe(MOCK_TMDB_TV_SEASON_1.name);
    expect(seasonRow.description).toBe(MOCK_TMDB_TV_SEASON_1.overview);
    expect(seasonRow.posterUrl).toBe(
      `https://image.tmdb.org/t/p/w500${MOCK_TMDB_TV_SEASON_1.poster_path}`,
    );
    expect(seasonRow.tmdbSyncStatus).toBe("SYNCED");

    // 3. Verify persisted episode rows linked to season
    const episodeRows = await db
      .select()
      .from(episodes)
      .where(eq(episodes.seasonId, seasonRow.id))
      .orderBy(asc(episodes.order));

    expect(episodeRows).toHaveLength(2);

    expect(episodeRows[0].order).toBe(1);
    expect(episodeRows[0].title).toBe("Hello World");
    expect(episodeRows[0].description).toBe(
      "Setting up the development environment.",
    );
    expect(episodeRows[0].thumbnailUrl).toBe(
      "https://image.tmdb.org/t/p/w500/ep1_still.jpg",
    );
    expect(episodeRows[0].duration).toBe(45);
    expect(episodeRows[0].rating).toBe("8.8");
    expect(episodeRows[0].tmdbSeasonNumber).toBe(1);
    expect(episodeRows[0].tmdbEpisodeNumber).toBe(1);
    expect(episodeRows[0].isUnassigned).toBe(false);

    expect(episodeRows[1].order).toBe(2);
    expect(episodeRows[1].title).toBe("Red-Green-Refactor");
    expect(episodeRows[1].description).toBe("Writing tests first.");
    expect(episodeRows[1].thumbnailUrl).toBe(
      "https://image.tmdb.org/t/p/w500/ep2_still.jpg",
    );
    expect(episodeRows[1].duration).toBe(50);
    expect(episodeRows[1].rating).toBe("9.1");
    expect(episodeRows[1].tmdbSeasonNumber).toBe(1);
    expect(episodeRows[1].tmdbEpisodeNumber).toBe(2);
    expect(episodeRows[1].isUnassigned).toBe(false);

    // 4. Verify persisted genres and junction table
    const junctionRows = await db
      .select()
      .from(seriesToGenres)
      .where(eq(seriesToGenres.seriesId, seriesRow.id));

    expect(junctionRows).toHaveLength(2);

    const allGenres = await db.select().from(genres);
    const genreNames = allGenres.map((g) => g.name);
    expect(genreNames).toContain("Drama");
    expect(genreNames).toContain("Crime");
  });

  it("persists Movie, virtual Season 1, movie Episode, and genres in PostgreSQL", async () => {
    setupTmdbFetchMock();

    const response = await request(app, {
      method: "POST",
      path: "/series/tmdb-import",
      headers,
      body: { type: "movie", tmdbId: 500 },
    });

    expect(response.status).toBe(200);

    // 1. Verify movie series row
    const movieRows = await db
      .select()
      .from(series)
      .where(eq(series.tmdbId, 500));

    expect(movieRows).toHaveLength(1);
    const movieRow = movieRows[0];
    expect(movieRow.title).toBe(MOCK_TMDB_MOVIE.title);
    expect(movieRow.description).toBe(MOCK_TMDB_MOVIE.overview);
    expect(movieRow.type).toBe("movie");
    expect(movieRow.tmdbSyncStatus).toBe("SYNCED");

    // 2. Verify virtual Season 1
    const seasonRows = await db
      .select()
      .from(seasons)
      .where(eq(seasons.seriesId, movieRow.id));

    expect(seasonRows).toHaveLength(1);
    expect(seasonRows[0].seasonNumber).toBe(1);
    expect(seasonRows[0].title).toBe(MOCK_TMDB_MOVIE.title);

    // 3. Verify movie Episode
    const episodeRows = await db
      .select()
      .from(episodes)
      .where(eq(episodes.seasonId, seasonRows[0].id));

    expect(episodeRows).toHaveLength(1);
    expect(episodeRows[0].order).toBe(1);
    expect(episodeRows[0].title).toBe(MOCK_TMDB_MOVIE.title);
    expect(episodeRows[0].duration).toBe(120);

    // 4. Verify movie genres
    const junctionRows = await db
      .select()
      .from(seriesToGenres)
      .where(eq(seriesToGenres.seriesId, movieRow.id));

    expect(junctionRows).toHaveLength(2);
  });

  it("updates existing series and seasons idempotently on re-import without duplicating rows", async () => {
    // Initial import
    setupTmdbFetchMock({ tvShow: MOCK_TMDB_TV_SHOW });

    const initialRes = await request(app, {
      method: "POST",
      path: "/series/tmdb-import",
      headers,
      body: { type: "tv", tmdbId: 100 },
    });
    expect(initialRes.status).toBe(200);

    const initialSeries = await db
      .select()
      .from(series)
      .where(eq(series.tmdbId, 100));
    expect(initialSeries).toHaveLength(1);
    expect(initialSeries[0].description).toBe(MOCK_TMDB_TV_SHOW.overview);

    // Re-import with updated TMDB metadata
    vi.restoreAllMocks();
    setupTmdbFetchMock({ tvShow: MOCK_TMDB_TV_UPDATED });

    const secondRes = await request(app, {
      method: "POST",
      path: "/series/tmdb-import",
      headers,
      body: { type: "tv", tmdbId: 100 },
    });
    expect(secondRes.status).toBe(200);

    // Verify row count is still exactly 1 (no duplicate rows inserted)
    const updatedSeriesRows = await db
      .select()
      .from(series)
      .where(eq(series.tmdbId, 100));

    expect(updatedSeriesRows).toHaveLength(1);
    expect(updatedSeriesRows[0].id).toBe(initialSeries[0].id);
    expect(updatedSeriesRows[0].description).toBe(
      MOCK_TMDB_TV_UPDATED.overview,
    );
    expect(updatedSeriesRows[0].rating).toBe(
      String(MOCK_TMDB_TV_UPDATED.vote_average),
    );

    // Seasons and episodes count should remain 1 and 2 respectively
    const seasonRows = await db
      .select()
      .from(seasons)
      .where(eq(seasons.seriesId, initialSeries[0].id));
    expect(seasonRows).toHaveLength(1);

    const episodeRows = await db
      .select()
      .from(episodes)
      .where(eq(episodes.seasonId, seasonRows[0].id));
    expect(episodeRows).toHaveLength(2);
  });

  it("leaves database clean when external TMDB fetch fails", async () => {
    setupTmdbFetchMock();

    const response = await request(app, {
      method: "POST",
      path: "/series/tmdb-import",
      headers,
      body: { type: "tv", tmdbId: 999999 },
    });

    expect(response.status).toBe(404);

    const seriesRows = await db
      .select()
      .from(series)
      .where(eq(series.tmdbId, 999999));

    expect(seriesRows).toHaveLength(0);
  });
});
