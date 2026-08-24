import { describe, expect, it, beforeAll } from "vitest";
import { videoSources as videoSourcesTable } from "@repo/db";
import { buildApp, request, type App } from "../../utils/app";
import { registerUser, authHeaders, signTestToken } from "../../utils/auth";
import { db } from "../../utils/db";
import { episodes } from "@repo/db";

async function insertTestEpisode(overrides?: Partial<{
  id: string;
  title: string;
  videoType: string | null;
}>): Promise<{ id: string; title: string }> {
  const id = overrides?.id ?? crypto.randomUUID();
  const title = overrides?.title ?? "Sources Test Episode";
  const videoType = overrides?.videoType ?? null;
  const now = new Date();

  await db.insert(episodes).values({
    id,
    title,
    videoType,
    metadata: {},
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

    it("successfully creates new video sources and returns episode with nested videoSources", async () => {
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
      expect(body.data.videoSources).toHaveLength(2);
      expect(body.data.videoSources).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: "embed", url: "https://embed.test/1080p", label: "Server 1080p", quality: "1080p" }),
          expect.objectContaining({ type: "direct", url: "https://direct.test/720p.mp4", label: "Direct MP4", quality: "720p" }),
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

    it("successfully updates video source label and quality", async () => {
      const { accessToken } = await registerUser(app);
      const episode = await insertTestEpisode();
      const source = await insertTestVideoSource(episode.id, { label: "Old Label", quality: "480p" });

      const response = await request(app, {
        method: "PATCH",
        path: `/episodes/${episode.id}/sources/${source.id}`,
        headers: authHeaders(accessToken),
        body: { label: "New Label", quality: "1080p" },
      });

      expect(response.status).toBe(200);
      const body = response.body as {
        data: {
          id: string;
          videoSources: Array<{ id: string; label: string; quality: string | null }>;
        };
      };

      const updated = body.data.videoSources.find((s) => s.id === source.id);
      expect(updated).toBeDefined();
      expect(updated?.label).toBe("New Label");
      expect(updated?.quality).toBe("1080p");
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
