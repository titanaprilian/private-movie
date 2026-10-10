import type { UseQueryResult } from '@tanstack/react-query';
import type { UseMutationResult } from '@tanstack/react-query';
import type {
  AdminDashboardCatalogStats,
  AdminDashboardDto,
  AdminDashboardOngoingSeason,
  AdminDashboardRecentSeries,
  AdminDashboardSchedulerTelemetry,
  AdminDashboardStorageStats,
  ScrapeOngoingSeasonResult,
  SchedulerConfigResult,
  SchedulerRunResult,
} from './api';

export type {
  AdminDashboardCatalogStats,
  AdminDashboardDto,
  AdminDashboardOngoingSeason,
  AdminDashboardRecentSeries,
  AdminDashboardSchedulerTelemetry,
  AdminDashboardStorageStats,
  ScrapeOngoingSeasonResult,
  SchedulerConfigResult,
  SchedulerRunResult,
};

export type { ActivityEvent, ActivityEventKind } from './formatters';

export interface StatsRowProps {
  catalog?: AdminDashboardCatalogStats | null;
  storage?: AdminDashboardStorageStats | null;
}

export interface SchedulerPanelProps {
  scheduler?: AdminDashboardSchedulerTelemetry | null;
  ongoingFailureCount?: number;
  isScrapeAllRunning: boolean;
  configPending: boolean;
  onScrapeAll: () => void;
  onIntervalChange: (minutes: number) => void;
  onToggle: () => void;
}

export interface OngoingSeriesGridProps {
  seasons: AdminDashboardOngoingSeason[];
  scrapingSeasonId: string | null;
  onScrape: (seasonId: string) => void;
}

export interface ActivityFeedProps {
  ongoingSeasons: AdminDashboardOngoingSeason[];
  recentSeries: AdminDashboardRecentSeries[];
}

export interface StatCardProps {
  testId: string;
  label: string;
  value: string;
  valueTestId: string;
  footer?: React.ReactNode;
  iconBadge: React.ReactNode;
}

export interface OngoingCardProps {
  item: AdminDashboardOngoingSeason;
  isScraping: boolean;
  onScrape: () => void;
}

export interface ActivityTagProps {
  kind: 'failed' | 'updated';
}

export interface DashboardHeaderProps {
  isFetching: boolean;
  onRefresh: () => void;
}

/** Client-side page size for the ongoing series grid. */
export const ONGOING_PAGE_SIZE = 9;

export interface SchedulerConfigUpdate {
  intervalMinutes?: number;
  isEnabled?: boolean;
}

export interface UseDashboardReturn {
  dashboardQuery: UseQueryResult<AdminDashboardDto, Error>;
  catalog: AdminDashboardCatalogStats | undefined;
  storage: AdminDashboardStorageStats | undefined;
  scheduler: AdminDashboardSchedulerTelemetry | undefined;
  ongoingSeasons: AdminDashboardOngoingSeason[];
  recentSeries: AdminDashboardRecentSeries[];
  handleRefresh: () => void;
  scrapeMutation: UseMutationResult<
    ScrapeOngoingSeasonResult,
    Error,
    string,
    unknown
  >;
  scrapeAllMutation: UseMutationResult<SchedulerRunResult, Error, void, unknown>;
  configMutation: UseMutationResult<
    SchedulerConfigResult,
    Error,
    SchedulerConfigUpdate,
    unknown
  >;
  isScrapeAllRunning: boolean;
  scrapingSeasonId: string | null;
  ongoingFailureCount: number;
}
