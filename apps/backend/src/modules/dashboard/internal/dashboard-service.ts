import { count, desc, eq } from "drizzle-orm";
import {
  episodes,
  genres,
  seasons,
  series,
  storageProviders,
  type DbClient,
} from "@repo/db";
import type {
  AdminDashboardCatalogStats,
  AdminDashboardDto,
  AdminDashboardOngoingSeason,
  AdminDashboardRecentSeries,
  AdminDashboardSchedulerTelemetry,
  AdminDashboardStorageStats,
} from "@repo/contracts";
import { loadSchedulerConfig } from "../../media";

type DashboardDb = Pick<DbClient, "select" | "selectDistinct" | "insert"> & {
  // Allow the concrete Drizzle PostgresJsDatabase while keeping the
  // service unit-testable against narrower fakes.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
};

const GB_IN_BYTES = 1024 * 1024 * 1024;

async function getStorageStats(
  db: DashboardDb,
  storageUsageProvider?: StorageUsageProvider | null,
): Promise<AdminDashboardStorageStats> {
  const providers = await db
    .select({ storageLimitGb: storageProviders.storageLimitGb })
    .from(storageProviders)
    .where(eq(storageProviders.isEnabled, true));
  const providerCount = providers.length;
  const totalLimitBytes = providers.reduce(
    (sum, p) => sum + (p.storageLimitGb ?? 0) * GB_IN_BYTES,
    0,
  );
  // Real usage comes from the storage module's cached S3 inventory scan,
  // injected by the composition root. Any failure (S3 down, no providers,
  // unconfigured credentials) falls back to 0 so the dashboard stays fast
  // and never breaks; the frontend renders "Not tracked" in that case.
  let totalUsedBytes = 0;
  if (storageUsageProvider) {
    try {
      const used = await storageUsageProvider.getTotalUsedBytes();
      if (typeof used === "number" && Number.isFinite(used) && used > 0) {
        totalUsedBytes = Math.floor(used);
      }
    } catch {
      totalUsedBytes = 0;
    }
  }
  const percentUsed =
    totalLimitBytes > 0 && totalUsedBytes > 0
      ? Number(Math.min(100, (totalUsedBytes / totalLimitBytes) * 100).toFixed(2))
      : 0;
  return { totalUsedBytes, totalLimitBytes, percentUsed, providerCount };
}

async function getRecentSeries(db: DashboardDb): Promise<AdminDashboardRecentSeries[]> {
  const rows = await db
    .select({
      id: series.id,
      title: series.title,
      posterUrl: series.posterUrl,
      updatedAt: series.updatedAt,
    })
    .from(series)
    .orderBy(desc(series.updatedAt))
    .limit(5);
  const recent: AdminDashboardRecentSeries[] = [];
  for (const row of rows) {
    const [epRow] = await db
      .select({ value: count() })
      .from(episodes)
      .innerJoin(seasons, eq(episodes.seasonId, seasons.id))
      .where(eq(seasons.seriesId, row.id));
    recent.push({
      id: row.id,
      title: row.title,
      posterUrl: row.posterUrl ?? null,
      episodeCount: epRow?.value ?? 0,
      updatedAt: row.updatedAt.toISOString(),
    });
  }
  return recent;
}

async function getOngoingSeasons(db: DashboardDb): Promise<AdminDashboardOngoingSeason[]> {
  const rows = await db
    .select({
      seasonId: seasons.id,
      seriesId: seasons.seriesId,
      seriesTitle: series.title,
      seasonTitle: seasons.title,
      seasonNumber: seasons.seasonNumber,
      posterUrl: series.posterUrl,
      lastScrapedAt: seasons.lastScrapedAt,
      lastScrapeError: seasons.lastScrapeError,
    })
    .from(seasons)
    .innerJoin(series, eq(seasons.seriesId, series.id))
    .where(eq(seasons.status, "ongoing"));
  const ongoing: AdminDashboardOngoingSeason[] = [];
  for (const row of rows) {
    const [epRow] = await db
      .select({ value: count() })
      .from(episodes)
      .where(eq(episodes.seasonId, row.seasonId));
    ongoing.push({
      seasonId: row.seasonId,
      seriesId: row.seriesId,
      seriesTitle: row.seriesTitle,
      seasonTitle: row.seasonTitle,
      seasonNumber: row.seasonNumber ?? null,
      posterUrl: row.posterUrl ?? null,
      episodeCount: epRow?.value ?? 0,
      lastScrapedAt: row.lastScrapedAt ? row.lastScrapedAt.toISOString() : null,
      lastScrapeError: row.lastScrapeError ?? null,
    });
  }
  return ongoing;
}

