import { describe, expect, it, vi } from "vitest";
import { createDashboardRepository } from "../../../src/modules/dashboard";

// Minimal thenable Drizzle chain: each terminal call resolves to queued rows
// regardless of intermediate chaining (from/where/groupBy/orderBy/limit/...).
function chainFor(rows: unknown[]) {
  const chain: Record<string, unknown> = {};
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.groupBy = vi.fn(() => chain);
  chain.orderBy = vi.fn(() => chain);
  chain.limit = vi.fn(async () => rows);
  chain.innerJoin = vi.fn(() => chain);
  chain.leftJoin = vi.fn(() => chain);
  chain.then = (resolve: (v: unknown) => void) => Promise.resolve(rows).then(resolve);
  return chain;
}

function dbWithQueuedResults(queues: unknown[][]) {
  // Query order in getCatalogStats: select(series), selectDistinct(ongoing),
  // select(featured), select(seasons), select(genres), select(episodes).
  const selectQueues = [queues[0], queues[2], queues[3], queues[4], queues[5]];
  const select = vi.fn();
  for (const rows of selectQueues) {
    select.mockImplementationOnce(() => chainFor(rows ?? []));
  }
  const selectDistinct = vi.fn(() => chainFor(queues[1] ?? []));
  return { select, selectDistinct } as unknown as Parameters<
    typeof createDashboardRepository
  >[0];
}

describe("dashboard repository catalog stats", () => {
  it("maps count rows to the catalog contract with zero fallbacks", async () => {
    // Order of queries: series, ongoing-distinct (via selectDistinct),
    // featured, seasons, genres, episodes.
    const db = dbWithQueuedResults([
      [{ value: 7 }],
      [{ seriesId: "a" }, { seriesId: "b" }],
      [{ value: 2 }],
      [{ value: 9 }],
      [{ value: 4 }],
      [{ value: 42 }],
    ]);
    const repo = createDashboardRepository(db);
    await expect(repo.getCatalogStats()).resolves.toEqual({
      totalSeries: 7,
      ongoingSeriesCount: 2,
      featuredSeriesCount: 2,
      totalSeasons: 9,
      totalEpisodes: 42,
      totalGenres: 4,
    });
  });

  it("defaults missing count rows to zero", async () => {
    const db = dbWithQueuedResults([[], [{ seriesId: "a" }], [], [], [], []]);
    const repo = createDashboardRepository(db);
    const stats = await repo.getCatalogStats();
    expect(stats.totalSeries).toBe(0);
    expect(stats.totalEpisodes).toBe(0);
  });
});

describe("dashboard repository storage provider limits", () => {
  it("returns enabled provider limits and maps nulls", async () => {
    const select = vi.fn(() => chainFor([{ storageLimitGb: 50 }, { storageLimitGb: null }]));
    const db = { select } as unknown as Parameters<typeof createDashboardRepository>[0];
    const repo = createDashboardRepository(db);
    await expect(repo.getStorageProviderLimits()).resolves.toEqual([
      { storageLimitGb: 50 },
      { storageLimitGb: null },
    ]);
  });
});

describe("dashboard repository recent series mapping", () => {
  it("maps rows to the recent-series contract", async () => {
    const updatedAt = new Date("2026-02-01T00:00:00.000Z");
    const select = vi.fn(() =>
      chainFor([
        { id: "s1", title: "Show", posterUrl: null, updatedAt, episodeCount: 3 },
      ]),
    );
    const db = { select } as unknown as Parameters<typeof createDashboardRepository>[0];
    const repo = createDashboardRepository(db);
    await expect(repo.getRecentSeries()).resolves.toEqual([
      {
        id: "s1",
        title: "Show",
        posterUrl: null,
        episodeCount: 3,
        updatedAt: "2026-02-01T00:00:00.000Z",
      },
    ]);
  });

  it("defaults missing episode counts to zero", async () => {
    const updatedAt = new Date("2026-02-01T00:00:00.000Z");
    const select = vi.fn(() =>
      chainFor([{ id: "s1", title: "Show", posterUrl: "p", updatedAt, episodeCount: null }]),
    );
    const db = { select } as unknown as Parameters<typeof createDashboardRepository>[0];
    const repo = createDashboardRepository(db);
    const [row] = await repo.getRecentSeries();
    expect(row.episodeCount).toBe(0);
  });
});

describe("dashboard repository ongoing seasons mapping", () => {
  it("maps rows to the ongoing-season contract", async () => {
    const lastScrapedAt = new Date("2026-03-01T00:00:00.000Z");
    const select = vi.fn(() =>
      chainFor([
        {
          seasonId: "season-1",
          seriesId: "series-1",
          seriesTitle: "Show",
          seasonTitle: "Season 1",
          seasonNumber: 1,
          posterUrl: null,
          lastScrapedAt,
          lastScrapeError: "boom",
          episodeCount: 5,
        },
      ]),
    );
    const db = { select } as unknown as Parameters<typeof createDashboardRepository>[0];
    const repo = createDashboardRepository(db);
    await expect(repo.getOngoingSeasons()).resolves.toEqual([
      {
        seasonId: "season-1",
        seriesId: "series-1",
        seriesTitle: "Show",
        seasonTitle: "Season 1",
        seasonNumber: 1,
        posterUrl: null,
        episodeCount: 5,
        lastScrapedAt: "2026-03-01T00:00:00.000Z",
        lastScrapeError: "boom",
      },
    ]);
  });

  it("maps null dates and errors to null", async () => {
    const select = vi.fn(() =>
      chainFor([
        {
          seasonId: "season-1",
          seriesId: "series-1",
          seriesTitle: "Show",
          seasonTitle: "Season 1",
          seasonNumber: null,
          posterUrl: null,
          lastScrapedAt: null,
          lastScrapeError: null,
          episodeCount: null,
        },
      ]),
    );
    const db = { select } as unknown as Parameters<typeof createDashboardRepository>[0];
    const repo = createDashboardRepository(db);
    const [row] = await repo.getOngoingSeasons();
    expect(row).toMatchObject({
      lastScrapedAt: null,
      lastScrapeError: null,
      episodeCount: 0,
      seasonNumber: null,
    });
  });
});
