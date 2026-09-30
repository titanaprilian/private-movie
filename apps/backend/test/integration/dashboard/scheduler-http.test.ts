import { describe, expect, it, beforeAll } from "vitest";
import { eq } from "drizzle-orm";
import { system as systemTable } from "@repo/db";
import type { AdminDashboardDto } from "@repo/contracts";
import { buildApp, request, type App } from "../../utils/app";
import { registerUser, authHeaders } from "../../utils/auth";
import { db } from "../../utils/db";

type DataResponse<T> = { data: T };

describe("scheduler endpoints", () => {
  let app: App;
  let headers: Record<string, string>;

  beforeAll(async () => {
    app = await buildApp();
    const auth = await registerUser(app);
    headers = authHeaders(auth.accessToken);
  });

  it("returns 401 without a Bearer token", async () => {
    const runRes = await request(app, { method: "POST", path: "/api/admin/scheduler/run" });
    expect(runRes.status).toBe(401);
    const patchRes = await request(app, {
      method: "PATCH",
      path: "/api/admin/scheduler/config",
      body: { intervalMinutes: 60 },
    });
    expect(patchRes.status).toBe(401);
  });

  it("POST /api/admin/scheduler/run triggers a global scrape pass", async () => {
    const res = await request(app, { method: "POST", path: "/api/admin/scheduler/run", headers });
    expect(res.status).toBe(200);
    const body = res.body as DataResponse<{
      started: boolean;
      alreadyExecuting: boolean;
      result: { totalProcessed: number; successCount: number; failureCount: number } | null;
    }>;
    expect(body.data.started).toBe(true);
    expect(body.data.alreadyExecuting).toBe(false);
    expect(body.data.result).toEqual({ totalProcessed: 0, successCount: 0, failureCount: 0 });
  });

  it("POST /api/admin/scheduler/run returns 409 while a run is executing", async () => {
    const busyApp = await buildApp({
      scheduler: {
        async runNow() {
          return null;
        },
        isEnabled: () => true,
        isExecuting: () => true,
        getIntervalMs: () => 30 * 60000,
        getLastRunAt: () => null,
        getLastRunResult: () => null,
        getNextRunAt: () => new Date(),
        setEnabled: () => {},
        updateInterval: () => {},
      },
    });
    const res = await request(busyApp, {
      method: "POST",
      path: "/api/admin/scheduler/run",
      headers,
    });
    expect(res.status).toBe(409);
  });

  it("PATCH /api/admin/scheduler/config persists settings and reflects in dashboard telemetry", async () => {
    const res = await request(app, {
      method: "PATCH",
      path: "/api/admin/scheduler/config",
      headers,
      body: { intervalMinutes: 60, isEnabled: false },
    });
    expect(res.status).toBe(200);
    const body = res.body as DataResponse<{ intervalMinutes: number; isEnabled: boolean }>;
    expect(body.data).toEqual({ intervalMinutes: 60, isEnabled: false });

    const rows = await db.select().from(systemTable).where(eq(systemTable.key, "scheduler_interval_minutes"));
    expect(rows[0]?.value).toBe("60");
    const enabledRows = await db.select().from(systemTable).where(eq(systemTable.key, "scheduler_enabled"));
    expect(enabledRows[0]?.value).toBe("false");

    const dashRes = await request(app, { path: "/api/admin/dashboard", headers });
    expect(dashRes.status).toBe(200);
    const dashBody = dashRes.body as DataResponse<AdminDashboardDto>;
    expect(dashBody.data.scheduler.intervalMinutes).toBe(60);
    expect(dashBody.data.scheduler.isEnabled).toBe(false);
    expect(dashBody.data.scheduler.nextRunAt).toBeNull();
  });

  it("PATCH /api/admin/scheduler/config rejects intervals outside the preset list", async () => {
    const res = await request(app, {
      method: "PATCH",
      path: "/api/admin/scheduler/config",
      headers,
      body: { intervalMinutes: 7 },
    });
    expect(res.status).toBe(400);
  });

  it("PATCH /api/admin/scheduler/config supports partial updates", async () => {
    await request(app, {
      method: "PATCH",
      path: "/api/admin/scheduler/config",
      headers,
      body: { intervalMinutes: 60, isEnabled: false },
    });
    const res = await request(app, {
      method: "PATCH",
      path: "/api/admin/scheduler/config",
      headers,
      body: { isEnabled: true },
    });
    expect(res.status).toBe(200);
    const body = res.body as DataResponse<{ intervalMinutes: number; isEnabled: boolean }>;
    expect(body.data.isEnabled).toBe(true);
    // Interval persists from the earlier update in this test.
    expect(body.data.intervalMinutes).toBe(60);
  });
});
