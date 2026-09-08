import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchTmdbSeriesData,
  saveTmdbSeries,
  getTmdbPreview,
  TmdbFetchError,
  SeriesNotFoundError,
  createMediaService,
} from "../../../src";

describe("TMDB Service fetchTmdbSeriesData", () => {
  const mockFetchFn = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches TV series metadata and iteratively fetches all seasons when type is 'tv'", async () => {
    mockFetchFn.mockImplementation((url: string) => {
      if (url === "https://api.themoviedb.org/3/tv/100") {
        return Promise.resolve({
          id: 100,
          name: "Test TV Show",
          overview: "TV Overview",
          poster_path: "/tv_poster.jpg",
          backdrop_path: "/tv_backdrop.jpg",
          first_air_date: "2021-01-01",
          vote_average: 8.2,
          genres: [{ id: 1, name: "Drama" }],
          seasons: [
            { id: 10, season_number: 0, name: "Specials", episode_count: 1 },
            { id: 11, season_number: 1, name: "Season 1", episode_count: 10 },
            { id: 12, season_number: 2, name: "Season 2", episode_count: 10 },
          ],
        });
      }

      if (url === "https://api.themoviedb.org/3/tv/100/season/1") {
        return Promise.resolve({
          id: 11,
          season_number: 1,
          name: "Season 1",
          overview: "S1 Overview",
          poster_path: "/s1.jpg",
          air_date: "2021-01-01",
          episodes: [
            {
              id: 1001,
              episode_number: 1,
              name: "Ep 1",
              overview: "Ep 1 Overview",
              runtime: 45,
              still_path: "/ep1.jpg",
              vote_average: 8.0,
              air_date: "2021-01-01",
            },
          ],
        });
      }

      if (url === "https://api.themoviedb.org/3/tv/100/season/2") {
        return Promise.resolve({
          id: 12,
          season_number: 2,
          name: "Season 2",
          overview: "S2 Overview",
          poster_path: "/s2.jpg",
          air_date: "2022-01-01",
          episodes: [
            {
              id: 1002,
              episode_number: 1,
              name: "Ep 1",
              overview: "S2 Ep 1 Overview",
              runtime: 45,
              still_path: "/ep2_1.jpg",
              vote_average: 8.5,
              air_date: "2022-01-01",
            },
          ],
        });
      }

      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });

    const seriesData = await fetchTmdbSeriesData(100, {
      type: "tv",
      token: "test-token",
      fetchFn: mockFetchFn,
    });

    expect(seriesData).toMatchObject({
      tmdbId: 100,
      type: "tv",
      title: "Test TV Show",
      description: "TV Overview",
      posterPath: "https://image.tmdb.org/t/p/w500/tv_poster.jpg",
      backdropPath: "https://image.tmdb.org/t/p/w500/tv_backdrop.jpg",
      voteAverage: 8.2,
      genres: ["Drama"],
    });

    expect(seriesData.seasons).toHaveLength(2);
    expect(seriesData.seasons[0].seasonNumber).toBe(1);
    expect(seriesData.seasons[0].episodes).toHaveLength(1);
    expect(seriesData.seasons[1].seasonNumber).toBe(2);
  });

  it("fetches Movie metadata and generates 1 artificial season with 1 artificial episode when type is 'movie'", async () => {
    mockFetchFn.mockImplementation((url: string) => {
      if (url === "https://api.themoviedb.org/3/movie/500") {
        return Promise.resolve({
          id: 500,
          title: "Inception",
          overview: "A thief who steals corporate secrets...",
          poster_path: "/inception.jpg",
          backdrop_path: "/inception_bg.jpg",
          release_date: "2010-07-16",
          vote_average: 8.8,
          runtime: 148,
          genres: [
            { id: 28, name: "Action" },
            { id: 878, name: "Science Fiction" },
          ],
        });
      }

      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });

    const movieData = await fetchTmdbSeriesData(500, {
      type: "movie",
      token: "test-token",
      fetchFn: mockFetchFn,
    });

    expect(movieData).toMatchObject({
      tmdbId: 500,
      type: "movie",
      title: "Inception",
      description: "A thief who steals corporate secrets...",
      posterPath: "https://image.tmdb.org/t/p/w500/inception.jpg",
      backdropPath: "https://image.tmdb.org/t/p/w500/inception_bg.jpg",
      firstAirDate: "2010-07-16",
      voteAverage: 8.8,
      genres: ["Action", "Science Fiction"],
    });

    expect(movieData.seasons).toHaveLength(1);
    expect(movieData.seasons[0].seasonNumber).toBe(1);
    expect(movieData.seasons[0].name).toBe("Inception");
    expect(movieData.seasons[0].episodes).toHaveLength(1);

    const ep = movieData.seasons[0].episodes[0];
    expect(ep.episode_number).toBe(1);
    expect(ep.name).toBe("Inception");
    expect(ep.runtime).toBe(148);
  });
});

