import { describe, expect, it, vi } from "vitest";
import { episodes, seasons, series, seriesToGenres } from "@repo/db";
import {
  compareSeasons,
  createSeriesRepositoryInternal,
} from "../../../src/internal/series/repository";

describe("compareSeasons", () => {
  it("sorts seasons in exact order: regular seasons ASC -> seasonNumber = 0 -> seasonNumber = null -> createdAt ASC fallback", () => {
    const s3 = { id: "s3", seasonNumber: 3, createdAt: new Date("2026-01-01") };
    const s1 = { id: "s1", seasonNumber: 1, createdAt: new Date("2026-01-01") };
    const s0 = { id: "s0", seasonNumber: 0, createdAt: new Date("2026-01-01") };
    const sNull1 = { id: "sNull1", seasonNumber: null, createdAt: new Date("2026-01-02") };
    const sNull2 = { id: "sNull2", seasonNumber: null, createdAt: new Date("2026-01-01") };

    const seasonList = [s3, sNull1, s0, s1, sNull2];
    seasonList.sort(compareSeasons);

    expect(seasonList.map((s) => s.seasonNumber)).toEqual([1, 3, 0, null, null]);
    expect(seasonList.map((s) => s.id)).toEqual(["s1", "s3", "s0", "sNull2", "sNull1"]);
  });
});

describe("series repository findByIdWithEpisodes season sorting", () => {
  it("returns seasons strictly ordered by seasonNumber priority [1, 3, 0, null]", async () => {
    const seriesId = "series-123";
    const mockSeriesRow = {
      id: seriesId,
      title: "Mocked Series",
      description: "Description",
      type: "tv",
      posterUrl: null,
      backdropUrl: null,
      rating: null,
      tmdbId: 100,
      tmdbSyncStatus: "SYNCED",
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
    };

    const mockSeasons = [
      { id: "s3", seriesId, seasonNumber: 3, createdAt: new Date("2026-01-01") },
      { id: "s1", seriesId, seasonNumber: 1, createdAt: new Date("2026-01-02") },
      { id: "s0", seriesId, seasonNumber: 0, createdAt: new Date("2026-01-03") },
      { id: "sNull", seriesId, seasonNumber: null, createdAt: new Date("2026-01-04") },
    ];

    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockImplementation((table) => {
          return {
            innerJoin: vi.fn().mockReturnThis(),
            where: vi.fn().mockImplementation(() => {
              if (table === series) {
                return Promise.resolve([mockSeriesRow]);
              }
              if (table === seasons) {
                return {
                  orderBy: vi.fn().mockResolvedValue(mockSeasons),
                };
              }
              if (table === episodes) {
                return {
                  orderBy: vi.fn().mockResolvedValue([]),
                };
              }
              return {
                orderBy: vi.fn().mockResolvedValue([]),
                then: vi.fn().mockImplementation((cb) => cb([])),
              };
            }),
          };
        }),
      }),
    };

    const repository = createSeriesRepositoryInternal(mockDb as any);
    const result = await repository.findByIdWithEpisodes(seriesId);

    expect(result).not.toBeNull();
    expect(result?.seasons).toHaveLength(4);
    expect(result?.seasons.map((s) => s.seasonNumber)).toEqual([1, 3, 0, null]);
    expect(result?.seasons.map((s) => s.id)).toEqual(["s1", "s3", "s0", "sNull"]);
  });
});

describe("series repository list multi-genre filtering", () => {
  it("filters series by multiple genre slugs using AND logic", async () => {
    const mockDb = {
      select: vi.fn().mockImplementation(() => {
        return {
          from: vi.fn().mockImplementation((table) => {
            if (table === seriesToGenres) {
              return {
                innerJoin: vi.fn().mockReturnValue({
                  where: vi.fn().mockReturnValue({
                    groupBy: vi.fn().mockReturnValue({
                      having: vi.fn().mockResolvedValue([]),
                    }),
                  }),
                }),
              };
            }
            if (table === series) {
              return {
                where: vi.fn().mockReturnValue({
                  orderBy: vi.fn().mockReturnValue({
                    limit: vi.fn().mockReturnValue({
                      offset: vi.fn().mockResolvedValue([]),
                    }),
                  }),
                }),
              };
            }
            return {
              where: vi.fn().mockResolvedValue([{ value: 0 }]),
            };
          }),
        };
      }),
    };

    const repository = createSeriesRepositoryInternal(mockDb as any);
    const result = await repository.list({ page: 1, limit: 10, genre: "action, comedy" });

    expect(result.series).toEqual([]);
    expect(result.total).toBe(0);
  });
});
