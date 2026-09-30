/**
 * Canonical contracts for the Admin Dashboard overview.
 * Tracer bullet covers catalog KPI stats; storage/scheduler/ongoing/recent
 * shapes are included for forward compatibility with the full spec (#614).
 */

export interface AdminDashboardCatalogStats {
  totalSeries: number;
  ongoingSeriesCount: number;
  featuredSeriesCount: number;
  totalSeasons: number;
  totalEpisodes: number;
  totalGenres: number;
}

export interface AdminDashboardStorageStats {
  totalUsedBytes: number;
  totalLimitBytes: number;
  percentUsed: number;
  providerCount: number;
}

export interface AdminDashboardSchedulerTelemetry {
  isEnabled: boolean;
  isExecuting: boolean;
  intervalMinutes: number;
  lastRunAt: string | null;
  lastRunResult: {
    totalProcessed: number;
    successCount: number;
    failureCount: number;
  } | null;
  nextRunAt: string | null;
}

export interface AdminDashboardOngoingSeason {
  seasonId: string;
  seriesId: string;
  seriesTitle: string;
  seasonTitle: string;
  seasonNumber: number | null;
  posterUrl: string | null;
  episodeCount: number;
  lastScrapedAt: string | null;
  lastScrapeError: string | null;
}

export interface AdminDashboardRecentSeries {
  id: string;
  title: string;
  posterUrl: string | null;
  episodeCount: number;
  updatedAt: string;
}

export interface AdminDashboardDto {
  catalog: AdminDashboardCatalogStats;
  storage: AdminDashboardStorageStats;
  scheduler: AdminDashboardSchedulerTelemetry;
  ongoingSeasons: AdminDashboardOngoingSeason[];
  recentSeries: AdminDashboardRecentSeries[];
}

export interface UpdateSchedulerConfigDto {
  intervalMinutes?: number;
  isEnabled?: boolean;
}

export type AdminDashboardResponse = {
  data: AdminDashboardDto;
};