describe("TMDB Service getTmdbPreview", () => {
  const mockFetchFn = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns TV show preview snapshot excluding specials when includeSpecials is false", async () => {
    mockFetchFn.mockImplementation((url: string) => {
      if (url === "https://api.themoviedb.org/3/tv/100") {
        return Promise.resolve({
          id: 100,
          name: "Test TV Show",
          overview: "A great TV show overview.",
          poster_path: "/tv_poster.jpg",
          backdrop_path: "/tv_backdrop.jpg",
          first_air_date: "2021-01-01",
          status: "Returning Series",
          genres: [{ id: 1, name: "Drama" }, { id: 2, name: "Action" }],
          seasons: [
            { id: 10, season_number: 0, name: "Specials", episode_count: 5, poster_path: "/s0.jpg" },
            { id: 11, season_number: 1, name: "Season 1", episode_count: 10, poster_path: "/s1.jpg" },
            { id: 12, season_number: 2, name: "Season 2", episode_count: 12, poster_path: "/s2.jpg" },
          ],
        });
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });

    const preview = await getTmdbPreview(100, {
      type: "tv",
      includeSpecials: false,
      token: "test-token",
      fetchFn: mockFetchFn,
    });

    expect(preview).toEqual({
      title: "Test TV Show",
      overview: "A great TV show overview.",
      posterUrl: "https://image.tmdb.org/t/p/w500/tv_poster.jpg",
      backdropUrl: "https://image.tmdb.org/t/p/w500/tv_backdrop.jpg",
      releaseDate: "2021-01-01",
      genres: ["Drama", "Action"],
      status: "Returning Series",
      totalSeasons: 2,
      totalEpisodes: 22,
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
          episodeCount: 12,
          posterUrl: "https://image.tmdb.org/t/p/w500/s2.jpg",
        },
      ],
    });
  });

  it("returns TV show preview snapshot including specials when includeSpecials is true", async () => {
    mockFetchFn.mockImplementation((url: string) => {
      if (url === "https://api.themoviedb.org/3/tv/100") {
        return Promise.resolve({
          id: 100,
          name: "Test TV Show",
          overview: "A great TV show overview.",
          poster_path: "/tv_poster.jpg",
          backdrop_path: "/tv_backdrop.jpg",
          first_air_date: "2021-01-01",
          status: "Returning Series",
          genres: [{ id: 1, name: "Drama" }],
          seasons: [
            { id: 10, season_number: 0, name: "Specials", episode_count: 5, poster_path: "/s0.jpg" },
            { id: 11, season_number: 1, name: "Season 1", episode_count: 10, poster_path: "/s1.jpg" },
          ],
        });
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });

    const preview = await getTmdbPreview(100, {
      type: "tv",
      includeSpecials: true,
      token: "test-token",
      fetchFn: mockFetchFn,
    });

    expect(preview.totalSeasons).toBe(2);
    expect(preview.totalEpisodes).toBe(15);
    expect(preview.seasons).toHaveLength(2);
    expect(preview.seasons![0].seasonNumber).toBe(0);
    expect(preview.seasons![0].name).toBe("Specials");
  });

  it("returns Movie preview snapshot with runtime and undefined TV fields", async () => {
    mockFetchFn.mockImplementation((url: string) => {
      if (url === "https://api.themoviedb.org/3/movie/500") {
        return Promise.resolve({
          id: 500,
          title: "Inception",
          overview: "A thief who steals corporate secrets...",
          poster_path: "/inception.jpg",
          backdrop_path: "/inception_bg.jpg",
          release_date: "2010-07-16",
          vote_average: 8.8,
          runtime: 148,
          genres: [
            { id: 28, name: "Action" },
            { id: 878, name: "Sci-Fi" },
          ],
        });
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });

    const preview = await getTmdbPreview(500, {
      type: "movie",
      token: "test-token",
      fetchFn: mockFetchFn,
    });

    expect(preview).toEqual({
      title: "Inception",
      overview: "A thief who steals corporate secrets...",
      posterUrl: "https://image.tmdb.org/t/p/w500/inception.jpg",
      backdropUrl: "https://image.tmdb.org/t/p/w500/inception_bg.jpg",
      releaseDate: "2010-07-16",
      genres: ["Action", "Sci-Fi"],
      runtime: 148,
      totalSeasons: undefined,
      totalEpisodes: undefined,
      status: undefined,
      seasons: undefined,
    });
  });

  it("throws TmdbFetchError with status 404 when TMDB returns 404", async () => {
    mockFetchFn.mockRejectedValue(new TmdbFetchError("TMDB API Error: 404 Not Found", 404));

    await expect(
      getTmdbPreview(999999, {
        type: "movie",
        token: "test-token",
        fetchFn: mockFetchFn,
      })
    ).rejects.toThrow(TmdbFetchError);
  });
});

