import { describe, expect, it, vi } from "vitest";
import { episodes, seasons, series } from "@repo/db";
import {
  compareSeasons,
  createSeriesRepositoryInternal,
} from "../../../src/internal/series/repository";

describe("compareSeasons", () => {
  it("sorts seasons in exact order: regular seasons ASC -> tmdbSeason = 0 -> tmdbSeason = null -> createdAt ASC fallback", () => {
    const s3 = { id: "s3", tmdbSeason: 3, createdAt: new Date("2026-01-01") };
    const s1 = { id: "s1", tmdbSeason: 1, createdAt: new Date("2026-01-01") };
    const s0 = { id: "s0", tmdbSeason: 0, createdAt: new Date("2026-01-01") };
    const sNull1 = { id: "sNull1", tmdbSeason: null, createdAt: new Date("2026-01-02") };
    const sNull2 = { id: "sNull2", tmdbSeason: null, createdAt: new Date("2026-01-01") };

    const seasonList = [s3, sNull1, s0, s1, sNull2];
    seasonList.sort(compareSeasons);

    expect(seasonList.map((s) => s.tmdbSeason)).toEqual([1, 3, 0, null, null]);
    expect(seasonList.map((s) => s.id)).toEqual(["s1", "s3", "s0", "sNull2", "sNull1"]);
  });
});

describe("series repository findByIdWithEpisodes season sorting", () => {
  it("returns seasons strictly ordered by tmdbSeason priority [1, 3, 0, null]", async () => {
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
      { id: "s3", seriesId, tmdbSeason: 3, createdAt: new Date("2026-01-01") },
      { id: "s1", seriesId, tmdbSeason: 1, createdAt: new Date("2026-01-02") },
      { id: "s0", seriesId, tmdbSeason: 0, createdAt: new Date("2026-01-03") },
      { id: "sNull", seriesId, tmdbSeason: null, createdAt: new Date("2026-01-04") },
    ];

    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockImplementation((table) => {
          return {
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
              return Promise.resolve([]);
            }),
          };
        }),
      }),
    };

    const repository = createSeriesRepositoryInternal(mockDb as any);
    const result = await repository.findByIdWithEpisodes(seriesId);

    expect(result).not.toBeNull();
    expect(result?.seasons).toHaveLength(4);
    expect(result?.seasons.map((s) => s.tmdbSeason)).toEqual([1, 3, 0, null]);
    expect(result?.seasons.map((s) => s.id)).toEqual(["s1", "s3", "s0", "sNull"]);
  });
});
