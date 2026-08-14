import { describe, expect, it, beforeAll } from "vitest";
import { eq } from "drizzle-orm";
import { videos } from "@repo/db";
import { buildApp, request, type App } from "../../utils/app";
import { registerUser, authHeaders, signTestToken } from "../../utils/auth";
import { db } from "../../utils/db";

async function insertVideo(): Promise<{ id: string }> {
  const now = new Date();
  const rows = await db
    .insert(videos)
    .values({
      id: `video-${crypto.randomUUID()}`,
      sourceUrl:
        "https://otakudesu.blog/episode/delete-endpoint-episode-1-sub-indo/",
      source: "otakudesu",
      title: "delete-endpoint",
      videoType: null,
      videoUrl: "https://odvidhide.com/embed/test",
      metadata: {},
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return rows[0];
}

describe("DELETE /videos/:id", () => {
  let app: App;

  beforeAll(async () => {
    app = await buildApp();
  });

  describe("authentication", () => {
    it("returns 401 when authorization header is missing", async () => {
      const missingId = `video-${crypto.randomUUID()}`;

      const response = await request(app, {
        method: "DELETE",
        path: `/videos/${missingId}`,
      });

      expect(response.status).toBe(401);
    });

    it("returns 401 when authorization token is invalid or expired", async () => {
      const missingId = `video-${crypto.randomUUID()}`;

      const invalidTokenResponse = await request(app, {
        method: "DELETE",
        path: `/videos/${missingId}`,
        headers: authHeaders("invalid-token-string"),
      });
      expect(invalidTokenResponse.status).toBe(401);

      const expiredToken = signTestToken(
        { sub: "some-user-id" },
        { expiresInSeconds: -3600 }
      );
      const expiredTokenResponse = await request(app, {
        method: "DELETE",
        path: `/videos/${missingId}`,
        headers: authHeaders(expiredToken),
      });
      expect(expiredTokenResponse.status).toBe(401);
    });
  });

  describe("error handling", () => {
    it("returns 404 when attempting to delete a video that does not exist", async () => {
      const { accessToken } = await registerUser(app);
      const missingId = `video-${crypto.randomUUID()}`;

      const response = await request(app, {
        method: "DELETE",
        path: `/videos/${missingId}`,
        headers: authHeaders(accessToken),
      });

      expect(response.status).toBe(404);
      const body = response.body as { error: { code: string; message: string } };
      expect(body.error).toBeDefined();
      expect(body.error.code).toBe("VIDEO_NOT_FOUND");
    });
  });

  describe("happy path", () => {
    it("hard-deletes the video by UUID and returns 200 with the deleted record", async () => {
      const { accessToken } = await registerUser(app);
      const video = await insertVideo();

      const response = await request(app, {
        method: "DELETE",
        path: `/videos/${video.id}`,
        headers: authHeaders(accessToken),
      });

      expect(response.status).toBe(200);
      const body = response.body as {
        data: { id: string; sourceUrl: string; title: string };
      };
      expect(body.data).toBeDefined();
      expect(body.data.id).toBe(video.id);
      expect(body.data.sourceUrl).toBe(
        "https://otakudesu.blog/episode/delete-endpoint-episode-1-sub-indo/"
      );

      const remaining = await db
        .select()
        .from(videos)
        .where(eq(videos.id, video.id));
      expect(remaining).toHaveLength(0);
    });
  });
});