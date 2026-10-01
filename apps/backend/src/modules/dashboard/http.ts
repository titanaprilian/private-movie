import { Elysia, t } from "elysia";
import type { AuthenticationService } from "@repo/contracts";
import type { DbClient } from "@repo/db";
import { authGuard } from "../../lib/auth";
import { errorResponse, successResponse } from "../../lib/response";
import type { OngoingSeasonScheduler } from "../media/scheduler";
import { createDashboardService, type StorageUsageProvider } from "./internal/dashboard-service";
import {
  saveSchedulerConfig,
  validateSchedulerConfigInput,
} from "./internal/scheduler-config";

export interface DashboardRoutesOptions {
  db: DbClient;
  authService: AuthenticationService;
  scheduler?: Pick<
    OngoingSeasonScheduler,
    "runNow" | "isEnabled" | "isExecuting" | "getIntervalMs" | "getLastRunAt" | "getLastRunResult" | "getNextRunAt" | "setEnabled" | "updateInterval"
  > | null;
  storageUsageProvider?: StorageUsageProvider | null;
}

export const dashboardRoutes = (options: DashboardRoutesOptions) => {
  const dashboardService = createDashboardService(options.db, {
    scheduler: options.scheduler ?? null,
    storageUsageProvider: options.storageUsageProvider ?? null,
  });
  const auth = authGuard(options.authService);

  return new Elysia({ name: "dashboard-routes" })
    .get(
      "/admin/dashboard",
      async () => {
        const dashboard = await dashboardService.getDashboard();
        return successResponse(dashboard);
      },
      {
        beforeHandle: auth,
        detail: {
          tags: ["Dashboard & Scheduler"],
          summary: "Get admin dashboard",
          description: "Returns aggregated library statistics, scheduler status, and storage usage.",
        },
      },
    )
    .post(
      "/admin/scheduler/run",
      async ({ set }) => {
        if (!options.scheduler) {
          return errorResponse(set, 503, new Error("SchedulerUnavailable"));
        }
        if (options.scheduler.isExecuting()) {
          set.status = 409;
          return {
            data: {
              started: false,
              alreadyExecuting: true,
              isExecuting: true,
            },
          };
        }
        const result = await options.scheduler.runNow();
        return successResponse({
          started: true,
          alreadyExecuting: false,
          isExecuting: options.scheduler.isExecuting(),
          result: result
            ? {
                totalProcessed: result.totalProcessed,
                successCount: result.successCount,
                failureCount: result.failureCount,
              }
            : null,
        });
      },
      {
        beforeHandle: auth,
        detail: {
          tags: ["Dashboard & Scheduler"],
          summary: "Run ongoing-season scheduler",
          description: "Triggers an immediate run of the ongoing-season sync scheduler.",
        },
      },
    )
    .patch(
      "/admin/scheduler/config",
      async ({ body, set }) => {
        const input = body as { intervalMinutes?: unknown; isEnabled?: unknown };
        const validation = validateSchedulerConfigInput(input);
        if (!validation.valid) {
          set.status = 400;
          return {
            error: { code: "VALIDATION", message: validation.message ?? "invalid scheduler config" },
          };
        }
        const saved = await saveSchedulerConfig(options.db, {
          intervalMinutes: input.intervalMinutes as number | undefined,
          isEnabled: input.isEnabled as boolean | undefined,
        });
        if (options.scheduler) {
          options.scheduler.updateInterval(saved.intervalMinutes * 60000);
          options.scheduler.setEnabled(saved.isEnabled);
        }
        return successResponse({
          intervalMinutes: saved.intervalMinutes,
          isEnabled: saved.isEnabled,
        });
      },
      {
        beforeHandle: auth,
        body: t.Object({
          intervalMinutes: t.Optional(t.Number()),
          isEnabled: t.Optional(t.Boolean()),
        }),
        detail: {
          tags: ["Dashboard & Scheduler"],
          summary: "Update scheduler config",
          description: "Updates the ongoing-season scheduler interval and enabled state.",
        },
      },
    );
};
