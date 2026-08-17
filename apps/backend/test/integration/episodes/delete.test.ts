import { describe, expect, it, beforeAll } from "vitest";
import { eq } from "drizzle-orm";
import { episodes } from "@repo/db";
import { buildApp, request, type App } from "../../utils/app";
import { registerUser, authHeaders, signTestToken } from "../../utils/auth";
import { db } from "../../utils/db";

async function insertEpisode(): Promise<{ id: string }> {
  const now = new Date();
  const rows = await db
    .insert(episodes)
    .values({
      id: crypto.randomUUID(),
      sourceUrl:
        "https://otakudesu.blog/episode/delete-endpoint-episode-1-sub-indo/",
      source: "otakudesu",
      title: "delete-endpoint",
      videoType: null,
      metadata: {},
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
      expect(body.data.sourceUrl).toBe(
        "https://otakudesu.blog/episode/delete-endpoint-episode-1-sub-indo/"
      );

      const remaining = await db
        .select()
        .from(episodes)
        .where(eq(episodes.id, episode.id));
      expect(remaining).toHaveLength(0);
    });
  });
});