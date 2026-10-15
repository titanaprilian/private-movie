export {
  createDashboardService,
  computePercentUsed,
  getSchedulerTelemetry,
  getStorageStats,
  GB_IN_BYTES,
  STORAGE_USAGE_TIMEOUT_MS,
  type DashboardService,
  type DashboardServiceOptions,
  type SchedulerTelemetryProvider,
  type StorageUsageProvider,
} from "./internal/service";
export {
  createDashboardRepository,
  type DashboardRepository,
  type DashboardDb,
  type StorageProviderLimit,
  type SchedulerConfig,
} from "./internal/repository";
// Scheduler persistence lives in the media domain; re-exported here so
// dashboard admin endpoints keep working without route changes.
export {
  loadSchedulerConfig,
  saveSchedulerConfig,
  validateSchedulerConfigInput,
  ALLOWED_SCHEDULER_INTERVALS,
  DEFAULT_SCHEDULER_INTERVAL_MINUTES,
  DEFAULT_SCHEDULER_ENABLED,
} from "../media";
