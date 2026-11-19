import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchTmdbSeriesData,
  getTmdbPreview,
  selectBestTmdbLogo,
  TmdbFetchError,
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
      backdropPath: "https://image.tmdb.org/t/p/original/tv_backdrop.jpg",
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
      backdropPath: "https://image.tmdb.org/t/p/original/inception_bg.jpg",
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
          genres: [
            { id: 1, name: "Drama" },
            { id: 2, name: "Action" },
          ],
          seasons: [
            {
              id: 10,
              season_number: 0,
              name: "Specials",
              episode_count: 5,
              poster_path: "/s0.jpg",
            },
            {
              id: 11,
              season_number: 1,
              name: "Season 1",
              episode_count: 10,
              poster_path: "/s1.jpg",
            },
            {
              id: 12,
              season_number: 2,
              name: "Season 2",
              episode_count: 12,
              poster_path: "/s2.jpg",
            },
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
      backdropUrl: "https://image.tmdb.org/t/p/original/tv_backdrop.jpg",
      logoUrl: null,
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
            {
              id: 10,
              season_number: 0,
              name: "Specials",
              episode_count: 5,
              poster_path: "/s0.jpg",
            },
            {
              id: 11,
              season_number: 1,
              name: "Season 1",
              episode_count: 10,
              poster_path: "/s1.jpg",
            },
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
      backdropUrl: "https://image.tmdb.org/t/p/original/inception_bg.jpg",
      logoUrl: null,
      releaseDate: "2010-07-16",
      genres: ["Action", "Sci-Fi"],
      runtime: 148,
    });
  });

  it("throws TmdbFetchError with status 404 when TMDB returns 404", async () => {
    mockFetchFn.mockRejectedValue(
      new TmdbFetchError("TMDB API Error: 404 Not Found", 404),
    );

    await expect(
      getTmdbPreview(999999, {
        type: "movie",
        token: "test-token",
        fetchFn: mockFetchFn,
      }),
    ).rejects.toThrow(TmdbFetchError);
  });
});

describe("selectBestTmdbLogo", () => {
  it("returns null when logos array is empty or undefined", () => {
    expect(selectBestTmdbLogo(undefined)).toBeNull();
    expect(selectBestTmdbLogo([])).toBeNull();
  });

  it("selects highest-rated English logo when available", () => {
    const logos = [
      { file_path: "/ja_logo.png", vote_average: 9.5, iso_639_1: "ja" },
      { file_path: "/en_logo_low.png", vote_average: 4.0, iso_639_1: "en" },
      { file_path: "/en_logo_high.png", vote_average: 8.5, iso_639_1: "en-US" },
    ];
    expect(selectBestTmdbLogo(logos)).toBe(
      "https://image.tmdb.org/t/p/w500/en_logo_high.png",
    );
  });

  it("falls back to highest-rated non-English logo when no English logos exist", () => {
    const logos = [
      { file_path: "/fr_logo.png", vote_average: 6.0, iso_639_1: "fr" },
      { file_path: "/ja_logo.png", vote_average: 9.0, iso_639_1: "ja" },
    ];
    expect(selectBestTmdbLogo(logos)).toBe(
      "https://image.tmdb.org/t/p/w500/ja_logo.png",
    );
  });
});
