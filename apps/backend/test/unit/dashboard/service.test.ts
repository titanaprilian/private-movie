import { describe, expect, it, vi } from "vitest";
import {
  computePercentUsed,
  createDashboardService,
  getSchedulerTelemetry,
  getStorageStats,
  STORAGE_USAGE_TIMEOUT_MS,
} from "../../../src/modules/dashboard";
import type { DashboardRepository } from "../../../src/modules/dashboard";

function stubRepository(
  overrides: Partial<DashboardRepository> = {},
): DashboardRepository {
  return {
    getCatalogStats: vi.fn(async () => ({
      totalSeries: 10,
      ongoingSeriesCount: 2,
      featuredSeriesCount: 1,
      totalSeasons: 20,
      totalEpisodes: 100,
      totalGenres: 5,
    })),
    getOngoingSeasons: vi.fn(async () => []),
    getRecentSeries: vi.fn(async () => []),
    getStorageProviderLimits: vi.fn(async () => []),
    getSchedulerConfig: vi.fn(async () => ({ intervalMinutes: 30, isEnabled: true })),
    ...overrides,
  };
}

describe("dashboard service storage orchestration", () => {
  it("falls back to zero usage when no provider is configured", async () => {
    const repo = stubRepository({
      getStorageProviderLimits: vi.fn(async () => [{ storageLimitGb: 50 }]),
    });
    const stats = await getStorageStats(repo, null);
    expect(stats).toMatchObject({ totalUsedBytes: 0, percentUsed: 0, providerCount: 1 });
    expect(stats.totalLimitBytes).toBe(50 * 1024 * 1024 * 1024);
  });

  it("falls back to zero usage when the provider throws", async () => {
    const repo = stubRepository({
      getStorageProviderLimits: vi.fn(async () => [{ storageLimitGb: 50 }]),
    });
    const stats = await getStorageStats(
      repo,
      { getTotalUsedBytes: () => Promise.reject(new Error("S3 down")) },
    );
    expect(stats.totalUsedBytes).toBe(0);
    expect(stats.percentUsed).toBe(0);
  });

  it("falls back to zero usage when the provider returns null", async () => {
    const repo = stubRepository({
      getStorageProviderLimits: vi.fn(async () => [{ storageLimitGb: 50 }]),
    });
    const stats = await getStorageStats(repo, { getTotalUsedBytes: async () => null });
    expect(stats.totalUsedBytes).toBe(0);
    expect(stats.percentUsed).toBe(0);
  });

  it("ignores non-positive usage values", async () => {
    const repo = stubRepository({
      getStorageProviderLimits: vi.fn(async () => [{ storageLimitGb: 50 }]),
    });
    for (const used of [-100, 0, Number.NaN]) {
      const stats = await getStorageStats(repo, { getTotalUsedBytes: async () => used });
      expect(stats.totalUsedBytes).toBe(0);
    }
  });

  it("falls back to zero usage on timeout", async () => {
    const repo = stubRepository({
      getStorageProviderLimits: vi.fn(async () => [{ storageLimitGb: 50 }]),
    });
    const stats = await getStorageStats(
      repo,
      { getTotalUsedBytes: () => new Promise(() => {}) },
      10,
    );
    expect(stats.totalUsedBytes).toBe(0);
    expect(stats.percentUsed).toBe(0);
  });

  it("computes percentage from real usage and floors fractional bytes", async () => {
    const repo = stubRepository({
      getStorageProviderLimits: vi.fn(async () => [{ storageLimitGb: 100 }]),
    });
    const limitBytes = 100 * 1024 * 1024 * 1024;
    const stats = await getStorageStats(repo, {
      getTotalUsedBytes: async () => limitBytes / 4 + 0.9,
    });
    expect(stats.totalUsedBytes).toBe(Math.floor(limitBytes / 4 + 0.9));
    expect(stats.percentUsed).toBe(25);
  });

  it("caps percentage at 100 when usage exceeds the limit", () => {
    expect(computePercentUsed(200, 100)).toBe(100);
    expect(computePercentUsed(50, 0)).toBe(0);
    expect(computePercentUsed(0, 100)).toBe(0);
  });

  it(`default storage timeout is ${STORAGE_USAGE_TIMEOUT_MS}ms`, () => {
    expect(STORAGE_USAGE_TIMEOUT_MS).toBe(2500);
  });
});

