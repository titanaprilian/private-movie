import { describe, expect, it, beforeAll } from "vitest";
import { buildApp, request } from "../../utils/app";
import type { App } from "../../utils/app";

describe("health route", () => {
  let app: App;

  beforeAll(async () => {
    app = await buildApp();
  });

  it("returns 200 with status ok and db true against the real test database", async () => {
    const response = await request(app, {
      path: "/health",
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok", db: true });
  });
});