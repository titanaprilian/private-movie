import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createMediaService } from "../../src";
import { series, seasons, episodes } from "@repo/db";
import { MediaScraper } from "@repo/media-scraper";

function tmdbResponse(payload: unknown) {
  return new Response(JSON.stringify(payload), { status: 200 });
}

const tableName = (t: any) =>
  t === series ? "series" : t === seasons ? "seasons" : t === episodes ? "episodes" : "other";

describe("ongoing scrape auto-creation for early episode releases", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("creates a placeholder episode and saves sources when the scraper is ahead of TMDB", async () => {
    const seasonRow = {
      id: "s-1",
      seriesId: "series-1",
      seasonNumber: 4,
      title: "Season 4",
      status: "ongoing",
      scraperUrl: "https://otakudesu.cloud/anime/example",
      source: "otakudesu",
      episodeOffset: 0,
    };
    const seriesRow = { id: "series-1", title: "Example Anime", type: "tv", tmdbId: null };
    const ep18 = {
      id: "ep-18",
      seasonId: "s-1",
      order: 18,
      title: "Episode 18",
      tmdbSeasonNumber: 1,
      tmdbEpisodeNumber: 80,
    };

    const mockProvider = {
      name: "otakudesu",
      canHandle: vi.fn().mockReturnValue(true),
      parseSeries: vi.fn().mockResolvedValue({
        title: "Example Anime",
        episodes: [
          { title: "Episode 18 Sub Indo", url: "https://otakudesu.cloud/episode/ep-18" },
          { title: "Episode 19 Sub Indo", url: "https://otakudesu.cloud/episode/ep-19" },
        ],
      }),
      parseEpisode: vi.fn(),
      resolveVideoSources: vi.fn().mockImplementation((url: string) => {
        if (url === "https://otakudesu.cloud/episode/ep-19") {
          return Promise.resolve([
            { type: "embed", url: "https://stream.com/embed19", label: "StreamSB", quality: "720p" },
          ]);
        }
        return Promise.resolve([]);
      }),
    };
    vi.spyOn(MediaScraper, "getProviderForUrl").mockReturnValue(mockProvider as any);

    const episodeRows: any[] = [ep18];
    const insertedVideoSources: any[] = [];
    let updatedSeasonStatus: string | null = null;

    const mockDb: any = {
      select: vi.fn().mockImplementation(() => ({
        from: vi.fn().mockImplementation((table: any) => ({
          where: vi.fn().mockImplementation(() => {
            if (table === seasons) {
              return {
                orderBy: vi.fn().mockResolvedValue([seasonRow]),
                then: (resolve: any) => resolve([seasonRow]),
              };
            }
            if (table === series) return Promise.resolve([seriesRow]);
            if (table === episodes) {
              return {
                orderBy: vi.fn().mockResolvedValue(episodeRows),
                then: (resolve: any) => resolve(episodeRows),
              };
            }
            return {
              orderBy: vi.fn().mockResolvedValue([]),
              then: (resolve: any) => resolve([]),
            };
          }),
          orderBy: vi.fn().mockImplementation(async () => {
            if (table === episodes) return episodeRows;
            return [];
          }),
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({ orderBy: vi.fn().mockResolvedValue([]) }),
          }),
        })),
      })),
      insert: vi.fn().mockImplementation((table: any) => ({
        values: vi.fn().mockImplementation((val: any) => {
          const vals = Array.isArray(val) ? val : [val];
          if (tableName(table) === "episodes") {
            for (const v of vals) {
              const row = { id: v.id ?? `ep-new-${episodeRows.length}`, ...v };
              episodeRows.push(row);
            }
          } else {
            for (const v of vals) insertedVideoSources.push(v);
          }
          return {
            onConflictDoUpdate: vi.fn().mockReturnValue({
              returning: vi.fn().mockImplementation(async () => vals),
            }),
            onConflictDoNothing: vi.fn().mockResolvedValue([]),
          };
        }),
      })),
      update: vi.fn().mockImplementation((table: any) => ({
        set: vi.fn().mockImplementation((data: any) => {
          if (table === seasons && data.status) updatedSeasonStatus = data.status;
          return {
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([{ ...seasonRow, ...data }]),
            }),
          };
        }),
      })),
    };

    const svc = createMediaService(mockDb, {
      fetchHtml: { get: vi.fn(), post: vi.fn() },
    });
    const result = await svc.syncAndScrapeOngoingSeason("s-1");

    // Placeholder created for order 19 ahead of TMDB
    const placeholder = episodeRows.find((e) => e.order === 19);
    expect(placeholder).toBeDefined();
    expect(placeholder.title).toBe("Episode 19");
    expect(placeholder.seasonId).toBe("s-1");

    // Sources resolved and persisted to the placeholder immediately
    expect(insertedVideoSources).toHaveLength(1);
    expect(insertedVideoSources[0].episodeId).toBe(placeholder.id);
    expect(insertedVideoSources[0].url).toBe("https://stream.com/embed19");

    expect(result.success).toBe(true);
    expect(result.episodesScraped).toBe(1);
    expect(result.sourcesSaved).toBe(1);
    expect(updatedSeasonStatus).toBeNull();
  });

  it("enriches the placeholder on subsequent TMDB sync without deleting video sources", async () => {
    const seriesRow = { id: "s1", title: "Show", type: "tv", tmdbId: 100 };
    const seasonRows = [
      { id: "season-1", seriesId: "s1", seasonNumber: 1, title: "Season 1", status: "completed" },
      { id: "season-4", seriesId: "s1", seasonNumber: 4, title: "S4", status: "ongoing" },
    ];
    const episodeRows = [
      {
        id: "ep-18",
        seasonId: "season-4",
        order: 18,
        title: "E18",
        tmdbSeasonNumber: 1,
        tmdbEpisodeNumber: 80,
        isUnassigned: false,
      },
      {
        id: "ep-placeholder",
        seasonId: "season-4",
        order: 19,
        title: "Episode 19",
        tmdbSeasonNumber: null,
        tmdbEpisodeNumber: null,
        isUnassigned: false,
      },
    ];

    const txCalls: { updates: any[]; inserts: any[]; deletes: any[] } = {
      updates: [],
      inserts: [],
      deletes: [],
    };
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
          const returned =
            tableName(table) === "seasons"
              ? [{ ...first, id: seasonRows.find((s) => s.seasonNumber === first.seasonNumber)?.id ?? "season-1" }]
              : [{ id: "genre-id-1" }];
          return {
            onConflictDoUpdate: vi.fn(() => ({ returning: vi.fn(async () => returned) })),
            onConflictDoNothing: vi.fn(async () => []),
          };
        },
      })),
      delete: vi.fn(() => {
        txCalls.deletes.push({ table: "seriesToGenres" });
        return { where: vi.fn(async () => []) };
      }),
    };
    const mockDb: any = {
      select: vi.fn(() => ({
        from: (table: any) => {
          const name = tableName(table);
          const builder: any = {
            innerJoin: vi.fn(() => builder),
            where: vi.fn(() => {
              const rows =
                name === "series" ? [seriesRow] : name === "seasons" ? seasonRows : name === "episodes" ? episodeRows : [];
              const p: any = Promise.resolve(rows);
              p.orderBy = vi.fn(async () => rows);
              return p;
            }),
            orderBy: vi.fn(async () =>
              name === "seasons" ? seasonRows : name === "episodes" ? episodeRows : []
            ),
          };
          return builder;
        },
      })),
      transaction: vi.fn(async (cb: any) => cb(mockTx)),
    };

    const fetchSpy = vi.spyOn(global, "fetch").mockImplementation((async (url: string) => {
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
            { episode_number: 81, name: "E81 official", overview: "official overview", still_path: null, vote_average: null, air_date: null, runtime: null },
          ],
        });
      if (url.includes("/images")) return tmdbResponse({ logos: [] });
      throw new Error(`Unexpected ${url}`);
    }) as any);

    try {
      const svc = createMediaService(mockDb);
      await svc.syncTmdb("s1", { type: "tv", tmdbId: 100 });

      const epUpdates = txCalls.updates.filter((u) => u.table === "episodes");
      // E80 matched in place + placeholder enriched in place; no inserts
      expect(epUpdates).toHaveLength(2);
      const placeholderUpdate = epUpdates.find((u) => u.set.tmdbEpisodeNumber === 81);
      expect(placeholderUpdate).toBeDefined();
      expect(placeholderUpdate.set).toMatchObject({
        title: "E81 official",
        description: "official overview",
        tmdbSeasonNumber: 1,
        tmdbEpisodeNumber: 81,
      });
      const epInserts = txCalls.inserts.filter((i) => i.table === "episodes");
      expect(epInserts).toHaveLength(0);
      // Video sources are never deleted or rewritten by TMDB sync
      expect(txCalls.deletes.filter((d) => d.table === "videoSources")).toHaveLength(0);
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
