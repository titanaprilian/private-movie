import { describe, expect, it, vi } from "vitest";
import { seasons, series } from "@repo/db";
import { createSeasonsRepositoryInternal } from "../../../src/internal/seasons/repository";

// For select() with no args (findById) vs select({id}) (remaining check),
// vi mock above can't distinguish by args easily since select called with/without.
// Patch: use implementation checking arguments.
function buildDb(existing: any, remainingOngoing: any[], episodeCount = 0) {
  const seriesUpdates: any[] = [];
  const selectImpl = (...args: any[]) => ({
    from: (table: any) => ({
      where: (..._w: any[]) => {
        if (table === seasons && args.length > 0) {
          return { limit: async () => remainingOngoing };
        }
        if (table === seasons) return Promise.resolve(existing ? [existing] : []);
        // episodes count query
        return Promise.resolve([{ value: episodeCount }]);
      },
    }),
  });
  const db: any = {
    select: vi.fn(selectImpl),
    update: vi.fn((table: any) => ({
      set: vi.fn((data: any) => {
        if (table === series) seriesUpdates.push(data);
        return {
          where: vi.fn(() => ({
            returning: vi.fn(async () => [{ ...existing, status: "completed" }]),
          })),
        };
      }),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => ({
        returning: vi.fn(async () => [existing]),
      })),
    })),
  };
  return { db, seriesUpdates };
}

describe("seasons repository auto-clears highlighted ongoing series", () => {
  it("clears highlight when updateSeason completes the last ongoing season", async () => {
    const existing = { id: "s1", seriesId: "series-1", title: "S1", status: "ongoing" };
    const { db, seriesUpdates } = buildDb(existing, []);
    const repo = createSeasonsRepositoryInternal(db);
    await repo.updateSeason("s1", { status: "completed" });
    expect(seriesUpdates).toHaveLength(1);
    expect(seriesUpdates[0]).toMatchObject({ isOngoingHighlighted: false });
  });

  it("keeps highlight when another ongoing season remains", async () => {
    const existing = { id: "s1", seriesId: "series-1", title: "S1", status: "ongoing" };
    const { db, seriesUpdates } = buildDb(existing, [{ id: "s2" }]);
    const repo = createSeasonsRepositoryInternal(db);
    await repo.updateSeason("s1", { status: "completed" });
    expect(seriesUpdates).toHaveLength(0);
  });

  it("clears highlight when deleteSeason removes the last ongoing season", async () => {
    const existing = { id: "s1", seriesId: "series-1", title: "S1", status: "ongoing" };
    const { db, seriesUpdates } = buildDb(existing, [], 0);
    const repo = createSeasonsRepositoryInternal(db);
    await repo.deleteSeason("s1");
    expect(seriesUpdates).toHaveLength(1);
    expect(seriesUpdates[0]).toMatchObject({ isOngoingHighlighted: false });
  });
});
