import { describe, it, expect } from "vitest";
import { Elysia } from "elysia";
import { requestLoggerPlugin, REQUEST_ID_HEADER } from "@/plugins/request-logger";

function memoryLogger() {
  const records: Array<{ obj: unknown; msg?: string }> = [];
  return {
    records,
    logger: {
      info: (obj: unknown, msg?: string) => void records.push({ obj, msg }),
    },
  };
}

async function buildApp(logger: { info: (...args: never[]) => void }) {
  return new Elysia()
    .use(requestLoggerPlugin({ logger: logger as never }))
    .get("/ping", () => "pong")
    .get("/boom", () => {
      throw new Error("kaboom");
    });
}

describe("requestLoggerPlugin", () => {
  it("stamps responses with a generated x-request-id", async () => {
    const { records, logger } = memoryLogger();
    const app = await buildApp(logger);

    const res = await app.handle(new Request("http://localhost/ping"));
    expect(res.status).toBe(200);
    const requestId = res.headers.get(REQUEST_ID_HEADER);
    expect(requestId).toBeTruthy();
    expect(records).toHaveLength(1);
    const logged = (records[0].obj ?? {}) as Record<string, unknown>;
    expect(logged.method).toBe("GET");
    expect(logged.path).toBe("/ping");
    expect(logged.status).toBe(200);
    expect(logged.requestId).toBe(requestId);
    expect(typeof logged.durationMs).toBe("number");
  });

  it("reuses an incoming x-request-id and reflects it back", async () => {
    const { records, logger } = memoryLogger();
    const app = await buildApp(logger);

    const res = await app.handle(
      new Request("http://localhost/ping", {
        headers: { [REQUEST_ID_HEADER]: "incoming-id-123" },
      })
    );
    expect(res.headers.get(REQUEST_ID_HEADER)).toBe("incoming-id-123");
    const logged = (records[0].obj ?? {}) as Record<string, unknown>;
    expect(logged.requestId).toBe("incoming-id-123");
  });

  it("logs error responses with status and request id", async () => {
    const { records, logger } = memoryLogger();
    const app = new Elysia()
      .use(requestLoggerPlugin({ logger: logger as never }))
      .onError(() => new Response("oops", { status: 500 }))
      .get("/boom", () => {
        throw new Error("kaboom");
      });
    const res = await app.handle(new Request("http://localhost/boom"));
    expect(res.headers.get(REQUEST_ID_HEADER)).toBeTruthy();
    expect(records).toHaveLength(1);
    expect((records[0].obj as Record<string, unknown>).status).toBe(500);
  });

  it("createApp stamps x-request-id on API responses", async () => {
    const { createApp } = await import("@/app");
    const app = createApp({
      db: {} as never,
      auth: {} as never,
      storageService: { getTotalUsedBytes: async () => null } as never,
    });
    const res = await app.handle(new Request("http://localhost/nonexistent"));
    expect(res.headers.get(REQUEST_ID_HEADER)).toBeTruthy();
  });

  it("propagates to routes registered after the plugin (global scope)", async () => {
    const { records, logger } = memoryLogger();
    const app = new Elysia()
      .use(requestLoggerPlugin({ logger: logger as never }))
      .group("/api", (group) =>
        group.get("/late", () => "late").get("/later", () => "later")
      );

    for (const path of ["/api/late", "/api/later"]) {
      const res = await app.handle(new Request(`http://localhost${path}`));
      expect(res.status).toBe(200);
      expect(res.headers.get(REQUEST_ID_HEADER)).toBeTruthy();
    }

    expect(records).toHaveLength(2);
    const paths = (records.map((r) => (r.obj as Record<string, unknown>).path) as string[]).sort();
    expect(paths).toEqual(["/api/late", "/api/later"]);
    const ids = records.map((r) => (r.obj as Record<string, unknown>).requestId);
    expect(new Set(ids).size).toBe(2);
  });
});