describe("saveTmdbSeries database upserts", () => {
  it("persists movie series with type='movie', 1 season and 1 episode inside transaction", async () => {
    const mockWhere = vi.fn().mockResolvedValue(undefined);
    const mockDelete = vi.fn().mockReturnValue({ where: mockWhere });

    const mockReturning = vi
      .fn()
      .mockResolvedValueOnce([{ id: "movie-series-id", title: "Inception", type: "movie" }])
      .mockResolvedValueOnce([{ id: "genre-id-1" }])
      .mockResolvedValueOnce([{ id: "season-id-1" }]);

    const mockOnConflictDoNothing = vi.fn().mockResolvedValue(undefined);
    const mockOnConflictDoUpdate = vi.fn().mockReturnValue({
      returning: mockReturning,
      then: (cb: any) => Promise.resolve([{ id: "fake-id" }]).then(cb),
    });

    const mockValues = vi.fn().mockImplementation(() => ({
      onConflictDoUpdate: mockOnConflictDoUpdate,
      onConflictDoNothing: mockOnConflictDoNothing,
    }));

    const mockInsert = vi.fn().mockReturnValue({
      values: mockValues,
    });

    const mockTx = {
      insert: mockInsert,
      delete: mockDelete,
    };

    const mockDb = {
      transaction: vi.fn(async (cb) => cb(mockTx)),
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              catch: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      }),
    } as any;

    const data = {
      tmdbId: 500,
      type: "movie" as const,
      title: "Inception",
      description: "Dream inside dream",
      posterPath: "https://image.tmdb.org/t/p/w500/inception.jpg",
      backdropPath: "https://image.tmdb.org/t/p/w500/inception_bg.jpg",
      firstAirDate: "2010-07-16",
      voteAverage: 8.8,
      genres: ["Action"],
      seasons: [
        {
          seasonNumber: 1,
          name: "Inception",
          overview: "Dream inside dream",
          posterPath: "https://image.tmdb.org/t/p/w500/inception.jpg",
          airDate: "2010-07-16",
          episodes: [
            {
              id: 500,
              episode_number: 1,
              name: "Inception",
              overview: "Dream inside dream",
              runtime: 148,
              still_path: "/inception.jpg",
              vote_average: 8.8,
              air_date: "2010-07-16",
            },
          ],
        },
      ],
    };

    const result = await saveTmdbSeries(mockDb, data);

    expect(mockDb.transaction).toHaveBeenCalled();

    // Verify 1st insert is series with type 'movie'
    const seriesValues = mockValues.mock.calls[0][0];
    expect(seriesValues.title).toBe("Inception");
    expect(seriesValues.type).toBe("movie");
    expect(seriesValues.tmdbId).toBe(500);

    // Verify 4th insert is season 1
    const seasonValues = mockValues.mock.calls[3][0];
    expect(seasonValues.seasonNumber).toBe(1);

    // Verify 5th insert is episode 1
    const episodeValues = mockValues.mock.calls[4][0];
    expect(episodeValues.order).toBe(1);
    expect(episodeValues.duration).toBe(148);
  });
});

