import { describe, it, expect, vi, beforeEach } from "vitest";
import { syncTmdbEpisodes } from "../../src/sync-tmdb-episodes";

describe("syncTmdbEpisodes", () => {
  const logs: string[] = [];
  const mockLog = (msg: string) => logs.push(msg);
  const mockSleep = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    logs.length = 0;
  });

  it("throws error if TMDB_API_KEY is missing and default fetchFn is used without options.apiKey", async () => {
    const origKey = process.env.TMDB_API_KEY;
    delete process.env.TMDB_API_KEY;

    try {
      await expect(
        syncTmdbEpisodes({
          logFn: mockLog,
          sleepFn: mockSleep,
          deps: {
            findSeasons: vi.fn().mockResolvedValue([]),
          },
        })
      ).rejects.toThrow("Missing TMDB_API_KEY environment variable");
    } finally {
      if (origKey) process.env.TMDB_API_KEY = origKey;
    }
  });

  it("bypasses seasons without tmdbId or tmdbSeason", async () => {
    const mockFindSeasons = vi.fn().mockResolvedValue([
      { id: "s-1", title: "Season 1", tmdbId: null, tmdbSeason: 1 },
      { id: "s-2", title: "Season 2", tmdbId: 100, tmdbSeason: null },
      { id: "s-3", title: "Season 3", tmdbId: null, tmdbSeason: null },
    ]);
    const mockUpsertEpisodes = vi.fn();

    await syncTmdbEpisodes({
      apiKey: "test-api-key",
      logFn: mockLog,
      sleepFn: mockSleep,
      deps: {
        findSeasons: mockFindSeasons,
        upsertEpisodes: mockUpsertEpisodes,
      },
    });

    expect(mockFindSeasons).toHaveBeenCalled();
    expect(mockUpsertEpisodes).not.toHaveBeenCalled();
    expect(logs.some((l) => l.includes("No eligible seasons found with valid TMDB ID and TMDB Season"))).toBe(true);
  });

  it("queries /3/tv/{id}/season/{season_number}, transforms TMDB episodes and performs batch upsert", async () => {
    const mockFindSeasons = vi.fn().mockResolvedValue([
      { id: "season-101", title: "Jujutsu Kaisen Season 1", tmdbId: 95479, tmdbSeason: 1 },
    ]);

    const mockFetchFn = vi.fn().mockImplementation((url: string) => {
      expect(url).toContain("/3/tv/95479/season/1");
      return Promise.resolve({
        episodes: [
          {
            id: 2001,
            episode_number: 1,
            name: "Ryomen Sukuna",
            overview: "Yuji Itadori is a boy with tremendous physical strength...",
            runtime: 24,
            still_path: "/sukuna.jpg",
            vote_average: 8.4,
            air_date: "2020-10-03",
          },
          {
            id: 2002,
            episode_number: 2,
            name: "For Myself",
            overview: "Yuji awakes in a strange room...",
            runtime: 24,
            still_path: "/for_myself.jpg",
            vote_average: 8.6,
            air_date: "2020-10-10",
          },
        ],
      });
    });

    const mockUpsertEpisodes = vi.fn().mockResolvedValue(2);

    await syncTmdbEpisodes({
      apiKey: "test-key",
      fetchFn: mockFetchFn,
      logFn: mockLog,
      sleepFn: mockSleep,
      deps: {
        findSeasons: mockFindSeasons,
        upsertEpisodes: mockUpsertEpisodes,
      },
    });

    expect(mockFetchFn).toHaveBeenCalledWith("https://api.themoviedb.org/3/tv/95479/season/1", {
      headers: {
        Authorization: "Bearer test-key",
        accept: "application/json",
      },
    });

    expect(mockUpsertEpisodes).toHaveBeenCalledTimes(1);
    const [seasonId, transformedEpisodes] = mockUpsertEpisodes.mock.calls[0];

    expect(seasonId).toBe("season-101");
    expect(transformedEpisodes).toHaveLength(2);

    expect(transformedEpisodes[0]).toMatchObject({
      seasonId: "season-101",
      order: 1,
      title: "Ryomen Sukuna",
      description: "Yuji Itadori is a boy with tremendous physical strength...",
      duration: 24,
      tmdbId: 2001,
      thumbnailUrl: "https://image.tmdb.org/t/p/w500/sukuna.jpg",
      rating: "8.4",
      airDate: new Date("2020-10-03"),
    });

    expect(transformedEpisodes[1]).toMatchObject({
      seasonId: "season-101",
      order: 2,
      title: "For Myself",
      description: "Yuji awakes in a strange room...",
      duration: 24,
      tmdbId: 2002,
      thumbnailUrl: "https://image.tmdb.org/t/p/w500/for_myself.jpg",
      rating: "8.6",
      airDate: new Date("2020-10-10"),
    });

    expect(logs.some((l) => l.includes("Upserted 2 episodes for season"))).toBe(true);
    expect(logs.some((l) => l.includes("TMDB EPISODE SYNC SUMMARY"))).toBe(true);
  });

  it("handles TMDB fetch errors gracefully and logs failed seasons", async () => {
    const mockFindSeasons = vi.fn().mockResolvedValue([
      { id: "s-fail", title: "Failing Season", tmdbId: 99999, tmdbSeason: 1 },
    ]);

    const mockFetchFn = vi.fn().mockRejectedValue(new Error("TMDB API 404 Not Found"));
    const mockUpsertEpisodes = vi.fn();

    await syncTmdbEpisodes({
      apiKey: "test-key",
      fetchFn: mockFetchFn,
      logFn: mockLog,
      sleepFn: mockSleep,
      deps: {
        findSeasons: mockFindSeasons,
        upsertEpisodes: mockUpsertEpisodes,
      },
    });

    expect(mockUpsertEpisodes).not.toHaveBeenCalled();
    expect(logs.some((l) => l.includes("Error processing season s-fail"))).toBe(true);
    expect(logs.some((l) => l.includes("Failed Seasons          : 1"))).toBe(true);
  });

  it("handles episodes with null/missing optional fields correctly", async () => {
    const mockFindSeasons = vi.fn().mockResolvedValue([
      { id: "s-nulls", title: "Null Fields Season", tmdbId: 123, tmdbSeason: 2 },
    ]);

    const mockFetchFn = vi.fn().mockResolvedValue({
      episodes: [
        {
          id: 501,
          episode_number: 5,
          name: "",
          overview: null,
          runtime: null,
          still_path: null,
          vote_average: null,
          air_date: null,
        },
      ],
    });

    const mockUpsertEpisodes = vi.fn().mockResolvedValue(1);

    await syncTmdbEpisodes({
      apiKey: "test-key",
      fetchFn: mockFetchFn,
      logFn: mockLog,
      sleepFn: mockSleep,
      deps: {
        findSeasons: mockFindSeasons,
        upsertEpisodes: mockUpsertEpisodes,
      },
    });

    const [, transformedEpisodes] = mockUpsertEpisodes.mock.calls[0];
    expect(transformedEpisodes[0]).toMatchObject({
      seasonId: "s-nulls",
      order: 5,
      title: "Episode 5",
      description: null,
      duration: null,
      tmdbId: 501,
      thumbnailUrl: null,
      rating: null,
      airDate: null,
    });
  });

  it("findSeasons default implementation joins seasons with series on seriesId to get series.tmdbId", async () => {
    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([
        { id: "season-join", tmdbId: 8888, tmdbSeason: 1, title: "Season Join" },
      ]),
    } as any;

    const mockUpsertEpisodes = vi.fn().mockResolvedValue(1);
    const mockFetchFn = vi.fn().mockResolvedValue({ episodes: [] });

    await syncTmdbEpisodes({
      db: mockDb,
      apiKey: "test-key",
      fetchFn: mockFetchFn,
      logFn: mockLog,
      sleepFn: mockSleep,
      deps: {
        upsertEpisodes: mockUpsertEpisodes,
      },
    });

    expect(mockDb.select).toHaveBeenCalled();
    expect(mockDb.from).toHaveBeenCalled();
    expect(mockDb.innerJoin).toHaveBeenCalled();
    expect(mockDb.where).toHaveBeenCalled();
  });
});
