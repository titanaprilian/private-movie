import { Elysia } from "elysia";
import { authGuard } from "../../lib/auth";
import { errorResponse, successResponse } from "../../lib/response";
import { saveSchedulerConfig, validateSchedulerConfigInput } from "../media";
import { createDashboardRepository } from "./internal/repository";
import { createDashboardService } from "./internal/service";
import {
  getDashboardRouteSchema,
  runSchedulerRouteSchema,
  updateSchedulerConfigRouteSchema,
  type DashboardRoutesOptions,
} from "./schemas";

export type { DashboardRoutesOptions } from "./schemas";

export const dashboardRoutes = (options: DashboardRoutesOptions) => {
  const repository = createDashboardRepository(options.db);
  const dashboardService = createDashboardService(repository, {
    scheduler: options.scheduler ?? undefined,
    storageUsageProvider:
      options.storageUsageProvider ?? options.storageService ?? undefined,
  });
  const auth = authGuard(options.authService);

  return new Elysia({ name: "dashboard-routes" })
    .get(
      "/admin/dashboard",
      async () => successResponse(await dashboardService.getDashboard()),
      { ...getDashboardRouteSchema, beforeHandle: auth },
    )
    .post(
      "/admin/scheduler/run",
      async ({ set }) => {
        if (!options.scheduler)
          return errorResponse(set, 503, new Error("Scheduler unavailable"));
        if (options.scheduler.isExecuting()) {
          set.status = 409;
          return successResponse({
            started: false,
            alreadyExecuting: true,
            isExecuting: true,
          });
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
      { ...runSchedulerRouteSchema, beforeHandle: auth },
    )
    .patch(
      "/admin/scheduler/config",
      async ({ body, set }) => {
        const validation = validateSchedulerConfigInput(
          body as { intervalMinutes?: unknown; isEnabled?: unknown },
        );
        if (!validation.valid) {
          return errorResponse(
            set,
            400,
            new Error(validation.message ?? "Invalid scheduler config"),
          );
        }
        const input = body as { intervalMinutes?: number; isEnabled?: boolean };
        const saved = await saveSchedulerConfig(options.db, {
          intervalMinutes: input.intervalMinutes,
          isEnabled: input.isEnabled,
        });
        options.scheduler?.updateInterval(saved.intervalMinutes * 60000);
        options.scheduler?.setEnabled(saved.isEnabled);
        return successResponse({
          intervalMinutes: saved.intervalMinutes,
          isEnabled: saved.isEnabled,
        });
      },
      { ...updateSchedulerConfigRouteSchema, beforeHandle: auth },
    );
};
