import { describe, expect, it, vi } from "vitest";
import { Elysia } from "elysia";
import type { DbClient } from "@repo/db";
import { checkHealth } from "@/modules/health";
import { healthRoutes } from "@/modules/health/http";

const createMockDb = (
  unsafeMock: (query: string) => Promise<unknown[]>,
): DbClient => {
  return {
    $client: {
      unsafe: vi.fn(unsafeMock),
    },
  } as unknown as DbClient;
};

describe("health service (checkHealth)", () => {
  it("returns true when database query returns exactly one row", async () => {
    const db = createMockDb(async () => [{ ok: 1 }]);
    const result = await checkHealth(db);
    expect(result).toBe(true);
  });

  it("returns false when database query returns empty rows", async () => {
    const db = createMockDb(async () => []);
    const result = await checkHealth(db);
    expect(result).toBe(false);
  });

  it("returns false when database query returns more than one row", async () => {
    const db = createMockDb(async () => [{ ok: 1 }, { ok: 2 }]);
    const result = await checkHealth(db);
    expect(result).toBe(false);
  });

  it("propagates error when database query rejects", async () => {
    const db = createMockDb(async () => {
      throw new Error("connection lost");
    });
    await expect(checkHealth(db)).rejects.toThrow("connection lost");
  });
});

describe("health routes (healthRoutes)", () => {
  it("returns status ok and db true when database is healthy", async () => {
    const db = createMockDb(async () => [{ ok: 1 }]);
    const app = new Elysia().use(healthRoutes({ db }));

    const res = await app.handle(new Request("http://localhost/health"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: "ok", db: true });
  });

  it("returns status ok and db false when query returns no rows", async () => {
    const db = createMockDb(async () => []);
    const app = new Elysia().use(healthRoutes({ db }));

    const res = await app.handle(new Request("http://localhost/health"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: "ok", db: false });
  });

  it("returns 500 status when database query fails", async () => {
    const db = createMockDb(async () => {
      throw new Error("database offline");
    });
    const app = new Elysia().use(healthRoutes({ db }));

    const res = await app.handle(new Request("http://localhost/health"));
    expect(res.status).toBe(500);
  });
});
