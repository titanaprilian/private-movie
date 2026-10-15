import type {
  AdminDashboardCatalogStats,
  AdminDashboardDto,
  AdminDashboardOngoingSeason,
  AdminDashboardRecentSeries,
} from "@repo/contracts";
import type { DbClient } from "@repo/db";
import type { StorageService } from "../../storage";

export type DashboardDb = Pick<
  DbClient,
  "select" | "selectDistinct" | "insert"
> & {
  // Allow the concrete Drizzle PostgresJsDatabase while keeping the
  // repository unit-testable against narrower fakes.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
};

export interface StorageProviderLimit {
  storageLimitGb: number | null;
}

export interface SchedulerConfig {
  intervalMinutes: number;
  isEnabled: boolean;
}

export interface DashboardRepository {
  getCatalogStats(): Promise<AdminDashboardCatalogStats>;
  getOngoingSeasons(): Promise<AdminDashboardOngoingSeason[]>;
  getRecentSeries(): Promise<AdminDashboardRecentSeries[]>;
  getStorageProviderLimits(): Promise<StorageProviderLimit[]>;
  getSchedulerConfig(): Promise<SchedulerConfig>;
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
  storageTimeoutMs?: number;
}

export interface DashboardService {
  getCatalogStats(): Promise<AdminDashboardCatalogStats>;
  getDashboard(): Promise<AdminDashboardDto>;
}
