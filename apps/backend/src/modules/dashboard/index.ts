export { createDashboardService, type DashboardService, type SchedulerTelemetryProvider, type StorageUsageProvider, type DashboardServiceOptions } from "./internal/dashboard-service";
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
