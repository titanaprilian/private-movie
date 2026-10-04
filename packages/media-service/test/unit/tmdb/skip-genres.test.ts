import { describe, it, expect, vi, afterEach } from "vitest";
import { createMediaService } from "../../../src";
import { seasons, series } from "@repo/db";
import { MediaScraper } from "@repo/media-scraper";

function tmdbResponse(payload: unknown) {
  return new Response(JSON.stringify(payload), { status: 200 });
}

function tmdbPayload() {
  return {
    id: 100, name: "Show", overview: "d", poster_path: null,
    backdrop_path: null, vote_average: 8, genres: [{ id: 1, name: "Action" }],
    seasons: [],
  };
}

describe("syncTmdb skipGenres", () => {
  afterEach(() => vi.restoreAllMocks());

  it("preserves seriesToGenres relations when skipGenres is true", async () => {
    const seriesRow = { id: "s1", title: "Show", type: "tv", tmdbId: 100 };
    const mockTx: any = {
      update: vi.fn(() => ({ set: () => ({ where: vi.fn(async () => []) }) })),
      insert: vi.fn(() => ({
        values: () => ({
          onConflictDoUpdate: vi.fn(() => ({ returning: vi.fn(async () => [{ id: "row" }]) })),
          onConflictDoNothing: vi.fn(async () => []),
        }),
      })),
      delete: vi.fn(() => ({ where: vi.fn(async () => []) })),
    };
    const mockDb: any = {
      select: vi.fn(() => ({
        from: () => ({
          innerJoin: vi.fn(function (this: any) {
            return this;
          }),
          where: () => {
            const p: any = Promise.resolve([seriesRow]);
            p.orderBy = vi.fn(async () => [seriesRow]);
            return p;
          },
          orderBy: vi.fn(async () => []),
        }),
      })),
      transaction: vi.fn(async (cb: any) => cb(mockTx)),
    };
    const fetchSpy = vi.spyOn(global, "fetch").mockImplementation((async (url: string) => {
      if (url === "https://api.themoviedb.org/3/tv/100") return tmdbResponse(tmdbPayload());
      if (url.includes("/images")) return tmdbResponse({ logos: [] });
      throw new Error(`Unexpected ${url}`);
    }) as any);
    try {
      const svc = createMediaService(mockDb);
      await svc.syncTmdb("s1", { type: "tv", tmdbId: 100, skipGenres: true });
      expect(mockTx.delete).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("deletes and replaces seriesToGenres by default", async () => {
    const seriesRow = { id: "s1", title: "Show", type: "tv", tmdbId: 100 };
    const mockTx: any = {
      update: vi.fn(() => ({ set: () => ({ where: vi.fn(async () => []) }) })),
      insert: vi.fn(() => ({
        values: () => ({
          onConflictDoUpdate: vi.fn(() => ({ returning: vi.fn(async () => [{ id: "row" }]) })),
          onConflictDoNothing: vi.fn(async () => []),
        }),
      })),
      delete: vi.fn(() => ({ where: vi.fn(async () => []) })),
    };
    const mockDb: any = {
      select: vi.fn(() => ({
        from: () => ({
          innerJoin: vi.fn(function (this: any) {
            return this;
          }),
          where: () => {
            const p: any = Promise.resolve([seriesRow]);
            p.orderBy = vi.fn(async () => [seriesRow]);
            return p;
          },
          orderBy: vi.fn(async () => []),
        }),
      })),
      transaction: vi.fn(async (cb: any) => cb(mockTx)),
    };
    const fetchSpy = vi.spyOn(global, "fetch").mockImplementation((async (url: string) => {
      if (url === "https://api.themoviedb.org/3/tv/100") return tmdbResponse(tmdbPayload());
      if (url.includes("/images")) return tmdbResponse({ logos: [] });
      throw new Error(`Unexpected ${url}`);
    }) as any);
    try {
      const svc = createMediaService(mockDb);
      await svc.syncTmdb("s1", { type: "tv", tmdbId: 100 });
      expect(mockTx.delete).toHaveBeenCalledTimes(1);
      expect(mockTx.insert).toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("syncAndScrapeOngoingSeason passes skipGenres:true to syncTmdb", async () => {
    const seasonRow = {
      id: "s-1", seriesId: "series-1", seasonNumber: 1, title: "S1",
      status: "ongoing", scraperUrl: "https://otakudesu.cloud/anime/x",
      source: "otakudesu", episodeOffset: 0,
    };
    const seriesRow = { id: "series-1", title: "Show", type: "tv", tmdbId: 100 };
    const mockDb: any = {
      select: vi.fn().mockImplementation(() => ({
        from: vi.fn().mockImplementation((table: any) => ({
          where: vi.fn().mockImplementation(() => {
            if (table === seasons) return Promise.resolve([seasonRow]);
            if (table === series) return Promise.resolve([seriesRow]);
            const p: any = Promise.resolve([]);
            p.orderBy = vi.fn(async () => []);
            return p;
          }),
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({ orderBy: vi.fn().mockResolvedValue([]) }),
          }),
          orderBy: vi.fn().mockResolvedValue([]),
        })),
      })),
      transaction: vi.fn(async (cb: any) =>
        cb({
          update: vi.fn(() => ({ set: () => ({ where: vi.fn(async () => []) }) })),
          insert: vi.fn(() => ({
            values: () => ({
              onConflictDoUpdate: vi.fn(() => ({ returning: vi.fn(async () => [{ id: "x" }]) })),
              onConflictDoNothing: vi.fn(async () => []),
            }),
          })),
          delete: vi.fn(() => ({ where: vi.fn(async () => []) })),
        })
      ),
      update: vi.fn(() => ({
        set: () => ({ where: () => ({ returning: vi.fn(async () => [{ ...seasonRow }]) }) }),
      })),
      insert: vi.fn(() => ({
        values: () => ({
          onConflictDoUpdate: vi.fn(() => ({ returning: vi.fn(async () => []) })),
          onConflictDoNothing: vi.fn(async () => []),
        }),
      })),
    };
    vi.spyOn(MediaScraper, "getProviderForUrl").mockReturnValue({
      parseSeries: vi.fn().mockResolvedValue({ title: "Show", episodes: [] }),
      resolveVideoSources: vi.fn(),
    } as any);
    const fetchSpy = vi.spyOn(global, "fetch").mockImplementation((async (url: string) => {
      if (url === "https://api.themoviedb.org/3/tv/100") return tmdbResponse(tmdbPayload());
      if (url.includes("/images")) return tmdbResponse({ logos: [] });
      throw new Error(`Unexpected ${url}`);
    }) as any);
    try {
      const svc = createMediaService(mockDb, { fetchHtml: { get: vi.fn(), post: vi.fn() } });
      const syncSpy = vi.spyOn(svc, "syncTmdb");
      await svc.syncAndScrapeOngoingSeason("s-1");
      expect(syncSpy).toHaveBeenCalledWith("series-1", expect.objectContaining({ skipGenres: true }));
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
