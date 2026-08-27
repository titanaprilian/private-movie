import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  parseTmdbIdsContent,
  parseTmdbIdsFile,
  fetchTmdbSeriesData,
  seedTmdb,
  DEFAULT_TMDB_IDS_PATH,
} from "../../src/seed-tmdb";

describe("seed-tmdb parsing", () => {
  it("parses valid newline-separated TMDB IDs, trimming whitespace and ignoring empty lines or comments", () => {
    const rawContent = `
      # Popular Anime Series
      95479
      31911 # Fullmetal Alchemist: Brotherhood

      # More shows
      1399
      invalid_id
      0
    `;
    const ids = parseTmdbIdsContent(rawContent);
    expect(ids).toEqual([95479, 31911, 1399]);
  });

  it("reads and parses TMDB IDs from file system using parseTmdbIdsFile", () => {
    const spyExists = vi.spyOn(fs, "existsSync").mockReturnValue(true);
    const spyRead = vi.spyOn(fs, "readFileSync").mockReturnValue("95479\n31911\n");

    const ids = parseTmdbIdsFile("/dummy/tmdb-ids.txt");
    expect(ids).toEqual([95479, 31911]);

    spyExists.mockRestore();
    spyRead.mockRestore();
  });

  it("throws Error if specified file path does not exist", () => {
    const spyExists = vi.spyOn(fs, "existsSync").mockReturnValue(false);

    expect(() => parseTmdbIdsFile("/missing/file.txt")).toThrow("TMDB IDs file not found at /missing/file.txt");

    spyExists.mockRestore();
  });
});

describe("seed-tmdb fetchTmdbSeriesData", () => {
  const mockFetchFn = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches series root metadata /3/tv/{id} and iteratively fetches seasons /3/tv/{id}/season/{season_number}", async () => {
    mockFetchFn.mockImplementation((url: string) => {
      if (url === "https://api.themoviedb.org/3/tv/95479") {
        return Promise.resolve({
          id: 95479,
          name: "Jujutsu Kaisen",
          overview: "A boy swallows a cursed finger...",
          poster_path: "/jujutsu.jpg",
          backdrop_path: "/jujutsu_bg.jpg",
          first_air_date: "2020-10-03",
          vote_average: 8.5,
          genres: [
            { id: 16, name: "Animation" },
            { id: 10759, name: "Action & Adventure" },
          ],
          seasons: [
            { id: 100, season_number: 0, name: "Specials", episode_count: 2 },
            { id: 101, season_number: 1, name: "Season 1", episode_count: 24 },
            { id: 102, season_number: 2, name: "Season 2", episode_count: 23 },
          ],
        });
      }

      if (url === "https://api.themoviedb.org/3/tv/95479/season/1") {
        return Promise.resolve({
          id: 101,
          season_number: 1,
          name: "Season 1",
          overview: "First season overview",
          poster_path: "/season1.jpg",
          air_date: "2020-10-03",
          episodes: [
            {
              id: 2001,
              episode_number: 1,
              name: "Ryomen Sukuna",
              overview: "Yuji Itadori...",
              runtime: 24,
              still_path: "/ep1.jpg",
              vote_average: 8.4,
              air_date: "2020-10-03",
            },
          ],
        });
      }

      if (url === "https://api.themoviedb.org/3/tv/95479/season/2") {
        return Promise.resolve({
          id: 102,
          season_number: 2,
          name: "Season 2",
          overview: "Hidden Inventory Arc",
          poster_path: "/season2.jpg",
          air_date: "2023-07-06",
          episodes: [
            {
              id: 2002,
              episode_number: 1,
              name: "Hidden Inventory",
              overview: "Gojo and Geto...",
              runtime: 24,
              still_path: "/ep2_1.jpg",
              vote_average: 8.9,
              air_date: "2023-07-06",
            },
          ],
        });
      }

      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });

    const seriesData = await fetchTmdbSeriesData(95479, {
      token: "test-tmdb-token",
      fetchFn: mockFetchFn,
    });

    expect(mockFetchFn).toHaveBeenCalledWith("https://api.themoviedb.org/3/tv/95479", {
      headers: {
        Authorization: "Bearer test-tmdb-token",
        accept: "application/json",
      },
    });

    expect(mockFetchFn).toHaveBeenCalledWith("https://api.themoviedb.org/3/tv/95479/season/1", {
      headers: {
        Authorization: "Bearer test-tmdb-token",
        accept: "application/json",
      },
    });

    expect(mockFetchFn).toHaveBeenCalledWith("https://api.themoviedb.org/3/tv/95479/season/2", {
      headers: {
        Authorization: "Bearer test-tmdb-token",
        accept: "application/json",
      },
    });

    // By default specials (season 0) are excluded
    expect(seriesData).toMatchObject({
      tmdbId: 95479,
      title: "Jujutsu Kaisen",
      description: "A boy swallows a cursed finger...",
      posterPath: "https://image.tmdb.org/t/p/w500/jujutsu.jpg",
      backdropPath: "https://image.tmdb.org/t/p/w500/jujutsu_bg.jpg",
      firstAirDate: "2020-10-03",
      voteAverage: 8.5,
      genres: ["Animation", "Action & Adventure"],
    });

    expect(seriesData.seasons).toHaveLength(2);
    expect(seriesData.seasons[0].seasonNumber).toBe(1);
    expect(seriesData.seasons[0].episodes).toHaveLength(1);
    expect(seriesData.seasons[0].episodes[0].episode_number).toBe(1);
    expect(seriesData.seasons[1].seasonNumber).toBe(2);
  });
});

