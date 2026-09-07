import { describe, expect, it, beforeAll } from "vitest";
import { buildApp, request, type App } from "../../utils/app";
import { registerUser, authHeaders } from "../../utils/auth";
import crypto from "node:crypto";

describe("Season Episode TMDB Sync API (Decommissioned)", () => {
  let app: App;
  let headers: Record<string, string>;

  beforeAll(async () => {
    app = await buildApp();
    const user = await registerUser(app, {
      email: `episodes-tmdb-sync-decom-${crypto.randomUUID()}@example.com`,
      password: "password123",
      name: "Episode TMDB Tester",
    });
    headers = authHeaders(user.accessToken);
  });

  describe("GET /seasons/:id/episodes/tmdb-preview", () => {
    it("returns 404 Not Found when invoked", async () => {
      const seasonId = crypto.randomUUID();
      const result = await request(app, {
        method: "GET",
        path: `/seasons/${seasonId}/episodes/tmdb-preview?tmdbId=100&tmdbSeason=1`,
        headers,
      });

      expect(result.status).toBe(404);
    });
  });

  describe("POST /seasons/:id/episodes/tmdb-sync", () => {
    it("returns 404 Not Found when invoked", async () => {
      const seasonId = crypto.randomUUID();
      const result = await request(app, {
        method: "POST",
        path: `/seasons/${seasonId}/episodes/tmdb-sync`,
        headers,
        body: { tmdbId: 100, tmdbSeason: 1 },
      });

      expect(result.status).toBe(404);
    });
  });
});

