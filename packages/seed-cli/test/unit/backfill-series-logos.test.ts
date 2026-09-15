import { describe, it, expect, vi, beforeEach } from "vitest";
import { backfillSeriesLogos } from "../../src/backfill-series-logos";

describe("backfillSeriesLogos", () => {
  const logs: string[] = [];
  const mockLog = (msg: string) => logs.push(msg);
  const mockSleep = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    logs.length = 0;
  });

  it("throws error if TMDB token/API key is missing and default fetchFn is used", async () => {
    const origKey = process.env.TMDB_API_KEY;
    const origToken = process.env.TMDB_TOKEN;
    delete process.env.TMDB_API_KEY;
    delete process.env.TMDB_TOKEN;

    try {
      await expect(
        backfillSeriesLogos({
          logFn: mockLog,
          sleepFn: mockSleep,
          deps: {
            findSeriesWithoutLogo: vi.fn().mockResolvedValue([]),
          },
        })
      ).rejects.toThrow("Missing TMDB_API_KEY environment variable");
    } finally {
      if (origKey) process.env.TMDB_API_KEY = origKey;
      if (origToken) process.env.TMDB_TOKEN = origToken;
    }
  });

  it("handles case where no series need logo backfill", async () => {
    const mockFindSeries = vi.fn().mockResolvedValue([]);
    const mockUpdateLogo = vi.fn();

    const summary = await backfillSeriesLogos({
      apiKey: "test-token",
      logFn: mockLog,
      sleepFn: mockSleep,
      deps: {
        findSeriesWithoutLogo: mockFindSeries,
        updateSeriesLogo: mockUpdateLogo,
      },
    });

    expect(mockFindSeries).toHaveBeenCalledTimes(1);
    expect(mockUpdateLogo).not.toHaveBeenCalled();
    expect(summary).toEqual({
      totalSeries: 0,
      updatedCount: 0,
      skippedCount: 0,
      failedCount: 0,
    });
    expect(logs.some((l) => l.includes("No series found requiring logo backfill."))).toBe(true);
  });

  it("queries TMDB images for TV and Movie, resolves best English logo, and updates database", async () => {
    const mockFindSeries = vi.fn().mockResolvedValue([
      { id: "series-1", title: "Breaking Bad", tmdbId: 1396, type: "tv" },
      { id: "series-2", title: "Inception", tmdbId: 27205, type: "movie" },
      { id: "series-3", title: "No Logo Show", tmdbId: 99999, type: "tv" },
    ]);

    const mockFetchFn = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/tv/1396/images")) {
        return Promise.resolve({
          logos: [
            { file_path: "/es_logo.png", iso_639_1: "es", vote_average: 9.0 },
            { file_path: "/en_logo_low.png", iso_639_1: "en", vote_average: 4.5 },
            { file_path: "/en_logo_high.png", iso_639_1: "en", vote_average: 8.5 },
          ],
        });
      }
      if (url.includes("/movie/27205/images")) {
        return Promise.resolve({
          logos: [
            { file_path: "/inception_logo.png", iso_639_1: "en-US", vote_average: 9.5 },
          ],
        });
      }
      if (url.includes("/tv/99999/images")) {
        return Promise.resolve({
          logos: [],
        });
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });

    const mockUpdateLogo = vi.fn().mockResolvedValue(true);

    const summary = await backfillSeriesLogos({
      apiKey: "test-token",
      fetchFn: mockFetchFn,
      logFn: mockLog,
      sleepFn: mockSleep,
      deps: {
        findSeriesWithoutLogo: mockFindSeries,
        updateSeriesLogo: mockUpdateLogo,
      },
    });

    expect(mockFetchFn).toHaveBeenCalledWith(
      "https://api.themoviedb.org/3/tv/1396/images?include_image_language=en-US,en,null",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer test-token",
          accept: "application/json",
        }),
      })
    );

    expect(mockFetchFn).toHaveBeenCalledWith(
      "https://api.themoviedb.org/3/movie/27205/images?include_image_language=en-US,en,null",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer test-token",
          accept: "application/json",
        }),
      })
    );

    expect(mockUpdateLogo).toHaveBeenCalledTimes(2);
    expect(mockUpdateLogo).toHaveBeenCalledWith("series-1", "https://image.tmdb.org/t/p/w500/en_logo_high.png");
    expect(mockUpdateLogo).toHaveBeenCalledWith("series-2", "https://image.tmdb.org/t/p/w500/inception_logo.png");

    expect(summary).toEqual({
      totalSeries: 3,
      updatedCount: 2,
      skippedCount: 1,
      failedCount: 0,
    });
  });

  it("handles exponential backoff retry on HTTP 429", async () => {
    const mockFindSeries = vi.fn().mockResolvedValue([
      { id: "series-rate-limit", title: "Rate Limit Show", tmdbId: 1000, type: "tv" },
    ]);

    let attempt = 0;
    const mockFetchFn = vi.fn().mockImplementation(() => {
      attempt++;
      if (attempt === 1) {
        return Promise.resolve({
          status: 429,
          headers: { "retry-after": "1" },
        });
      }
      return Promise.resolve({
        logos: [{ file_path: "/rate_limit_logo.png", iso_639_1: "en", vote_average: 8.0 }],
      });
    });

    const mockUpdateLogo = vi.fn().mockResolvedValue(true);

    const summary = await backfillSeriesLogos({
      apiKey: "test-token",
      fetchFn: mockFetchFn,
      logFn: mockLog,
      sleepFn: mockSleep,
      deps: {
        findSeriesWithoutLogo: mockFindSeries,
        updateSeriesLogo: mockUpdateLogo,
      },
    });

    expect(mockSleep).toHaveBeenCalledWith(1000);
    expect(mockUpdateLogo).toHaveBeenCalledWith(
      "series-rate-limit",
      "https://image.tmdb.org/t/p/w500/rate_limit_logo.png"
    );
    expect(summary.updatedCount).toBe(1);
    expect(logs.some((l) => l.includes("TMDB rate limit hit (429)"))).toBe(true);
  });

  it("handles TMDB fetch failure for individual series gracefully without aborting remaining", async () => {
    const mockFindSeries = vi.fn().mockResolvedValue([
      { id: "s-fail", title: "Broken Show", tmdbId: 40404, type: "tv" },
      { id: "s-ok", title: "Working Show", tmdbId: 50505, type: "tv" },
    ]);

    const mockFetchFn = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/tv/40404/images")) {
        return Promise.reject(new Error("TMDB 500 Server Error"));
      }
      return Promise.resolve({
        logos: [{ file_path: "/working.png", iso_639_1: "en", vote_average: 7.5 }],
      });
    });

    const mockUpdateLogo = vi.fn().mockResolvedValue(true);

    const summary = await backfillSeriesLogos({
      apiKey: "test-token",
      fetchFn: mockFetchFn,
      logFn: mockLog,
      sleepFn: mockSleep,
      deps: {
        findSeriesWithoutLogo: mockFindSeries,
        updateSeriesLogo: mockUpdateLogo,
      },
    });

    expect(summary).toEqual({
      totalSeries: 2,
      updatedCount: 1,
      skippedCount: 0,
      failedCount: 1,
    });
    expect(mockUpdateLogo).toHaveBeenCalledTimes(1);
    expect(mockUpdateLogo).toHaveBeenCalledWith("s-ok", "https://image.tmdb.org/t/p/w500/working.png");
  });

  it("findSeriesWithoutLogo default implementation queries database for non-null tmdbId and null logoUrl", async () => {
    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([
        { id: "s-db", title: "DB Show", tmdbId: 1234, type: "tv", logoUrl: null },
      ]),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
    } as any;

    const mockFetchFn = vi.fn().mockResolvedValue({
      logos: [{ file_path: "/db_logo.png", iso_639_1: "en", vote_average: 6.0 }],
    });

    const summary = await backfillSeriesLogos({
      db: mockDb,
      apiKey: "test-token",
      fetchFn: mockFetchFn,
      logFn: mockLog,
      sleepFn: mockSleep,
    });

    expect(mockDb.select).toHaveBeenCalled();
    expect(mockDb.from).toHaveBeenCalled();
    expect(mockDb.where).toHaveBeenCalled();
    expect(mockDb.update).toHaveBeenCalled();
    expect(mockDb.set).toHaveBeenCalled();
    expect(summary.updatedCount).toBe(1);
  });
});
