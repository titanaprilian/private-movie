import type {
  AdminDashboardCatalogStats,
  AdminDashboardDto,
  AdminDashboardSchedulerTelemetry,
  AdminDashboardStorageStats,
} from "@repo/contracts";
import type { StorageService } from "../../storage";
import type { DashboardRepository } from "./repository";

export const GB_IN_BYTES = 1024 * 1024 * 1024;

export const STORAGE_USAGE_TIMEOUT_MS = 2500;

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

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("StorageUsageTimeout")), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  }) as Promise<T>;
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

export function computePercentUsed(totalUsedBytes: number, totalLimitBytes: number): number {
  return totalLimitBytes > 0 && totalUsedBytes > 0
    ? Number(Math.min(100, (totalUsedBytes / totalLimitBytes) * 100).toFixed(2))
    : 0;
}

export async function getStorageStats(
  repository: Pick<DashboardRepository, "getStorageProviderLimits">,
  storageUsageProvider?: StorageUsageProvider | null,
  timeoutMs: number = STORAGE_USAGE_TIMEOUT_MS,
): Promise<AdminDashboardStorageStats> {
  const providers = await repository.getStorageProviderLimits();
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
      const used = await withTimeout(storageUsageProvider.getTotalUsedBytes(), timeoutMs);
      if (typeof used === "number" && Number.isFinite(used) && used > 0) {
        totalUsedBytes = Math.floor(used);
      }
    } catch {
      totalUsedBytes = 0;
    }
  }
  return {
    totalUsedBytes,
    totalLimitBytes,
    percentUsed: computePercentUsed(totalUsedBytes, totalLimitBytes),
    providerCount,
  };
}

export async function getSchedulerTelemetry(
  repository: Pick<DashboardRepository, "getSchedulerConfig">,
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
    const config = await repository.getSchedulerConfig();
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

export function createDashboardService(
  repository: DashboardRepository,
  options?: DashboardServiceOptions,
): DashboardService {
  return {
    async getCatalogStats(): Promise<AdminDashboardCatalogStats> {
      return repository.getCatalogStats();
    },

    async getDashboard(): Promise<AdminDashboardDto> {
      const catalog = await repository.getCatalogStats();
      const storage = await getStorageStats(
        repository,
        options?.storageUsageProvider ?? null,
        options?.storageTimeoutMs ?? STORAGE_USAGE_TIMEOUT_MS,
      );
      const ongoingSeasons = await repository.getOngoingSeasons();
      const recentSeries = await repository.getRecentSeries();
      const scheduler = await getSchedulerTelemetry(repository, options?.scheduler ?? null);
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
