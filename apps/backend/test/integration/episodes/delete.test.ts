import { describe, expect, it, beforeAll } from "vitest";
import { eq } from "drizzle-orm";
import { episodes, seasons, series } from "@repo/db";
import { buildApp, request, type App } from "../../utils/app";
import { registerUser, authHeaders, signTestToken } from "../../utils/auth";
import { db } from "../../utils/db";

async function ensureSeason(id: string): Promise<string> {
  const [existing] = await db.select().from(seasons).where(eq(seasons.id, id));
  if (existing) return existing.id;

  const now = new Date();
  const [sRow] = await db
    .insert(series)
    .values({
      id: crypto.randomUUID(),
      title: "Test Series",
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  const [seasonRow] = await db
    .insert(seasons)
    .values({
      id,
      seriesId: sRow.id,
      title: "Test Season",
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return seasonRow.id;
}

async function insertEpisode(): Promise<{ id: string }> {
  const now = new Date();
  const seasonId = await ensureSeason(crypto.randomUUID());
  const rows = await db
    .insert(episodes)
    .values({
      id: crypto.randomUUID(),
      seasonId,
      title: "delete-endpoint",
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return rows[0];
}

describe("DELETE /episodes/:id", () => {
  let app: App;

  beforeAll(async () => {
    app = await buildApp();
  });

  describe("authentication", () => {
    it("returns 401 when authorization header is missing", async () => {
      const missingId = crypto.randomUUID();

      const response = await request(app, {
        method: "DELETE",
        path: `/episodes/${missingId}`,
      });

      expect(response.status).toBe(401);
    });

    it("returns 401 when authorization token is invalid or expired", async () => {
      const missingId = crypto.randomUUID();

      const invalidTokenResponse = await request(app, {
        method: "DELETE",
        path: `/episodes/${missingId}`,
        headers: authHeaders("invalid-token-string"),
      });
      expect(invalidTokenResponse.status).toBe(401);

      const expiredToken = signTestToken(
        { sub: "some-user-id" },
        { expiresInSeconds: -3600 }
      );
      const expiredTokenResponse = await request(app, {
        method: "DELETE",
        path: `/episodes/${missingId}`,
        headers: authHeaders(expiredToken),
      });
      expect(expiredTokenResponse.status).toBe(401);
    });
  });

  describe("error handling", () => {
    it("returns 404 when attempting to delete an episode that does not exist", async () => {
      const { accessToken } = await registerUser(app);
      const missingId = crypto.randomUUID();

      const response = await request(app, {
        method: "DELETE",
        path: `/episodes/${missingId}`,
        headers: authHeaders(accessToken),
      });

      expect(response.status).toBe(404);
      const body = response.body as { error: { code: string; message: string } };
      expect(body.error).toBeDefined();
      expect(body.error.code).toBe("EPISODE_NOT_FOUND");
    });
  });

  describe("happy path", () => {
    it("hard-deletes the episode by UUID and returns 200 with the deleted record", async () => {
      const { accessToken } = await registerUser(app);
      const episode = await insertEpisode();

      const response = await request(app, {
        method: "DELETE",
        path: `/episodes/${episode.id}`,
        headers: authHeaders(accessToken),
      });

      expect(response.status).toBe(200);
      const body = response.body as {
        data: { id: string; sourceUrl: string; title: string };
      };
      expect(body.data).toBeDefined();
      expect(body.data.id).toBe(episode.id);
      expect(body.data.title).toBe("delete-endpoint");

      const remaining = await db
        .select()
        .from(episodes)
        .where(eq(episodes.id, episode.id));
      expect(remaining).toHaveLength(0);
    });
  });
});