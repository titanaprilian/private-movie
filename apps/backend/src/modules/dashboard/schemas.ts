import { t } from "elysia";

/**
 * Request validation schemas and OpenAPI metadata for the dashboard HTTP
 * adapter. Kept at the module root so `http.ts` stays a readable route
 * table of contents. Never exported from the module public entry point
 * (`index.ts`) — the public seam stays protocol-agnostic.
 */

export const updateSchedulerConfigBody = t.Object({
  intervalMinutes: t.Optional(t.Number()),
  isEnabled: t.Optional(t.Boolean()),
});

export const getDashboardDetail = {
  tags: ["Dashboard & Scheduler"],
  summary: "Get admin dashboard",
  description:
    "Returns aggregated library statistics, scheduler status, and storage usage.",
};

export const runSchedulerDetail = {
  tags: ["Dashboard & Scheduler"],
  summary: "Run ongoing-season scheduler",
  description:
    "Triggers an immediate run of the ongoing-season sync scheduler.",
};

export const updateSchedulerConfigDetail = {
  tags: ["Dashboard & Scheduler"],
  summary: "Update scheduler config",
  description:
    "Updates the ongoing-season scheduler interval and enabled state.",
};
