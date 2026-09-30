import { queryOptions } from '@tanstack/react-query';
import { api, extractErrorMessage } from '@/lib/api';
import type {
  AdminDashboardCatalogStats,
  AdminDashboardDto,
  AdminDashboardOngoingSeason,
  AdminDashboardRecentSeries,
  AdminDashboardSchedulerTelemetry,
  AdminDashboardStorageStats,
  UpdateSchedulerConfigDto,
} from '@repo/contracts';

export type { AdminDashboardCatalogStats, AdminDashboardDto, AdminDashboardOngoingSeason, AdminDashboardRecentSeries, AdminDashboardSchedulerTelemetry, AdminDashboardStorageStats, UpdateSchedulerConfigDto };

export const SCHEDULER_INTERVAL_PRESETS = [
  { minutes: 15, label: '15m' },
  { minutes: 30, label: '30m' },
  { minutes: 60, label: '1h' },
  { minutes: 180, label: '3h' },
  { minutes: 360, label: '6h' },
  { minutes: 720, label: '12h' },
  { minutes: 1440, label: '24h' },
] as const;

export const SCHEDULER_POLLING_ACTIVE_MS = 5000;
export const SCHEDULER_POLLING_IDLE_MS = 60000;

export async function fetchAdminDashboard(): Promise<AdminDashboardDto> {
  const res = await api.admin.dashboard.get();

  if (res.error || !res.data || !('data' in res.data) || !res.data.data) {
    throw new Error(
      extractErrorMessage(res.error, 'Failed to fetch dashboard')
    );
  }

  return res.data.data as AdminDashboardDto;
}

export function resolveDashboardRefetchInterval(
  data: AdminDashboardDto | undefined
): number {
  return data?.scheduler.isExecuting
    ? SCHEDULER_POLLING_ACTIVE_MS
    : SCHEDULER_POLLING_IDLE_MS;
}

export function adminDashboardQueryOptions() {
  return queryOptions({
    queryKey: ['admin-dashboard'],
    queryFn: fetchAdminDashboard,
    // Adaptive polling: fast while a scrape run is executing, slow when idle.
    // placeholderData keeps the previous payload so background revalidation
    // updates values in place without unmounting or resetting scroll.
    refetchInterval: (query) =>
      resolveDashboardRefetchInterval(query.state.data as AdminDashboardDto | undefined),
    placeholderData: (previousData) => previousData,
  });
}

export interface ScrapeOngoingSeasonResult {
  seasonId: string;
  seriesId: string;
  success: boolean;
  tmdbSynced: boolean;
  episodesScraped: number;
  sourcesSaved: number;
  seasonCompleted: boolean;
  error?: string | null;
}

export async function scrapeOngoingSeason(
  seasonId: string
): Promise<ScrapeOngoingSeasonResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (api.seasons as any)[seasonId]['scrape-ongoing'].post();

  if (res.error || !res.data || !('data' in res.data) || !res.data.data) {
    throw new Error(
      extractErrorMessage(res.error, 'Failed to auto-scrape ongoing season')
    );
  }

  return res.data.data as ScrapeOngoingSeasonResult;
}

export interface SchedulerRunResult {
  started: boolean;
  alreadyExecuting: boolean;
  isExecuting: boolean;
  result: {
    totalProcessed: number;
    successCount: number;
    failureCount: number;
  } | null;
}

export async function runSchedulerScrapeAll(): Promise<SchedulerRunResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (api.admin as any).scheduler.run.post();

  if (res.error || !res.data || !('data' in res.data) || !res.data.data) {
    throw new Error(
      extractErrorMessage(res.error, 'Failed to trigger global scrape')
    );
  }

  return res.data.data as SchedulerRunResult;
}

export interface SchedulerConfigResult {
  intervalMinutes: number;
  isEnabled: boolean;
}

export async function updateSchedulerConfig(
  dto: UpdateSchedulerConfigDto
): Promise<SchedulerConfigResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (api.admin as any).scheduler.config.patch(dto);

  if (res.error || !res.data || !('data' in res.data) || !res.data.data) {
    throw new Error(
      extractErrorMessage(res.error, 'Failed to update scheduler configuration')
    );
  }

  return res.data.data as SchedulerConfigResult;
}
