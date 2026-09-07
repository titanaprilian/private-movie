import { describe, expect, it, beforeEach } from "vitest";
import { buildApp, request, type App } from "../../utils/app";
import { registerUser, authHeaders } from "../../utils/auth";
import crypto from "node:crypto";

describe("POST /series/:id/seasons/merge (Decommissioned)", () => {
  let app: App;
  let headers: Record<string, string>;

  beforeEach(async () => {
    app = await buildApp();
    const user = await registerUser(app, {
      email: `merge-tester-${crypto.randomUUID()}@example.com`,
      password: "password123",
      name: "Merge Tester",
    });
    headers = authHeaders(user.accessToken);
  });

  it("returns 404 Not Found when invoked", async () => {
    const seriesId = crypto.randomUUID();
    const result = await request(app, {
      method: "POST",
      path: `/series/${seriesId}/seasons/merge`,
      headers,
      body: { orderedSeasonIds: [crypto.randomUUID(), crypto.randomUUID()] },
    });

    expect(result.status).toBe(404);
  });
});
