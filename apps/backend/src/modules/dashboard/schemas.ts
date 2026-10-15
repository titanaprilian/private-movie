import { t } from "elysia";
import type { AuthenticationService } from "@repo/contracts";
import type { DbClient } from "@repo/db";
import type { OngoingSeasonScheduler } from "../media/scheduler";
import type { StorageUsageProvider } from "./internal/types";

/**
 * Request validation schemas and OpenAPI metadata for the dashboard HTTP
 * adapter. Kept at the module root so `http.ts` stays a readable route
 * table of contents. Never exported from the module public entry point
 * (`index.ts`) — the public seam stays protocol-agnostic.
 */

export interface DashboardRoutesOptions {
  db: DbClient;
  authService: AuthenticationService;
  scheduler?: Pick<
    OngoingSeasonScheduler,
    | "runNow"
    | "isEnabled"
    | "isExecuting"
    | "getIntervalMs"
    | "getLastRunAt"
    | "getLastRunResult"
    | "getNextRunAt"
    | "setEnabled"
    | "updateInterval"
  >;
  storageUsageProvider?: StorageUsageProvider;
  storageService?: StorageUsageProvider;
}

export const updateSchedulerConfigBody = t.Object({
  intervalMinutes: t.Optional(t.Number()),
  isEnabled: t.Optional(t.Boolean()),
});

export const getDashboardRouteSchema = {
  detail: {
    tags: ["Dashboard & Scheduler"],
    summary: "Get admin dashboard",
    description:
      "Returns aggregated library statistics, scheduler status, and storage usage.",
  },
};

export const runSchedulerRouteSchema = {
  detail: {
    tags: ["Dashboard & Scheduler"],
    summary: "Run ongoing-season scheduler",
    description:
      "Triggers an immediate run of the ongoing-season sync scheduler.",
  },
};

export const updateSchedulerConfigRouteSchema = {
  body: updateSchedulerConfigBody,
  detail: {
    tags: ["Dashboard & Scheduler"],
    summary: "Update scheduler config",
    description:
      "Updates the ongoing-season scheduler interval and enabled state.",
  },
};