describe("createMediaService syncTmdb", () => {
  it("throws SeriesNotFoundError when target seriesId does not exist", async () => {
    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      }),
    } as any;

    const mediaService = createMediaService(mockDb);

    await expect(
      mediaService.syncTmdb("non-existent-id", { type: "tv", tmdbId: 100 })
    ).rejects.toThrow(SeriesNotFoundError);
  });

  it("updates series metadata, genres, upserts seasons and episodes in transaction", async () => {
    const seriesId = "existing-series-id";

    const mockSeriesRow = {
      id: seriesId,
      title: "Old Title",
      description: "Old Description",
      type: "tv",
      posterUrl: null,
      backdropUrl: null,
      rating: null,
      tmdbId: 100,
      tmdbSyncStatus: "PENDING",
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
    };

    const mockUpdatedSeriesRow = {
      ...mockSeriesRow,
      title: "Updated TMDB Title",
      description: "Updated TMDB Description",
      tmdbSyncStatus: "SYNCED",
    };

    const mockWhere = vi.fn().mockResolvedValue(undefined);
    const mockDelete = vi.fn().mockReturnValue({ where: mockWhere });

    const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
    const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });

    const mockReturning = vi
      .fn()
      .mockResolvedValueOnce([{ id: "genre-id-1" }])
      .mockResolvedValueOnce([{ id: "season-id-1", seasonNumber: 1 }]);

    const mockOnConflictDoNothing = vi.fn().mockResolvedValue(undefined);
    const mockOnConflictDoUpdate = vi.fn().mockReturnValue({
      returning: mockReturning,
      then: (cb: any) => Promise.resolve([{ id: "ep-id-1" }]).then(cb),
    });

    const mockValues = vi.fn().mockImplementation(() => ({
      onConflictDoUpdate: mockOnConflictDoUpdate,
      onConflictDoNothing: mockOnConflictDoNothing,
    }));

    const mockInsert = vi.fn().mockReturnValue({
      values: mockValues,
    });

    const mockTx = {
      update: mockUpdate,
      insert: mockInsert,
      delete: mockDelete,
    };

    const mockDb = {
      select: vi.fn().mockImplementation(() => {
        return {
          from: vi.fn().mockImplementation((table: any) => {
            return {
              innerJoin: vi.fn().mockReturnThis(),
              where: vi.fn().mockImplementation(() => {
                const promise = Promise.resolve([mockSeriesRow]);
                (promise as any).orderBy = vi.fn().mockResolvedValue([]);
                return promise;
              }),
              orderBy: vi.fn().mockImplementation(() => {
                return Promise.resolve([]);
              }),
            };
          }),
        };
      }),
      transaction: vi.fn(async (cb: any) => cb(mockTx)),
    } as any;

    process.env.TMDB_API_KEY = "test-key";
    const mockFetchFn = vi.fn().mockImplementation((url: string) => {
      if (url === "https://api.themoviedb.org/3/tv/100") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              id: 100,
              name: "Updated TMDB Title",
              overview: "Updated TMDB Description",
              poster_path: "/poster.jpg",
              backdrop_path: "/backdrop.jpg",
              vote_average: 8.5,
              genres: [{ id: 1, name: "Action" }],
              seasons: [{ season_number: 1, name: "Season 1", episode_count: 1 }],
            }),
            { status: 200 }
          )
        );
      }
      if (url === "https://api.themoviedb.org/3/tv/100/season/1") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              season_number: 1,
              name: "Season 1",
              episodes: [
                {
                  episode_number: 1,
                  name: "Episode 1",
                  overview: "Ep 1 description",
                },
              ],
            }),
            { status: 200 }
          )
        );
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });

    vi.spyOn(global, "fetch").mockImplementation(mockFetchFn as any);

    const mediaService = createMediaService(mockDb);
    const result = await mediaService.syncTmdb(seriesId, {
      type: "tv",
      tmdbId: 100,
    });

    expect(mockDb.transaction).toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalled();
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Updated TMDB Title",
        description: "Updated TMDB Description",
        tmdbSyncStatus: "SYNCED",
      })
    );
    expect(result).toBeDefined();
  });
});

