import { describe, expect, it, beforeAll } from "vitest";
import { videoSources as videoSourcesTable, seasons, series } from "@repo/db";
import { buildApp, request, type App } from "../../utils/app";
import { registerUser, authHeaders, signTestToken } from "../../utils/auth";
import { db } from "../../utils/db";
import { episodes } from "@repo/db";
import { eq } from "drizzle-orm";

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

async function insertTestEpisode(overrides?: Partial<{
  id: string;
  title: string;
}>): Promise<{ id: string; title: string }> {
  const id = overrides?.id ?? crypto.randomUUID();
  const title = overrides?.title ?? "Sources Test Episode";
  const seasonId = await ensureSeason(crypto.randomUUID());
  const now = new Date();

  await db.insert(episodes).values({
    id,
    seasonId,
    title,
    createdAt: now,
    updatedAt: now,
  });

  return { id, title };
}

async function insertTestVideoSource(episodeId: string, overrides?: Partial<{
  id: string;
  type: string;
  url: string;
  label: string;
  quality: string | null;
}>): Promise<{ id: string; type: string; url: string; label: string; quality: string | null }> {
  const id = overrides?.id ?? crypto.randomUUID();
  const type = overrides?.type ?? "embed";
  const url = overrides?.url ?? `https://embed.example.com/${crypto.randomUUID()}`;
  const label = overrides?.label ?? "Server 1";
  const quality = overrides?.quality ?? "720p";
  const now = new Date();

  await db.insert(videoSourcesTable).values({
    id,
    episodeId,
    type,
    url,
    label,
    quality,
    createdAt: now,
    updatedAt: now,
  });

  return { id, type, url, label, quality };
}