describe("seedTmdb pipeline orchestrator", () => {
  const logs: string[] = [];
  const mockLog = (msg: string) => logs.push(msg);
  const mockSleep = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    logs.length = 0;
  });

  it("throws error if TMDB_TOKEN is missing and no token/fetchFn provided", async () => {
    const origToken = process.env.TMDB_TOKEN;
    const origApiKey = process.env.TMDB_API_KEY;
    delete process.env.TMDB_TOKEN;
    delete process.env.TMDB_API_KEY;

    try {
      await expect(
        seedTmdb({
          tmdbIds: [95479],
          logFn: mockLog,
          sleepFn: mockSleep,
        })
      ).rejects.toThrow("Missing TMDB_TOKEN environment variable");
    } finally {
      if (origToken) process.env.TMDB_TOKEN = origToken;
      if (origApiKey) process.env.TMDB_API_KEY = origApiKey;
    }
  });

  it("authenticates using TMDB_TOKEN from environment when token option is omitted", async () => {
    const origToken = process.env.TMDB_TOKEN;
    process.env.TMDB_TOKEN = "env-token-12345";

    const mockFetchFn = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith("/95479")) {
        return Promise.resolve({
          id: 95479,
          name: "Test Show",
          seasons: [],
        });
      }
      return Promise.resolve({});
    });

    try {
      await seedTmdb({
        tmdbIds: [95479],
        fetchFn: mockFetchFn,
        logFn: mockLog,
        sleepFn: mockSleep,
      });

      expect(mockFetchFn).toHaveBeenCalledWith("https://api.themoviedb.org/3/tv/95479", {
        headers: {
          Authorization: "Bearer env-token-12345",
          accept: "application/json",
        },
      });
    } finally {
      if (origToken) process.env.TMDB_TOKEN = origToken;
      else delete process.env.TMDB_TOKEN;
    }
  });

  it("sequentially processes TMDB IDs, invoking onSeriesFetched callback for each series", async () => {
    const mockFetchFn = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/3/tv/95479")) {
        if (url.includes("/season/1")) {
          return Promise.resolve({ season_number: 1, episodes: [] });
        }
        return Promise.resolve({
          id: 95479,
          name: "Jujutsu Kaisen",
          seasons: [{ season_number: 1 }],
        });
      }
      if (url.includes("/3/tv/31911")) {
        if (url.includes("/season/1")) {
          return Promise.resolve({ season_number: 1, episodes: [] });
        }
        return Promise.resolve({
          id: 31911,
          name: "Fullmetal Alchemist",
          seasons: [{ season_number: 1 }],
        });
      }
      return Promise.resolve({});
    });

    const mockOnSeriesFetched = vi.fn().mockResolvedValue(undefined);

    const result = await seedTmdb({
      tmdbIds: [95479, 31911],
      token: "test-token",
      fetchFn: mockFetchFn,
      logFn: mockLog,
      sleepFn: mockSleep,
      onSeriesFetched: mockOnSeriesFetched,
    });

    expect(result.totalIds).toBe(2);
    expect(result.processedSeriesCount).toBe(2);
    expect(result.failedSeriesCount).toBe(0);
    expect(mockOnSeriesFetched).toHaveBeenCalledTimes(2);
    expect(mockOnSeriesFetched.mock.calls[0][0].title).toBe("Jujutsu Kaisen");
    expect(mockOnSeriesFetched.mock.calls[1][0].title).toBe("Fullmetal Alchemist");
  });

  it("handles fetch errors gracefully, logging and continuing to next ID", async () => {
    const mockFetchFn = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/3/tv/99999")) {
        return Promise.reject(new Error("TMDB API 404 Not Found"));
      }
      if (url.includes("/3/tv/95479")) {
        return Promise.resolve({
          id: 95479,
          name: "Jujutsu Kaisen",
          seasons: [],
        });
      }
      return Promise.resolve({});
    });

    const result = await seedTmdb({
      tmdbIds: [99999, 95479],
      token: "test-token",
      fetchFn: mockFetchFn,
      logFn: mockLog,
      sleepFn: mockSleep,
    });

    expect(result.totalIds).toBe(2);
    expect(result.processedSeriesCount).toBe(1);
    expect(result.failedSeriesCount).toBe(1);
    expect(logs.some((l) => l.includes("Error processing TMDB ID 99999"))).toBe(true);
  });
});

