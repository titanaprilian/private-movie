import { describe, expect, it, vi } from "vitest";
import { seasons } from "@repo/db";
import { createSeasonsRepositoryInternal } from "../../../src/internal/seasons/repository";

function buildMockDb(existing: any, updated: any, calls: { sets: any[] }) {
  const updateMock = (table: any) => {
    if (table === seasons) {
      return {
        set: vi.fn().mockImplementation((data) => {
          calls.sets.push(data);
          return {
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([updated]),
            }),
          };
        }),
      };
    }
    return {};
  };
  return {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockImplementation(async (cond: any) => {
          // Duplicate-check path in create() selects { id } — return empty.
          if (cond !== undefined && existing === null) return [];
          return existing ? [existing] : [];
        }),
      }),
    }),
    update: vi.fn().mockImplementation(updateMock),
    transaction: vi.fn(async (cb: any) =>
      cb({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
        update: vi.fn().mockImplementation(updateMock),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updated]),
          }),
        }),
      })
    ),
  };
}

describe("seasons repository updateSeason status", () => {
  it("updates status field when passed in input", async () => {
    const seasonId = "season-123";
    const mockExistingSeason = {
      id: seasonId,
      seriesId: "series-123",
      title: "Season 1",
      status: "completed",
    };
    const mockUpdatedSeason = {
      id: seasonId,
      seriesId: "series-123",
      title: "Season 1",
      description: null,
      posterUrl: null,
      seasonNumber: 1,
      status: "ongoing",
      tmdbSyncStatus: "PENDING",
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
    };

    const calls: { sets: any[] } = { sets: [] };
    const mockDb = buildMockDb(mockExistingSeason, mockUpdatedSeason, calls);

    const repository = createSeasonsRepositoryInternal(mockDb as any);
    const result = await repository.updateSeason(seasonId, {
      status: "ongoing",
    });

    expect(mockDb.transaction).toHaveBeenCalled();
    const finalSet = calls.sets[calls.sets.length - 1];
    expect(finalSet.status).toBe("ongoing");
    expect(result.status).toBe("ongoing");
  });

  it("demotes other ongoing seasons when marking a season ongoing", async () => {
    const seasonId = "season-123";
    const mockExistingSeason = {
      id: seasonId,
      seriesId: "series-123",
      title: "Season 1",
      status: "completed",
    };
    const mockUpdatedSeason = { ...mockExistingSeason, status: "ongoing" };

    const calls: { sets: any[] } = { sets: [] };
    const mockDb = buildMockDb(mockExistingSeason, mockUpdatedSeason, calls);

    const repository = createSeasonsRepositoryInternal(mockDb as any);
    await repository.updateSeason(seasonId, { status: "ongoing" });

    // First set demotes siblings to completed, second set applies ongoing.
    expect(calls.sets).toHaveLength(2);
    expect(calls.sets[0]).toMatchObject({ status: "completed" });
    expect(calls.sets[1]).toMatchObject({ status: "ongoing" });
  });

  it("updates scraperUrl, source, episodeOffset, lastScrapedAt, lastScrapeError", async () => {
    const seasonId = "season-123";
    const now = new Date("2026-03-01T12:00:00Z");
    const mockExistingSeason = {
      id: seasonId,
      seriesId: "series-123",
      title: "Season 1",
      status: "completed",
    };
    const mockUpdatedSeason = {
      id: seasonId,
      seriesId: "series-123",
      title: "Season 1",
      description: null,
      posterUrl: null,
      seasonNumber: 1,
      status: "completed",
      scraperUrl: "https://otakudesu.cloud/anime/example",
      source: "otakudesu",
      episodeOffset: 12,
      lastScrapedAt: now,
      lastScrapeError: "Network timeout",
      tmdbSyncStatus: "PENDING",
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
    };

    const calls: { sets: any[] } = { sets: [] };
    const mockDb = buildMockDb(mockExistingSeason, mockUpdatedSeason, calls);

    const repository = createSeasonsRepositoryInternal(mockDb as any);
    const result = await repository.updateSeason(seasonId, {
      scraperUrl: "https://otakudesu.cloud/anime/example",
      source: "otakudesu",
      episodeOffset: 12,
      lastScrapedAt: now,
      lastScrapeError: "Network timeout",
    });

    const setPayload = calls.sets[calls.sets.length - 1];
    expect(setPayload).toBeDefined();
    expect(setPayload.scraperUrl).toBe("https://otakudesu.cloud/anime/example");
    expect(setPayload.source).toBe("otakudesu");
    expect(setPayload.episodeOffset).toBe(12);
    expect(setPayload.lastScrapedAt).toEqual(now);
    expect(setPayload.lastScrapeError).toBe("Network timeout");
    expect(result.scraperUrl).toBe("https://otakudesu.cloud/anime/example");
  });
});