describe("createMediaService getTmdbSyncPreview", () => {
  it("throws SeriesNotFoundError when series does not exist", async () => {
    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      }),
    } as any;

    const mediaService = createMediaService(mockDb);

    await expect(
      mediaService.getTmdbSyncPreview("non-existent-id", { type: "tv", tmdbId: 100 })
    ).rejects.toThrow(SeriesNotFoundError);
  });

  it("calculates diffs, flags modified episode titles/overviews/thumbnails, and computes new episodes", async () => {
    const seriesId = "series-diff-1";

    const mockSeriesRow = {
      id: seriesId,
      title: "Local Title",
      description: "Old Local Description",
      type: "tv",
      posterUrl: "https://image.tmdb.org/t/p/w500/old_poster.jpg",
      backdropUrl: null,
      rating: "7.0",
      tmdbId: 100,
      tmdbSyncStatus: "SYNCED",
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
    };

    const mockSeasonRow = {
      id: "season-1",
      seriesId,
      seasonNumber: 1,
      title: "Season 1",
      description: "Season 1 desc",
      posterUrl: null,
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
    };

    const mockEpisodeRow = {
      id: "ep-1",
      seasonId: "season-1",
      order: 1,
      title: "Old Episode Title",
      description: "Old Episode Overview",
      thumbnailUrl: "https://image.tmdb.org/t/p/w500/old_ep1.jpg",
      rating: "8.0",
      airDate: "2021-01-01",
      duration: 45,
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
    };

    const mockDb = {
      select: vi.fn().mockImplementation(() => {
        return {
          from: vi.fn().mockImplementation((table: any) => {
            return {
              innerJoin: vi.fn().mockReturnThis(),
              where: vi.fn().mockImplementation(() => {
                const promise = Promise.resolve([mockSeriesRow]);
                (promise as any).orderBy = vi.fn().mockImplementation(() => {
                  const tableName = table?.[Symbol.for("drizzle:Name")] || table?.name || table?._?.name;
                  if (tableName === "seasons") {
                    return Promise.resolve([mockSeasonRow]);
                  }
                  if (tableName === "episodes") {
                    return Promise.resolve([mockEpisodeRow]);
                  }
                  return Promise.resolve([]);
                });
                return promise;
              }),
              orderBy: vi.fn().mockImplementation(() => {
                return Promise.resolve([]);
              }),
            };
          }),
        };
      }),
    } as any;

    process.env.TMDB_API_KEY = "test-key";
    const mockFetchFn = vi.fn().mockImplementation((url: string) => {
      if (url === "https://api.themoviedb.org/3/tv/100") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              id: 100,
              name: "New TMDB Title",
              overview: "New TMDB Description",
              poster_path: "/new_poster.jpg",
              backdrop_path: "/new_backdrop.jpg",
              first_air_date: "2021-01-01",
              vote_average: 8.5,
              genres: [{ id: 1, name: "Drama" }],
              seasons: [
                { id: 11, season_number: 1, name: "Season 1", episode_count: 2 },
                { id: 12, season_number: 2, name: "Season 2", episode_count: 5 },
              ],
            }),
            { status: 200 }
          )
        );
      }

      if (url === "https://api.themoviedb.org/3/tv/100/season/1") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              id: 11,
              season_number: 1,
              name: "Season 1",
              episodes: [
                {
                  episode_number: 1,
                  name: "Updated Episode Title",
                  overview: "Updated Episode Overview",
                  still_path: "/new_ep1.jpg",
                  air_date: "2021-01-01",
                },
                {
                  episode_number: 2,
                  name: "Episode 2 (Brand New)",
                  overview: "Brand new ep overview",
                  still_path: "/new_ep2.jpg",
                  air_date: "2021-01-08",
                },
              ],
            }),
            { status: 200 }
          )
        );
      }

      if (url === "https://api.themoviedb.org/3/tv/100/season/2") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              id: 12,
              season_number: 2,
              name: "Season 2",
              episodes: [
                {
                  episode_number: 1,
                  name: "S2 Episode 1",
                  overview: "S2 Ep 1",
                  still_path: null,
                  air_date: "2022-01-01",
                },
              ],
            }),
            { status: 200 }
          )
        );
      }

      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });

    vi.spyOn(global, "fetch").mockImplementation(mockFetchFn as any);

    const mediaService = createMediaService(mockDb);
    const preview = await mediaService.getTmdbSyncPreview(seriesId, {
      type: "tv",
      tmdbId: 100,
    });

    expect(preview.seriesId).toBe(seriesId);
    expect(preview.seriesUpdated).toBe(true);
    expect(preview.series.title).toBe("New TMDB Title");
    expect(preview.series.overview).toBe("New TMDB Description");
    expect(preview.series.rating).toBe("8.5");

    // Season diffs
    expect(preview.totalNewSeasons).toBe(1); // Season 2 is new
    expect(preview.totalNewEpisodes).toBe(2); // 1 new ep in S1, 1 new ep in S2
    expect(preview.seasonDiffs).toHaveLength(2);

    // Episode changes
    expect(preview.totalUpdatedEpisodes).toBe(1);
    expect(preview.episodeChanges).toHaveLength(1);
    expect(preview.episodeChanges[0]).toEqual(
      expect.objectContaining({
        seasonNumber: 1,
        episodeNumber: 1,
        oldTitle: "Old Episode Title",
        newTitle: "Updated Episode Title",
        oldOverview: "Old Episode Overview",
        newOverview: "Updated Episode Overview",
        oldThumbnailUrl: "https://image.tmdb.org/t/p/w500/old_ep1.jpg",
        newThumbnailUrl: "https://image.tmdb.org/t/p/w500/new_ep1.jpg",
        titleChanged: true,
        overviewChanged: true,
        thumbnailChanged: true,
      })
    );
  });
});