describe("saveTmdbSeries database upserts", () => {
  it("inserts or updates series, seasons, and episodes within a transaction", async () => {
    const mockReturning = vi.fn().mockResolvedValue([{ id: "fake-id" }]);
    const mockOnConflictDoUpdate = vi.fn().mockReturnValue({
      returning: mockReturning,
      then: (cb: any) => Promise.resolve([{ id: "fake-id" }]).then(cb)
    });
    const mockValues = vi.fn().mockReturnValue({
      onConflictDoUpdate: mockOnConflictDoUpdate,
    });
    const mockInsert = vi.fn().mockReturnValue({
      values: mockValues,
    });
    const mockTx = { insert: mockInsert };
    const mockDb = {
      transaction: vi.fn(async (cb) => cb(mockTx)),
    } as any;

    const data = {
      tmdbId: 100,
      title: "Test Show",
      description: "Test DESC",
      posterPath: "/poster.jpg",
      backdropPath: "/bg.jpg",
      firstAirDate: "2020-01-01",
      voteAverage: 8.5,
      genres: ["Action"],
      seasons: [
        {
          seasonNumber: 1,
          name: "S1",
          overview: "S1 DESC",
          posterPath: "/s1.jpg",
          airDate: "2020-01-01",
          episodes: [
            {
              id: 1001,
              episode_number: 1,
              name: "Ep1",
              overview: "Ep1 DESC",
              runtime: 24,
              still_path: "/ep1.jpg",
              vote_average: 8.0,
              air_date: "2020-01-01",
            },
          ],
        },
      ],
    } as any;

    const { saveTmdbSeries } = await import("../../src/seed-tmdb");
    
    await saveTmdbSeries(mockDb, data);

    expect(mockDb.transaction).toHaveBeenCalled();
    // 1 series, 1 season, 1 episode = 3 inserts
    expect(mockInsert).toHaveBeenCalledTimes(3);

    // Verify first insert is for series
    const seriesValues = mockValues.mock.calls[0][0];
    expect(seriesValues.title).toBe("Test Show");
    expect(seriesValues.tmdbId).toBe(100);
    expect(seriesValues.type).toBe("tv");
    
    expect(mockOnConflictDoUpdate.mock.calls[0][0].set.title).toBe("Test Show");

    // Verify second insert is for season
    const seasonValues = mockValues.mock.calls[1][0];
    expect(seasonValues.seasonNumber).toBe(1);
    expect(seasonValues.title).toBe("S1");
    // Should link to series
    expect(seasonValues.seriesId).toBe("fake-id");

    // Verify third insert is for episode
    const episodeValues = mockValues.mock.calls[2][0];
    expect(episodeValues.order).toBe(1);
    expect(episodeValues.title).toBe("Ep1");
    expect(episodeValues.thumbnailUrl).toBe("https://image.tmdb.org/t/p/w500/ep1.jpg");
    // Should link to season
    expect(episodeValues.seasonId).toBe("fake-id");
  });
});
