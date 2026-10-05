import { describe, it, expect } from "vitest";
import { Elysia, t } from "elysia";
import { errorHandlerPlugin } from "@/plugins/error-handler";
import { FileTooLargeError } from "@/lib/errors";

interface LogRecord {
  level: "warn" | "error";
  obj: unknown;
  msg?: string;
}

function memoryLogger() {
  const records: LogRecord[] = [];
  return {
    records,
    logger: {
      warn: (obj: unknown, msg?: string) => void records.push({ level: "warn", obj, msg }),
      error: (obj: unknown, msg?: string) => void records.push({ level: "error", obj, msg }),
    },
  };
}

function captureSpy() {
  const calls: Array<{ error: unknown; context?: Record<string, unknown> }> = [];
  return {
    calls,
    capture: (error: unknown, context?: Record<string, unknown>) =>
      void calls.push({ error, context }),
  };
}

describe("errorHandlerPlugin observability", () => {
  it("400 validation errors log a warn breakdown and never reach Sentry", async () => {
    const { records, logger } = memoryLogger();
    const { calls, capture } = captureSpy();
    const app = new Elysia()
      .use(errorHandlerPlugin({ logger, captureException: capture }))
      .post("/items", ({ body }) => body, {
        body: t.Object({ name: t.String() }),
      });

    const response = await app.handle(
      new Request("http://localhost/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: 42 }),
      })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: { code: "VALIDATION", message: "request validation failed" },
    });

    expect(calls).toHaveLength(0);
    expect(records).toHaveLength(1);
    expect(records[0].level).toBe("warn");
    const logged = records[0].obj as Record<string, unknown>;
    expect(logged.route).toBe("/items");
    expect(logged.status).toBe(400);
    expect(Array.isArray(logged.validationIssues)).toBe(true);
    expect((logged.validationIssues as unknown[]).length).toBeGreaterThan(0);
  });

  it("4xx domain errors log route, status, and code at warn without Sentry", async () => {
    const { records, logger } = memoryLogger();
    const { calls, capture } = captureSpy();
    const app = new Elysia()
      .use(errorHandlerPlugin({ logger, captureException: capture }))
      .get("/big", () => {
        throw new FileTooLargeError();
      });

    const response = await app.handle(new Request("http://localhost/big"));

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({
      error: {
        code: "FILE_TOO_LARGE",
        message: "File size exceeds the maximum allowed limit of 1GB",
      },
    });

    expect(calls).toHaveLength(0);
    expect(records).toHaveLength(1);
    expect(records[0].level).toBe("warn");
    expect(records[0].obj).toMatchObject({
      route: "/big",
      status: 413,
      code: "FILE_TOO_LARGE",
    });
  });

  it("500 unhandled errors invoke Sentry capture and log error with stack", async () => {
    const { records, logger } = memoryLogger();
    const { calls, capture } = captureSpy();
    const app = new Elysia()
      .use(errorHandlerPlugin({ logger, captureException: capture }))
      .get("/boom", () => {
        throw new Error("kaboom");
      });

    const response = await app.handle(new Request("http://localhost/boom"));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: { code: "INTERNAL_SERVER", message: "internal server error" },
    });

    expect(calls).toHaveLength(1);
    expect(calls[0].error).toEqual(expect.any(Error));
    expect(calls[0].context).toMatchObject({ route: "/boom" });

    expect(records).toHaveLength(1);
    expect(records[0].level).toBe("error");
    const logged = records[0].obj as Record<string, unknown>;
    expect(logged.route).toBe("/boom");
    expect(logged.status).toBe(500);
    expect((logged.err as Error | undefined)?.stack).toContain("kaboom");
  });

  it("404s pass through without logging or Sentry", async () => {
    const { records, logger } = memoryLogger();
    const { calls, capture } = captureSpy();
    const app = new Elysia().use(
      errorHandlerPlugin({ logger, captureException: capture })
    );

    const response = await app.handle(
      new Request("http://localhost/nonexistent")
    );

    expect(response.status).toBe(404);
    expect(records).toHaveLength(0);
    expect(calls).toHaveLength(0);
  });
});