describe("Video Sources API (CRUD & Episode Detail)", () => {
  let app: App;

  beforeAll(async () => {
    app = await buildApp();
  });

  describe("GET /episodes/:id", () => {
    it("returns episode detail with nested videoSources array", async () => {
      const episode = await insertTestEpisode();
      const source1 = await insertTestVideoSource(episode.id, { label: "Server 1", type: "embed" });
      const source2 = await insertTestVideoSource(episode.id, { label: "Server 2", type: "direct" });

      const response = await request(app, {
        path: `/episodes/${episode.id}`,
      });

      expect(response.status).toBe(200);
      const body = response.body as {
        data: {
          id: string;
          title: string;
          videoSources: Array<{ id: string; type: string; url: string; label: string; quality: string | null }>;
        };
      };

      expect(body.data.id).toBe(episode.id);
      expect(body.data.videoSources).toBeDefined();
      expect(Array.isArray(body.data.videoSources)).toBe(true);
      expect(body.data.videoSources).toHaveLength(2);
      expect(body.data.videoSources.map((s) => s.id)).toContain(source1.id);
      expect(body.data.videoSources.map((s) => s.id)).toContain(source2.id);
    });

    it("returns 404 EPISODE_NOT_FOUND for non-existent episode id", async () => {
      const nonexistentId = crypto.randomUUID();

      const response = await request(app, {
        path: `/episodes/${nonexistentId}`,
      });

      expect(response.status).toBe(404);
      const body = response.body as { error: { code: string; message: string } };
      expect(body.error.code).toBe("EPISODE_NOT_FOUND");
    });
  });

  describe("POST /episodes/:id/sources/presign-upload", () => {
    it("returns 401 when unauthenticated", async () => {
      const episode = await insertTestEpisode();

      const response = await request(app, {
        method: "POST",
        path: `/episodes/${episode.id}/sources/presign-upload`,
        body: { filename: "video.mp4" },
      });

      expect(response.status).toBe(401);
    });

    it("returns 404 EPISODE_NOT_FOUND when requesting presign upload for non-existent episode", async () => {
      const { accessToken } = await registerUser(app);
      const nonexistentId = crypto.randomUUID();

      const response = await request(app, {
        method: "POST",
        path: `/episodes/${nonexistentId}/sources/presign-upload`,
        headers: authHeaders(accessToken),
        body: { filename: "video.mp4" },
      });

      expect(response.status).toBe(404);
      const body = response.body as { error: { code: string; message: string } };
      expect(body.error.code).toBe("EPISODE_NOT_FOUND");
    });

    it("returns 503 S3_NOT_CONFIGURED when S3 storage service is not configured", async () => {
      const unconfiguredApp = await buildApp({
        s3StorageService: {
          isConfigured: () => false,
          getPresignedUploadUrl: async () => {
            throw new Error("Not implemented");
          },
          getPresignedPlaybackUrl: async () => {
            throw new Error("Not implemented");
          },
          deleteObject: async () => {},
          deleteObjects: async () => {},
        },
      });

      const { accessToken } = await registerUser(unconfiguredApp);
      const episode = await insertTestEpisode();

      const response = await request(unconfiguredApp, {
        method: "POST",
        path: `/episodes/${episode.id}/sources/presign-upload`,
        headers: authHeaders(accessToken),
        body: { filename: "video.mp4" },
      });

      expect(response.status).toBe(503);
      const body = response.body as { error: { code: string; message: string } };
      expect(body.error.code).toBe("S3_NOT_CONFIGURED");
    });

    it("issues a valid presigned upload URL and key when configured and authenticated", async () => {
      const mockS3Service = {
        isConfigured: () => true,
        getPresignedUploadUrl: async (key: string, contentType?: string) => ({
          uploadUrl: `https://s3.example.com/${key}?signature=test`,
          key,
        }),
        getPresignedPlaybackUrl: async (key: string) => `https://s3.example.com/${key}?playback=true`,
        deleteObject: async () => {},
        deleteObjects: async () => {},
      };

      const customApp = await buildApp({ s3StorageService: mockS3Service });
      const { accessToken } = await registerUser(customApp);
      const episode = await insertTestEpisode();

      const response = await request(customApp, {
        method: "POST",
        path: `/episodes/${episode.id}/sources/presign-upload`,
        headers: authHeaders(accessToken),
        body: { filename: "movie.mp4", contentType: "video/mp4" },
      });

      expect(response.status).toBe(200);
      const body = response.body as { data: { uploadUrl: string; key: string } };
      expect(body.data.uploadUrl).toContain("https://s3.example.com/episodes/");
      expect(body.data.key).toMatch(new RegExp(`^episodes/${episode.id}/.+-movie\\.mp4$`));
    });
  });

  describe("POST /episodes/:id/sources", () => {
    it("returns 401 when unauthenticated", async () => {
      const episode = await insertTestEpisode();

      const response = await request(app, {
        method: "POST",
        path: `/episodes/${episode.id}/sources`,
        body: {
          videoSources: [
            { type: "embed", url: "https://embed.test/1", label: "Server 1" },
          ],
        },
      });

      expect(response.status).toBe(401);
    });

    it("returns 404 EPISODE_NOT_FOUND when adding sources to non-existent episode", async () => {
      const { accessToken } = await registerUser(app);
      const nonexistentId = crypto.randomUUID();

      const response = await request(app, {
        method: "POST",
        path: `/episodes/${nonexistentId}/sources`,
        headers: authHeaders(accessToken),
        body: {
          videoSources: [
            { type: "embed", url: "https://embed.test/1", label: "Server 1" },
          ],
        },
      });

      expect(response.status).toBe(404);
      const body = response.body as { error: { code: string; message: string } };
      expect(body.error.code).toBe("EPISODE_NOT_FOUND");
    });

    it("successfully creates new video sources including s3 type and returns episode with nested videoSources", async () => {
      const { accessToken } = await registerUser(app);
      const episode = await insertTestEpisode();

      const response = await request(app, {
        method: "POST",
        path: `/episodes/${episode.id}/sources`,
        headers: authHeaders(accessToken),
        body: {
          videoSources: [
            { type: "embed", url: "https://embed.test/1080p", label: "Server 1080p", quality: "1080p" },
            { type: "direct", url: "https://direct.test/720p.mp4", label: "Direct MP4", quality: "720p" },
            { type: "s3", url: `episodes/${episode.id}/file.mp4`, label: "S3 Storage", quality: "1080p" },
          ],
        },
      });

      expect(response.status).toBe(200);
      const body = response.body as {
        data: {
          id: string;
          videoSources: Array<{ id: string; type: string; url: string; label: string; quality: string | null }>;
        };
      };

      expect(body.data.id).toBe(episode.id);
      expect(body.data.videoSources).toHaveLength(3);
      expect(body.data.videoSources).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: "embed", url: "https://embed.test/1080p", label: "Server 1080p", quality: "1080p" }),
          expect.objectContaining({ type: "direct", url: "https://direct.test/720p.mp4", label: "Direct MP4", quality: "720p" }),
          expect.objectContaining({ type: "s3", url: `episodes/${episode.id}/file.mp4`, label: "S3 Storage", quality: "1080p" }),
        ])
      );
    });
  });

  describe("PATCH /episodes/:id/sources/:sourceId", () => {
    it("returns 401 when unauthenticated", async () => {
      const episode = await insertTestEpisode();
      const source = await insertTestVideoSource(episode.id);

      const response = await request(app, {
        method: "PATCH",
        path: `/episodes/${episode.id}/sources/${source.id}`,
        body: { label: "Updated Label" },
      });

      expect(response.status).toBe(401);
    });

    it("returns 404 EPISODE_NOT_FOUND when episode id does not exist", async () => {
      const { accessToken } = await registerUser(app);
      const episode = await insertTestEpisode();
      const source = await insertTestVideoSource(episode.id);
      const nonexistentEpId = crypto.randomUUID();

      const response = await request(app, {
        method: "PATCH",
        path: `/episodes/${nonexistentEpId}/sources/${source.id}`,
        headers: authHeaders(accessToken),
        body: { label: "Updated Label" },
      });

      expect(response.status).toBe(404);
      const body = response.body as { error: { code: string; message: string } };
      expect(body.error.code).toBe("EPISODE_NOT_FOUND");
    });

    it("returns 404 VIDEO_SOURCE_NOT_FOUND when source id does not exist", async () => {
      const { accessToken } = await registerUser(app);
      const episode = await insertTestEpisode();
      const nonexistentSourceId = crypto.randomUUID();

      const response = await request(app, {
        method: "PATCH",
        path: `/episodes/${episode.id}/sources/${nonexistentSourceId}`,
        headers: authHeaders(accessToken),
        body: { label: "Updated Label" },
      });

      expect(response.status).toBe(404);
      const body = response.body as { error: { code: string; message: string } };
      expect(body.error.code).toBe("VIDEO_SOURCE_NOT_FOUND");
    });

    it("returns 404 VIDEO_SOURCE_NOT_FOUND when source belongs to a different episode", async () => {
      const { accessToken } = await registerUser(app);
      const ep1 = await insertTestEpisode();
      const ep2 = await insertTestEpisode();
      const sourceOnEp2 = await insertTestVideoSource(ep2.id);

      const response = await request(app, {
        method: "PATCH",
        path: `/episodes/${ep1.id}/sources/${sourceOnEp2.id}`,
        headers: authHeaders(accessToken),
        body: { label: "Updated Label" },
      });

      expect(response.status).toBe(404);
      const body = response.body as { error: { code: string; message: string } };
      expect(body.error.code).toBe("VIDEO_SOURCE_NOT_FOUND");
    });

    it("successfully updates video source label, quality, and type to/from s3", async () => {
      const { accessToken } = await registerUser(app);
      const episode = await insertTestEpisode();
      const source = await insertTestVideoSource(episode.id, { type: "embed", label: "Old Label", quality: "480p" });

      const response1 = await request(app, {
        method: "PATCH",
        path: `/episodes/${episode.id}/sources/${source.id}`,
        headers: authHeaders(accessToken),
        body: { type: "s3", label: "S3 Label", quality: "1080p" },
      });

      expect(response1.status).toBe(200);
      const body1 = response1.body as {
        data: {
          id: string;
          videoSources: Array<{ id: string; type: string; label: string; quality: string | null }>;
        };
      };

      const updated1 = body1.data.videoSources.find((s) => s.id === source.id);
      expect(updated1).toBeDefined();
      expect(updated1?.type).toBe("s3");
      expect(updated1?.label).toBe("S3 Label");
      expect(updated1?.quality).toBe("1080p");

      const response2 = await request(app, {
        method: "PATCH",
        path: `/episodes/${episode.id}/sources/${source.id}`,
        headers: authHeaders(accessToken),
        body: { type: "direct" },
      });

      expect(response2.status).toBe(200);
      const body2 = response2.body as {
        data: {
          id: string;
          videoSources: Array<{ id: string; type: string; label: string; quality: string | null }>;
        };
      };
      const updated2 = body2.data.videoSources.find((s) => s.id === source.id);
      expect(updated2?.type).toBe("direct");
    });
  });

  describe("DELETE /episodes/:id/sources/:sourceId", () => {
    it("returns 401 when unauthenticated", async () => {
      const episode = await insertTestEpisode();
      const source = await insertTestVideoSource(episode.id);

      const response = await request(app, {
        method: "DELETE",
        path: `/episodes/${episode.id}/sources/${source.id}`,
      });

      expect(response.status).toBe(401);
    });

    it("returns 404 EPISODE_NOT_FOUND when episode id does not exist", async () => {
      const { accessToken } = await registerUser(app);
      const episode = await insertTestEpisode();
      const source = await insertTestVideoSource(episode.id);
      const nonexistentEpId = crypto.randomUUID();

      const response = await request(app, {
        method: "DELETE",
        path: `/episodes/${nonexistentEpId}/sources/${source.id}`,
        headers: authHeaders(accessToken),
      });

      expect(response.status).toBe(404);
      const body = response.body as { error: { code: string; message: string } };
      expect(body.error.code).toBe("EPISODE_NOT_FOUND");
    });

    it("returns 404 VIDEO_SOURCE_NOT_FOUND when source id does not exist", async () => {
      const { accessToken } = await registerUser(app);
      const episode = await insertTestEpisode();
      const nonexistentSourceId = crypto.randomUUID();

      const response = await request(app, {
        method: "DELETE",
        path: `/episodes/${episode.id}/sources/${nonexistentSourceId}`,
        headers: authHeaders(accessToken),
      });

      expect(response.status).toBe(404);
      const body = response.body as { error: { code: string; message: string } };
      expect(body.error.code).toBe("VIDEO_SOURCE_NOT_FOUND");
    });

    it("returns 404 VIDEO_SOURCE_NOT_FOUND when source belongs to a different episode", async () => {
      const { accessToken } = await registerUser(app);
      const ep1 = await insertTestEpisode();
      const ep2 = await insertTestEpisode();
      const sourceOnEp2 = await insertTestVideoSource(ep2.id);

      const response = await request(app, {
        method: "DELETE",
        path: `/episodes/${ep1.id}/sources/${sourceOnEp2.id}`,
        headers: authHeaders(accessToken),
      });

      expect(response.status).toBe(404);
      const body = response.body as { error: { code: string; message: string } };
      expect(body.error.code).toBe("VIDEO_SOURCE_NOT_FOUND");
    });

    it("successfully deletes video source and returns updated episode without deleted source", async () => {
      const { accessToken } = await registerUser(app);
      const episode = await insertTestEpisode();
      const s1 = await insertTestVideoSource(episode.id, { label: "To Delete" });
      const s2 = await insertTestVideoSource(episode.id, { label: "To Keep" });

      const response = await request(app, {
        method: "DELETE",
        path: `/episodes/${episode.id}/sources/${s1.id}`,
        headers: authHeaders(accessToken),
      });

      expect(response.status).toBe(200);
      const body = response.body as {
        data: {
          id: string;
          videoSources: Array<{ id: string }>;
        };
      };

      expect(body.data.videoSources).toHaveLength(1);
      expect(body.data.videoSources[0].id).toBe(s2.id);
    });
  });
});
