import { describe, expect, it, vi } from "vitest";
import {
  compareSeasons,
  createSeriesRepositoryInternal,
  SeriesHighlightWithoutOngoingError,
  SeriesNotFoundError,
} from "../../../src/internal/series/repository";

describe("compareSeasons", () => {
  it("sorts seasons in exact order: regular seasons ASC -> seasonNumber = 0 -> seasonNumber = null -> createdAt ASC fallback", () => {
    const s3 = { id: "s3", seasonNumber: 3, createdAt: new Date("2026-01-01") };
    const s1 = { id: "s1", seasonNumber: 1, createdAt: new Date("2026-01-01") };
    const s0 = { id: "s0", seasonNumber: 0, createdAt: new Date("2026-01-01") };
    const sNull1 = {
      id: "sNull1",
      seasonNumber: null,
      createdAt: new Date("2026-01-02"),
    };
    const sNull2 = {
      id: "sNull2",
      seasonNumber: null,
      createdAt: new Date("2026-01-01"),
    };

    const seasonList = [s3, sNull1, s0, s1, sNull2];
    seasonList.sort(compareSeasons);

    expect(seasonList.map((s) => s.seasonNumber)).toEqual([
      1,
      3,
      0,
      null,
      null,
    ]);
    expect(seasonList.map((s) => s.id)).toEqual([
      "s1",
      "s3",
      "s0",
      "sNull2",
      "sNull1",
    ]);
  });
});

describe("error classes", () => {
  it("constructs SeriesNotFoundError with default and custom messages", () => {
    const defaultErr = new SeriesNotFoundError();
    expect(defaultErr.message).toBe("Series not found");
    expect(defaultErr.name).toBe("SeriesNotFoundError");

    const customErr = new SeriesNotFoundError("Custom not found");
    expect(customErr.message).toBe("Custom not found");
  });

  it("constructs SeriesHighlightWithoutOngoingError with default and custom messages", () => {
    const defaultErr = new SeriesHighlightWithoutOngoingError();
    expect(defaultErr.message).toBe(
      "Cannot highlight a series with no ongoing seasons",
    );
    expect(defaultErr.name).toBe("SeriesHighlightWithoutOngoingError");

    const customErr = new SeriesHighlightWithoutOngoingError(
      "Custom ongoing error",
    );
    expect(customErr.message).toBe("Custom ongoing error");
  });
});

describe("createSeriesRepositoryInternal delegation", () => {
  it("delegates findById query to database", async () => {
    const mockRow = { id: "series-1", title: "Test Series" };
    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockRow]),
        }),
      }),
    };

    const repo = createSeriesRepositoryInternal(mockDb as never);
    const result = await repo.findById("series-1");
    expect(result).toEqual(mockRow);
  });

  it("delegates findByTmdbId query to database", async () => {
    const mockRow = { id: "series-1", tmdbId: 42 };
    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockRow]),
        }),
      }),
    };

    const repo = createSeriesRepositoryInternal(mockDb as never);
    const result = await repo.findByTmdbId(42);
    expect(result).toEqual(mockRow);
  });

  it("delegates upsert mutation to database", async () => {
    const mockRow = { id: "series-1", title: "Upserted Series" };
    const mockDb = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoUpdate: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([mockRow]),
          }),
        }),
      }),
    };

    const repo = createSeriesRepositoryInternal(mockDb as never);
    const result = await repo.upsert({ title: "Upserted Series" });
    expect(result).toEqual(mockRow);
  });

  it("throws SeriesNotFoundError when deleteSeries target is not found", async () => {
    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      }),
      delete: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      }),
    };

    const repo = createSeriesRepositoryInternal(mockDb as never);
    await expect(repo.deleteSeries("non-existent")).rejects.toThrow(
      SeriesNotFoundError,
    );
  });

  it("deletes child episodes and series row successfully", async () => {
    const mockRow = { id: "series-1", title: "Deleted Series" };
    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: "season-1" }]),
        }),
      }),
      delete: vi.fn().mockImplementation(() => ({
        where: vi.fn().mockImplementation(() => ({
          returning: vi.fn().mockResolvedValue([mockRow]),
        })),
      })),
    };

    const repo = createSeriesRepositoryInternal(mockDb as never);
    const result = await repo.deleteSeries("series-1");
    expect(result).toEqual(mockRow);
  });
});
