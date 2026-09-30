import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createMediaService } from "../../../src";
import { series, seasons, episodes } from "@repo/db";

function tmdbResponse(payload: unknown) {
  return new Response(JSON.stringify(payload), { status: 200 });
}

function buildMockDb(opts: {
  seriesRow: any;
  seasonRows: any[];
  episodeRows: any[];
}) {
  const { seriesRow, seasonRows, episodeRows } = opts;
  const txCalls: {
    updates: Array<{ table: unknown; set: any; whereId?: string }>;
    inserts: Array<{ table: unknown; values: any }>;
  } = { updates: [], inserts: [] };

  const tableName = (t: any) =>
    t === series ? "series" : t === seasons ? "seasons" : t === episodes ? "episodes" : "other";

  const mockTx: any = {
    update: vi.fn((table: any) => ({
      set: (setData: any) => ({
        where: vi.fn(async () => {
          txCalls.updates.push({ table: tableName(table), set: setData });
          return [];
        }),
      }),
    })),
    insert: vi.fn((table: any) => ({
      values: (values: any) => {
        const vals = Array.isArray(values) ? values : [values];
        for (const v of vals) txCalls.inserts.push({ table: tableName(table), values: v });
        const first = vals[0] ?? {};
        // Mimic returning the inserted season row for canonical id resolution
        const returned =
          tableName(table) === "seasons"
            ? [
                {
                  ...first,
                  id:
                    seasonRows.find((s) => s.seasonNumber === first.seasonNumber)?.id ??
                    `season-${first.seasonNumber}`,
                },
              ]
            : [{ id: "genre-id-1" }];
        return {
          onConflictDoUpdate: vi.fn(() => ({ returning: vi.fn(async () => returned) })),
          onConflictDoNothing: vi.fn(async () => []),
        };
      },
    })),
    delete: vi.fn(() => ({ where: vi.fn(async () => []) })),
  };

  const mockDb: any = {
    select: vi.fn((_sel?: any) => ({
      from: (table: any) => {
        const name = tableName(table);
        const builder: any = {
          innerJoin: vi.fn(() => builder),
          where: vi.fn(() => {
            let rows: any[] = [];
            if (name === "series") rows = [seriesRow];
            else if (name === "seasons") rows = seasonRows;
            else if (name === "episodes") rows = episodeRows;
            else rows = [];
            const p: any = Promise.resolve(rows);
            p.orderBy = vi.fn(async () => rows);
            return p;
          }),
          orderBy: vi.fn(async () => {
            if (name === "seasons") return seasonRows;
            if (name === "episodes") return episodeRows;
            return [];
          }),
        };
        return builder;
      },
    })),
    transaction: vi.fn(async (cb: any) => cb(mockTx)),
  };

  return { mockDb, mockTx, txCalls };
}

const now = new Date("2026-01-01");

