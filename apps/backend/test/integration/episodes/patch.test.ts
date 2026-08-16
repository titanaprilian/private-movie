import { describe, expect, it, beforeAll } from "vitest";
import { eq } from "drizzle-orm";
import { episodes } from "@repo/db";
import { buildApp, request, type App } from "../../utils/app";
import { registerUser, authHeaders, signTestToken } from "../../utils/auth";
import { db } from "../../utils/db";

async function insertTestEpisode(overrides?: Partial<{
  id: string;
  sourceUrl: string;
  source: string;
  title: string;
  videoType: string | null;
  embedUrl: string | null;
  videoUrl: string | null;
  metadata: Record<string, unknown>;
}>): Promise<{
  id: string;
  sourceUrl: string;
  source: string;
  title: string;
  videoType: string | null;
  embedUrl: string | null;
  videoUrl: string | null;
  metadata: Record<string, unknown>;
}> {
  const id = overrides?.id ?? crypto.randomUUID();
  const sourceUrl =
    overrides?.sourceUrl ??
    `https://otakudesu.blog/episode/patch-test-${crypto.randomUUID()}/`;
  const source = overrides?.source ?? "otakudesu";
  const title = overrides?.title ?? "Original Title";
  const videoType = overrides?.videoType ?? null;
  const embedUrl = overrides?.embedUrl ?? "https://odvidhide.com/embed/original";
  const videoUrl = overrides?.videoUrl ?? "https://example.com/stream.mp4";
  const metadata = overrides?.metadata ?? { initial: true };
  const now = new Date();

  await db.insert(episodes).values({
    id,
    sourceUrl,
    source,
    title,
    videoType,
    embedUrl,
    videoUrl,
    metadata,
    createdAt: now,
    updatedAt: now,
  });

  return { id, sourceUrl, source, title, videoType, embedUrl, videoUrl, metadata };
}

