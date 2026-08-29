import { describe, expect, it, vi } from "vitest";
import { seasons } from "@repo/db";
import { createSeasonsRepositoryInternal } from "../../../src/internal/seasons/repository";

describe("seasons repository updateSeason status", () => {
  it("updates status field when passed in input", async () => {
    const seasonId = "season-123";
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

    let setPayload: any = null;

    const mockDb = {
      update: vi.fn().mockImplementation((table) => {
        if (table === seasons) {
          return {
            set: vi.fn().mockImplementation((data) => {
              setPayload = data;
              return {
                where: vi.fn().mockReturnValue({
                  returning: vi.fn().mockResolvedValue([mockUpdatedSeason]),
                }),
              };
            }),
          };
        }
        return {};
      }),
    };

    const repository = createSeasonsRepositoryInternal(mockDb as any);
    const result = await repository.updateSeason(seasonId, {
      status: "ongoing",
    });

    expect(setPayload).toBeDefined();
    expect(setPayload.status).toBe("ongoing");
    expect(result.status).toBe("ongoing");
  });
});