describe("dashboard service scheduler telemetry", () => {
  it("aggregates live scheduler provider telemetry", async () => {
    const repo = stubRepository();
    const telemetry = await getSchedulerTelemetry(repo, {
      isEnabled: () => true,
      isExecuting: () => true,
      getIntervalMs: () => 3_600_000,
      getLastRunAt: () => new Date("2026-01-01T00:00:00.000Z"),
      getLastRunResult: () => ({ totalProcessed: 5, successCount: 4, failureCount: 1 }),
      getNextRunAt: () => new Date("2026-01-01T01:00:00.000Z"),
    });
    expect(telemetry).toEqual({
      isEnabled: true,
      isExecuting: true,
      intervalMinutes: 60,
      lastRunAt: "2026-01-01T00:00:00.000Z",
      lastRunResult: { totalProcessed: 5, successCount: 4, failureCount: 1 },
      nextRunAt: "2026-01-01T01:00:00.000Z",
    });
  });

  it("loads persisted scheduler config when no live provider exists", async () => {
    const repo = stubRepository({
      getSchedulerConfig: vi.fn(async () => ({ intervalMinutes: 60, isEnabled: false })),
    });
    const telemetry = await getSchedulerTelemetry(repo, null);
    expect(telemetry).toMatchObject({
      isEnabled: false,
      isExecuting: false,
      intervalMinutes: 60,
      lastRunAt: null,
    });
    expect(repo.getSchedulerConfig).toHaveBeenCalledOnce();
  });

  it("returns idle telemetry when the config loader fails", async () => {
    const repo = stubRepository({
      getSchedulerConfig: vi.fn(async () => {
        throw new Error("db down");
      }),
    });
    await expect(getSchedulerTelemetry(repo, null)).resolves.toEqual({
      isEnabled: false,
      isExecuting: false,
      intervalMinutes: 30,
      lastRunAt: null,
      lastRunResult: null,
      nextRunAt: null,
    });
  });
});

describe("dashboard service DTO assembly", () => {
  it("assembles catalog, storage, scheduler, ongoing and recent sections", async () => {
    const repo = stubRepository({
      getOngoingSeasons: vi.fn(async () => [
        {
          seasonId: "s1",
          seriesId: "series-1",
          seriesTitle: "Show",
          seasonTitle: "Season 1",
          seasonNumber: 1,
          posterUrl: null,
          episodeCount: 3,
          lastScrapedAt: null,
          lastScrapeError: null,
        },
      ]),
      getRecentSeries: vi.fn(async () => [
        {
          id: "series-1",
          title: "Show",
          posterUrl: null,
          episodeCount: 3,
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ]),
      getStorageProviderLimits: vi.fn(async () => [{ storageLimitGb: 10 }]),
    });
    const service = createDashboardService(repo, {
      storageUsageProvider: { getTotalUsedBytes: async () => 1024 },
    });
    const dto = await service.getDashboard();
    expect(dto.catalog.totalSeries).toBe(10);
    expect(dto.ongoingSeasons).toHaveLength(1);
    expect(dto.recentSeries).toHaveLength(1);
    expect(dto.storage.totalUsedBytes).toBe(1024);
    expect(dto.scheduler.intervalMinutes).toBe(30);
  });

  it("delegates getCatalogStats to the repository", async () => {
    const repo = stubRepository();
    const service = createDashboardService(repo);
    await service.getCatalogStats();
    expect(repo.getCatalogStats).toHaveBeenCalledOnce();
  });
});