describe("PATCH /episodes/:id", () => {
  let app: App;

  beforeAll(async () => {
    app = await buildApp();
  });

  describe("authentication", () => {
    it("returns 401 when authorization header is missing", async () => {
      const episode = await insertTestEpisode();

      const response = await request(app, {
        method: "PATCH",
        path: `/episodes/${episode.id}`,
        body: {
          title: "New Title",
        },
      });

      expect(response.status).toBe(401);
      const body = response.body as { error: { code: string; message: string } };
      expect(body.error).toBeDefined();
      expect(body.error.code).toBe("UNAUTHORIZED");
    });

    it("returns 401 when authorization token is invalid or expired", async () => {
      const episode = await insertTestEpisode();

      const invalidTokenResponse = await request(app, {
        method: "PATCH",
        path: `/episodes/${episode.id}`,
        headers: authHeaders("invalid-token-string"),
        body: {
          title: "New Title",
        },
      });

      expect(invalidTokenResponse.status).toBe(401);

      const expiredToken = signTestToken(
        { sub: "some-user-id" },
        { expiresInSeconds: -3600 }
      );
      const expiredTokenResponse = await request(app, {
        method: "PATCH",
        path: `/episodes/${episode.id}`,
        headers: authHeaders(expiredToken),
        body: {
          title: "New Title",
        },
      });

      expect(expiredTokenResponse.status).toBe(401);
    });
  });

  describe("error handling", () => {
    it("returns 404 when episode ID does not exist", async () => {
      const { accessToken } = await registerUser(app);
      const nonexistentId = crypto.randomUUID();

      const response = await request(app, {
        method: "PATCH",
        path: `/episodes/${nonexistentId}`,
        headers: authHeaders(accessToken),
        body: {
          title: "Updated Title",
        },
      });

      expect(response.status).toBe(404);
      const body = response.body as { error: { code: string; message: string } };
      expect(body.error).toBeDefined();
      expect(body.error.code).toBe("EPISODE_NOT_FOUND");
    });
  });

  describe("partial update behavior", () => {
    it("successfully updates title only (1 field)", async () => {
      const { accessToken } = await registerUser(app);
      const episode = await insertTestEpisode();

      const response = await request(app, {
        method: "PATCH",
        path: `/episodes/${episode.id}`,
        headers: authHeaders(accessToken),
        body: {
          title: "Updated Title Only",
        },
      });

      expect(response.status).toBe(200);
      const body = response.body as {
        data: {
          id: string;
          title: string;
          videoUrl: string;
          videoType: string | null;
          metadata: Record<string, unknown>;
        };
      };

      expect(body.data.id).toBe(episode.id);
      expect(body.data.title).toBe("Updated Title Only");
      expect(body.data.videoUrl).toBe(episode.videoUrl);

      // Verify in DB
      const rows = await db.select().from(episodes).where(eq(episodes.id, episode.id));
      expect(rows).toHaveLength(1);
      expect(rows[0].title).toBe("Updated Title Only");
      expect(rows[0].videoUrl).toBe(episode.videoUrl);
    });

    it("successfully updates embedUrl only (1 field)", async () => {
      const { accessToken } = await registerUser(app);
      const episode = await insertTestEpisode();
      const newEmbedUrl = "https://example.com/new-embed-link";

      const response = await request(app, {
        method: "PATCH",
        path: `/episodes/${episode.id}`,
        headers: authHeaders(accessToken),
        body: {
          embedUrl: newEmbedUrl,
        },
      });

      expect(response.status).toBe(200);
      const body = response.body as {
        data: { id: string; title: string; embedUrl: string };
      };

      expect(body.data.title).toBe(episode.title);
      expect(body.data.embedUrl).toBe(newEmbedUrl);

      const rows = await db.select().from(episodes).where(eq(episodes.id, episode.id));
      expect(rows[0].embedUrl).toBe(newEmbedUrl);
      expect(rows[0].title).toBe(episode.title);
    });

    it("successfully updates videoUrl only (1 field)", async () => {
      const { accessToken } = await registerUser(app);
      const episode = await insertTestEpisode();
      const newVideoUrl = "https://example.com/new-embed-link";

      const response = await request(app, {
        method: "PATCH",
        path: `/episodes/${episode.id}`,
        headers: authHeaders(accessToken),
        body: {
          videoUrl: newVideoUrl,
        },
      });

      expect(response.status).toBe(200);
      const body = response.body as {
        data: { id: string; title: string; videoUrl: string };
      };

      expect(body.data.title).toBe(episode.title);
      expect(body.data.videoUrl).toBe(newVideoUrl);

      const rows = await db.select().from(episodes).where(eq(episodes.id, episode.id));
      expect(rows[0].videoUrl).toBe(newVideoUrl);
      expect(rows[0].title).toBe(episode.title);
    });

    it("successfully updates videoType only (1 field)", async () => {
      const { accessToken } = await registerUser(app);
      const episode = await insertTestEpisode();

      const response = await request(app, {
        method: "PATCH",
        path: `/episodes/${episode.id}`,
        headers: authHeaders(accessToken),
        body: {
          videoType: "Movie",
        },
      });

      expect(response.status).toBe(200);
      const body = response.body as {
        data: { id: string; videoType: string | null };
      };

      expect(body.data.videoType).toBe("Movie");

      const rows = await db.select().from(episodes).where(eq(episodes.id, episode.id));
      expect(rows[0].videoType).toBe("Movie");
    });

    it("successfully updates description only (1 field)", async () => {
      const { accessToken } = await registerUser(app);
      const episode = await insertTestEpisode();

      const response = await request(app, {
        method: "PATCH",
        path: `/episodes/${episode.id}`,
        headers: authHeaders(accessToken),
        body: {
          description: "New Episode Description",
        },
      });

      expect(response.status).toBe(200);
      const body = response.body as {
        data: { id: string; description: string | null };
      };

      expect(body.data.description).toBe("New Episode Description");

      const rows = await db.select().from(episodes).where(eq(episodes.id, episode.id));
      expect(rows[0].description).toBe("New Episode Description");
    });

    it("successfully updates metadata only (1 field)", async () => {
      const { accessToken } = await registerUser(app);
      const episode = await insertTestEpisode();
      const newMetadata = { season: 2, episode: 10 };

      const response = await request(app, {
        method: "PATCH",
        path: `/episodes/${episode.id}`,
        headers: authHeaders(accessToken),
        body: {
          metadata: newMetadata,
        },
      });

      expect(response.status).toBe(200);
      const body = response.body as {
        data: { id: string; metadata: Record<string, unknown> };
      };

      expect(body.data.metadata).toEqual(newMetadata);

      const rows = await db.select().from(episodes).where(eq(episodes.id, episode.id));
      expect(rows[0].metadata).toEqual(newMetadata);
    });

    it("successfully updates all 5 allowed fields simultaneously (title, videoUrl, videoType, description, metadata)", async () => {
      const { accessToken } = await registerUser(app);
      const episode = await insertTestEpisode();

      const patchPayload = {
        title: "All Fields Updated",
        videoUrl: "https://example.com/all-fields",
        videoType: "OVA",
        description: "Updated description for all fields",
        metadata: { tags: ["action", "drama"] },
      };

      const response = await request(app, {
        method: "PATCH",
        path: `/episodes/${episode.id}`,
        headers: authHeaders(accessToken),
        body: patchPayload,
      });

      expect(response.status).toBe(200);
      const body = response.body as {
        data: {
          id: string;
          title: string;
          videoUrl: string;
          videoType: string | null;
          description: string | null;
          metadata: Record<string, unknown>;
        };
      };

      expect(body.data.title).toBe(patchPayload.title);
      expect(body.data.videoUrl).toBe(patchPayload.videoUrl);
      expect(body.data.videoType).toBe(patchPayload.videoType);
      expect(body.data.description).toBe(patchPayload.description);
      expect(body.data.metadata).toEqual(patchPayload.metadata);

      const rows = await db.select().from(episodes).where(eq(episodes.id, episode.id));
      expect(rows[0].title).toBe(patchPayload.title);
      expect(rows[0].videoUrl).toBe(patchPayload.videoUrl);
      expect(rows[0].videoType).toBe(patchPayload.videoType);
      expect(rows[0].description).toBe(patchPayload.description);
      expect(rows[0].metadata).toEqual(patchPayload.metadata);
    });
  });
});