async function countOngoingSeries(db: DashboardDb): Promise<number> {
  // Domain convention (see seasons repository): a series is "ongoing" when it
  // has at least one season with status = "ongoing", independent of the
  // series-level isOngoingHighlighted curation flag.
  const rows = await db
    .selectDistinct({ seriesId: seasons.seriesId })
    .from(seasons)
    .where(eq(seasons.status, "ongoing"));
  return rows.length;
}

function idleScheduler(): AdminDashboardSchedulerTelemetry {
  return {
    isEnabled: false,
    isExecuting: false,
    intervalMinutes: 30,
    lastRunAt: null,
    lastRunResult: null,
    nextRunAt: null,
  };
}

export interface SchedulerTelemetryProvider {
  isEnabled(): boolean;
  isExecuting(): boolean;
  getIntervalMs(): number;
  getLastRunAt(): Date | null;
  getLastRunResult(): {
    totalProcessed: number;
    successCount: number;
    failureCount: number;
  } | null;
  getNextRunAt(): Date | null;
}

import type { StorageService } from "../../storage";

/**
 * Supplies real storage usage in bytes (summed across enabled providers).
 * Implemented by the composition root with the storage module's cached S3
 * inventory scan. Return null when usage is unavailable; throw on failure —
 * both are treated as untracked so the dashboard never breaks.
 */
export type StorageUsageProvider = Pick<StorageService, "getTotalUsedBytes">;

export interface DashboardServiceOptions {
  scheduler?: SchedulerTelemetryProvider | null;
  storageUsageProvider?: StorageUsageProvider | null;
}

async function getSchedulerTelemetry(
  db: DashboardDb,
  scheduler?: SchedulerTelemetryProvider | null,
): Promise<AdminDashboardSchedulerTelemetry> {
  if (scheduler) {
    const lastRunAt = scheduler.getLastRunAt();
    const nextRunAt = scheduler.getNextRunAt();
    return {
      isEnabled: scheduler.isEnabled(),
      isExecuting: scheduler.isExecuting(),
      intervalMinutes: Math.round(scheduler.getIntervalMs() / 60000),
      lastRunAt: lastRunAt ? lastRunAt.toISOString() : null,
      lastRunResult: scheduler.getLastRunResult(),
      nextRunAt: nextRunAt ? nextRunAt.toISOString() : null,
    };
  }
  try {
    const config = await loadSchedulerConfig(db);
    return {
      isEnabled: config.isEnabled,
      isExecuting: false,
      intervalMinutes: config.intervalMinutes,
      lastRunAt: null,
      lastRunResult: null,
      nextRunAt: null,
    };
  } catch {
    return idleScheduler();
  }
}

export function createDashboardService(db: DashboardDb, options?: DashboardServiceOptions) {
  return {
    async getCatalogStats(): Promise<AdminDashboardCatalogStats> {
      const [seriesRow] = await db.select({ value: count() }).from(series);
      const ongoingSeriesCount = await countOngoingSeries(db);
      const [featuredRow] = await db
        .select({ value: count() })
        .from(series)
        .where(eq(series.isFeatured, true));
      const [seasonsRow] = await db.select({ value: count() }).from(seasons);
      const [genresRow] = await db.select({ value: count() }).from(genres);
      const [episodesRow] = await db
        .select({ value: count() })
        .from(episodes)
        .innerJoin(seasons, eq(episodes.seasonId, seasons.id));

      return {
        totalSeries: seriesRow?.value ?? 0,
        ongoingSeriesCount,
        featuredSeriesCount: featuredRow?.value ?? 0,
        totalSeasons: seasonsRow?.value ?? 0,
        totalEpisodes: episodesRow?.value ?? 0,
        totalGenres: genresRow?.value ?? 0,
      };
    },

    async getDashboard(): Promise<AdminDashboardDto> {
      const catalog = await this.getCatalogStats();
      const storage = await getStorageStats(db, options?.storageUsageProvider ?? null);
      const ongoingSeasons = await getOngoingSeasons(db);
      const recentSeries = await getRecentSeries(db);
      const scheduler = await getSchedulerTelemetry(db, options?.scheduler ?? null);
      return {
        catalog,
        storage,
        scheduler,
        ongoingSeasons,
        recentSeries,
      };
    },
  };
}

export type DashboardService = ReturnType<typeof createDashboardService>;