describe("syncTmdb passport matching & routing", () => {
  let fetchSpy: any;
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => fetchSpy?.mockRestore?.());

  it("updates a moved episode in-place without re-inserting into Season 1", async () => {
    const seriesRow = { id: "s1", title: "Show", type: "tv", tmdbId: 100 };
    const seasonRows = [
      { id: "season-1", seriesId: "s1", seasonNumber: 1, title: "Season 1", status: "completed" },
      { id: "season-2", seriesId: "s1", seasonNumber: 2, title: "Custom S2", status: "completed" },
    ];
    const episodeRows = [
      {
        id: "ep-moved",
        seasonId: "season-2",
        order: 1,
        title: "Old Title",
        description: "old",
        tmdbSeasonNumber: 1,
        tmdbEpisodeNumber: 26,
        isUnassigned: false,
      },
    ];
    const { mockDb, txCalls } = buildMockDb({ seriesRow, seasonRows, episodeRows });
    fetchSpy = vi.spyOn(global, "fetch").mockImplementation((async (url: string) => {
      if (url === "https://api.themoviedb.org/3/tv/100")
        return tmdbResponse({
          id: 100, name: "Show", overview: "desc", poster_path: null,
          backdrop_path: null, vote_average: 8, genres: [],
          seasons: [{ season_number: 1, name: "Season 1", episode_count: 1 }],
        });
      if (url === "https://api.themoviedb.org/3/tv/100/season/1")
        return tmdbResponse({
          season_number: 1, name: "Season 1",
          episodes: [{ episode_number: 26, name: "New Title", overview: "new", still_path: null, vote_average: 7, air_date: null, runtime: null }],
        });
      if (url.includes("/images")) return tmdbResponse({ logos: [] });
      throw new Error(`Unexpected ${url}`);
    }) as any);

    const svc = createMediaService(mockDb);
    await svc.syncTmdb("s1", { type: "tv", tmdbId: 100 });

    const epUpdates = txCalls.updates.filter((u) => u.table === "episodes");
    expect(epUpdates).toHaveLength(1);
    expect(epUpdates[0].set).toMatchObject({ title: "New Title", tmdbSeasonNumber: 1, tmdbEpisodeNumber: 26 });
    const epInserts = txCalls.inserts.filter((i) => i.table === "episodes");
    expect(epInserts).toHaveLength(0);
  });

  it("routes new episodes to the ongoing season sequentially", async () => {
    const seriesRow = { id: "s1", title: "Show", type: "tv", tmdbId: 100 };
    const seasonRows = [
      { id: "season-1", seriesId: "s1", seasonNumber: 1, title: "Season 1", status: "completed" },
      { id: "season-4", seriesId: "s1", seasonNumber: 4, title: "S4", status: "ongoing" },
    ];
    const episodeRows = [
      { id: "e1", seasonId: "season-4", order: 18, title: "E18", tmdbSeasonNumber: 1, tmdbEpisodeNumber: 80, isUnassigned: false },
    ];
    const { mockDb, txCalls } = buildMockDb({ seriesRow, seasonRows, episodeRows });
    fetchSpy = vi.spyOn(global, "fetch").mockImplementation((async (url: string) => {
      if (url === "https://api.themoviedb.org/3/tv/100")
        return tmdbResponse({
          id: 100, name: "Show", overview: "d", poster_path: null,
          backdrop_path: null, vote_average: 8, genres: [],
          seasons: [{ season_number: 1, name: "Season 1", episode_count: 2 }],
        });
      if (url === "https://api.themoviedb.org/3/tv/100/season/1")
        return tmdbResponse({
          season_number: 1, name: "Season 1",
          episodes: [
            { episode_number: 80, name: "E80", overview: null, still_path: null, vote_average: null, air_date: null, runtime: null },
            { episode_number: 81, name: "E81 brand new", overview: null, still_path: null, vote_average: null, air_date: null, runtime: null },
          ],
        });
      if (url.includes("/images")) return tmdbResponse({ logos: [] });
      throw new Error(`Unexpected ${url}`);
    }) as any);

    const svc = createMediaService(mockDb);
    await svc.syncTmdb("s1", { type: "tv", tmdbId: 100 });

    const epUpdates = txCalls.updates.filter((u) => u.table === "episodes");
    expect(epUpdates).toHaveLength(1); // E80 matched in place
    const epInserts = txCalls.inserts.filter((i) => i.table === "episodes");
    expect(epInserts).toHaveLength(1);
    expect(epInserts[0].values.seasonId).toBe("season-4");
    expect(epInserts[0].values.order).toBe(19);
    expect(epInserts[0].values.isUnassigned).toBe(false);
    expect(epInserts[0].values.tmdbSeasonNumber).toBe(1);
    expect(epInserts[0].values.tmdbEpisodeNumber).toBe(81);
  });

  it("flags new episodes as unassigned when no ongoing season exists", async () => {
    const seriesRow = { id: "s1", title: "Show", type: "tv", tmdbId: 100 };
    const seasonRows = [
      { id: "season-1", seriesId: "s1", seasonNumber: 1, title: "Season 1", status: "completed" },
    ];
    const episodeRows = [
      { id: "e1", seasonId: "season-1", order: 1, title: "E1", tmdbSeasonNumber: 1, tmdbEpisodeNumber: 1, isUnassigned: false },
    ];
    const { mockDb, txCalls } = buildMockDb({ seriesRow, seasonRows, episodeRows });
    fetchSpy = vi.spyOn(global, "fetch").mockImplementation((async (url: string) => {
      if (url === "https://api.themoviedb.org/3/tv/100")
        return tmdbResponse({
          id: 100, name: "Show", overview: "d", poster_path: null,
          backdrop_path: null, vote_average: 8, genres: [],
          seasons: [{ season_number: 1, name: "Season 1", episode_count: 2 }],
        });
      if (url === "https://api.themoviedb.org/3/tv/100/season/1")
        return tmdbResponse({
          season_number: 1, name: "Season 1",
          episodes: [
            { episode_number: 1, name: "E1", overview: null, still_path: null, vote_average: null, air_date: null, runtime: null },
            { episode_number: 2, name: "E2 new", overview: null, still_path: null, vote_average: null, air_date: null, runtime: null },
          ],
        });
      if (url.includes("/images")) return tmdbResponse({ logos: [] });
      throw new Error(`Unexpected ${url}`);
    }) as any);

    const svc = createMediaService(mockDb);
    await svc.syncTmdb("s1", { type: "tv", tmdbId: 100 });

    const epInserts = txCalls.inserts.filter((i) => i.table === "episodes");
    expect(epInserts).toHaveLength(1);
    expect(epInserts[0].values.seasonId).toBe("season-1");
    expect(epInserts[0].values.isUnassigned).toBe(true);
    expect(epInserts[0].values.tmdbEpisodeNumber).toBe(2);
  });
});
