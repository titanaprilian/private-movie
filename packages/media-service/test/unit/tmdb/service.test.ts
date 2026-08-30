import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchTmdbSeriesData,
  saveTmdbSeries,
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
