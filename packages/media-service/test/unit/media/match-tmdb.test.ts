import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMediaService } from "../../../src";

describe("createMediaService matchTmdb genre mapping", () => {
  beforeEach(() => {
    process.env.TMDB_API_KEY = "test-tmdb-key";
    vi.restoreAllMocks();
  });

  it("extracts details.genres, flushes old seriesToGenres, and inserts new genres with onConflictDoUpdate", async () => {
    const mockFetch = vi.spyOn(global, "fetch").mockImplementation(async (input) => {
      const url = input.toString();
      if (url.includes("/tv/100")) {
        return new Response(
          JSON.stringify({
            id: 100,
            name: "Frieren",
            overview: "Elf magician",
            poster_path: "/poster.jpg",
            backdrop_path: "/bg.jpg",
            vote_average: 9.5,
            genres: [
              { id: 1, name: "Action" },
              { id: 2, name: "Fantasy" },
            ],
            seasons: [
              {
                season_number: 1,
                name: "Season 1",
                poster_path: "/s1.jpg",
                overview: "S1 Overview",
              },
            ],
          }),
          { status: 200 }
        );
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    });

    const mockWhereDelete = vi.fn().mockResolvedValue(undefined);
    const mockDelete = vi.fn().mockReturnValue({ where: mockWhereDelete });

    const mockReturning = vi.fn().mockResolvedValue([
      { id: "genre-uuid-1" },
      { id: "genre-uuid-2" },
    ]);
    const mockOnConflictDoNothing = vi.fn().mockResolvedValue(undefined);
    const mockOnConflictDoUpdate = vi.fn().mockReturnValue({
      returning: mockReturning,
    });

    const mockValues = vi.fn().mockImplementation(() => ({
      onConflictDoUpdate: mockOnConflictDoUpdate,
      onConflictDoNothing: mockOnConflictDoNothing,
    }));

    const mockInsert = vi.fn().mockReturnValue({
      values: mockValues,
    });

    const mockWhere = vi.fn().mockImplementation(() => {
      const p = Promise.resolve([
        {
          id: "series-stub-1",
          title: "Frieren Stub",
          tmdbId: null,
          tmdbSyncStatus: "PENDING",
        },
      ]);
      return Object.assign(p, {
        orderBy: vi.fn().mockResolvedValue([]),
        limit: vi.fn().mockResolvedValue([]),
      });
    });

    const mockUpdate = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: "series-stub-1" }]),
          then: (cb: any) => Promise.resolve([{ id: "series-stub-1" }]).then(cb),
        }),
      }),
    });

    const mockTx = {
      insert: mockInsert,
      delete: mockDelete,
      update: mockUpdate,
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: mockWhere,
        }),
      }),
    };

    const mockDb = {
      transaction: vi.fn(async (cb: any) => cb(mockTx)),
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: mockWhere,
        }),
      }),
    } as any;

    const mediaService = createMediaService(mockDb);

    await mediaService.matchTmdb({
      seriesId: "series-stub-1",
      type: "tv",
      tmdbId: 100,
      season: 1,
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockDelete).toHaveBeenCalled();
    expect(mockWhereDelete).toHaveBeenCalled();

    // Verify genre insert called with extracted genre names
    const insertedGenreValues = mockValues.mock.calls[0][0];
    expect(insertedGenreValues).toHaveLength(2);
    expect(insertedGenreValues[0].name).toBe("Action");
    expect(insertedGenreValues[0].slug).toBe("action");
    expect(insertedGenreValues[1].name).toBe("Fantasy");
    expect(insertedGenreValues[1].slug).toBe("fantasy");

    // Verify onConflictDoUpdate was executed for genres
    expect(mockOnConflictDoUpdate).toHaveBeenCalled();

    // Verify seriesToGenres relations inserted
    const insertedSeriesToGenreValues = mockValues.mock.calls[1][0];
    expect(insertedSeriesToGenreValues).toHaveLength(2);
    expect(insertedSeriesToGenreValues[0]).toEqual({
      seriesId: "series-stub-1",
      genreId: "genre-uuid-1",
    });
    expect(insertedSeriesToGenreValues[1]).toEqual({
      seriesId: "series-stub-1",
      genreId: "genre-uuid-2",
    });
    expect(mockOnConflictDoNothing).toHaveBeenCalled();
  });
});
