import type { DashboardDb } from "./repository";
import { createDashboardRepository } from "./repository";
import {
  createDashboardService as createRepositoryBackedService,
  type DashboardService,
  type DashboardServiceOptions,
  type SchedulerTelemetryProvider,
  type StorageUsageProvider,
} from "./service";

export type {
  DashboardService,
  DashboardServiceOptions,
  SchedulerTelemetryProvider,
  StorageUsageProvider,
};

/**
 * Backward-compatible factory: builds a repository from the raw db handle
 * and delegates to the repository-backed service. New code should use
 * `createDashboardRepository` + `createDashboardService(repository, options)`
 * from `./service` directly so the service stays unit-testable without a db.
 */
export function createDashboardService(db: DashboardDb, options?: DashboardServiceOptions) {
  const repository = createDashboardRepository(db);
  return createRepositoryBackedService(repository, options);
}
