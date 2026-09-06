import { describe, expect, it, beforeAll } from "vitest";
import { videoSources as videoSourcesTable, seasons, series } from "@repo/db";
import { buildApp, request, type App } from "../../utils/app";
import { registerUser, authHeaders } from "../../utils/auth";
import { db } from "../../utils/db";
import { episodes } from "@repo/db";
import { eq } from "drizzle-orm";
import type { StreamUploadOptions } from "@repo/media-service";
import type { Readable } from "node:stream";

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

    it("resolves presigned GET playback URLs for s3 sources on GET /episodes/:id while leaving db key unmodified", async () => {
      const mockS3Service = {
        isConfigured: () => true,
        getPresignedUploadUrl: async (key: string) => ({ uploadUrl: `https://s3.example.com/${key}`, key }),
        getPresignedPlaybackUrl: async (key: string, expiresIn?: number) =>
          `https://s3.signed.com/${key}?expires=${expiresIn ?? 21600}`,
        uploadObject: async () => {},
        uploadStream: async () => {},
        deleteObject: async () => {},
        deleteObjects: async () => {},
      };

      const customApp = await buildApp({ s3StorageService: mockS3Service });
      const episode = await insertTestEpisode();
      const s3Key = `episodes/${episode.id}/video-1080p.mp4`;
      const s3Source = await insertTestVideoSource(episode.id, {
        type: "s3",
        url: s3Key,
        label: "B2 S3 Source",
        quality: "1080p",
      });
      const directSource = await insertTestVideoSource(episode.id, {
        type: "direct",
        url: "https://example.com/direct.mp4",
        label: "Direct",
      });

      const response = await request(customApp, {
        path: `/episodes/${episode.id}`,
      });

      expect(response.status).toBe(200);
      const body = response.body as {
        data: {
          id: string;
          videoSources: Array<{ id: string; type: string; url: string; label: string }>;
        };
      };

      const resolvedS3 = body.data.videoSources.find((s) => s.id === s3Source.id);
      expect(resolvedS3).toBeDefined();
      expect(resolvedS3?.url).toBe(`https://s3.signed.com/${s3Key}?expires=21600`);

      const resolvedDirect = body.data.videoSources.find((s) => s.id === directSource.id);
      expect(resolvedDirect?.url).toBe("https://example.com/direct.mp4");

      // Verify raw database row was NOT modified
      const [dbSource] = await db
        .select()
        .from(videoSourcesTable)
        .where(eq(videoSourcesTable.id, s3Source.id));
      expect(dbSource.url).toBe(s3Key);
    });

    it("returns nested episodes with presigned GET playback URLs for s3 sources on GET /series/:id", async () => {
      const mockS3Service = {
        isConfigured: () => true,
        getPresignedUploadUrl: async (key: string) => ({ uploadUrl: `https://s3.example.com/${key}`, key }),
        getPresignedPlaybackUrl: async (key: string, expiresIn?: number) =>
          `https://s3.signed.com/${key}?expires=${expiresIn ?? 21600}`,
        uploadObject: async () => {},
        uploadStream: async () => {},
        deleteObject: async () => {},
        deleteObjects: async () => {},
      };

      const customApp = await buildApp({ s3StorageService: mockS3Service });
      const seasonId = await ensureSeason(crypto.randomUUID());
      const [season] = await db.select().from(seasons).where(eq(seasons.id, seasonId));
      const seriesId = season.seriesId;

      const epId = crypto.randomUUID();
      await db.insert(episodes).values({
        id: epId,
        seasonId,
        title: "Series Ep 1",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const s3Key = `episodes/${epId}/series-ep.mp4`;
      const s3Source = await insertTestVideoSource(epId, {
        type: "s3",
        url: s3Key,
        label: "B2 S3 Ep Source",
      });

      const response = await request(customApp, {
        path: `/series/${seriesId}`,
      });

      expect(response.status).toBe(200);
      const body = response.body as {
        data: {
          id: string;
          episodes: Array<{
            id: string;
            videoSources: Array<{ id: string; type: string; url: string }>;
          }>;
          seasons: Array<{
            id: string;
            episodes: Array<{
              id: string;
              videoSources: Array<{ id: string; type: string; url: string }>;
            }>;
          }>;
        };
      };

      const epInEpisodes = body.data.episodes.find((e) => e.id === epId);
      const srcInEpisodes = epInEpisodes?.videoSources.find((s) => s.id === s3Source.id);
      expect(srcInEpisodes?.url).toBe(`https://s3.signed.com/${s3Key}?expires=21600`);

      const epInSeasons = body.data.seasons
        .find((s) => s.id === seasonId)
        ?.episodes.find((e) => e.id === epId);
      const srcInSeasons = epInSeasons?.videoSources.find((s) => s.id === s3Source.id);
      expect(srcInSeasons?.url).toBe(`https://s3.signed.com/${s3Key}?expires=21600`);

      // Verify db key intact
      const [dbSource] = await db
        .select()
        .from(videoSourcesTable)
        .where(eq(videoSourcesTable.id, s3Source.id));
      expect(dbSource.url).toBe(s3Key);
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
          uploadObject: async () => {
            throw new Error("Not implemented");
          },
          uploadStream: async () => {
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
        uploadObject: async () => {},
        uploadStream: async () => {},
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

  describe("POST /episodes/:id/sources/upload", () => {
    it("returns 401 when unauthenticated", async () => {
      const episode = await insertTestEpisode();
      const formData = new FormData();
      formData.append("file", new Blob(["video bytes"], { type: "video/mp4" }), "episode.mp4");
      formData.append("label", "Direct Upload");

      const response = await request(app, {
        method: "POST",
        path: `/episodes/${episode.id}/sources/upload`,
        body: formData,
      });

      expect(response.status).toBe(401);
    });

    it("returns 404 EPISODE_NOT_FOUND when uploading source to non-existent episode", async () => {
      const { accessToken } = await registerUser(app);
      const nonexistentId = crypto.randomUUID();
      const formData = new FormData();
      formData.append("file", new Blob(["video bytes"], { type: "video/mp4" }), "episode.mp4");
      formData.append("label", "Direct Upload");

      const response = await request(app, {
        method: "POST",
        path: `/episodes/${nonexistentId}/sources/upload`,
        headers: authHeaders(accessToken),
        body: formData,
      });

      expect(response.status).toBe(404);
      const body = response.body as { error: { code: string; message: string } };
      expect(body.error.code).toBe("EPISODE_NOT_FOUND");
    });

    it("returns 503 S3_NOT_CONFIGURED when S3 storage is not configured", async () => {
      const unconfiguredApp = await buildApp({
        s3StorageService: {
          isConfigured: () => false,
          getPresignedUploadUrl: async () => {
            throw new Error("Not implemented");
          },
          getPresignedPlaybackUrl: async () => {
            throw new Error("Not implemented");
          },
          uploadObject: async () => {
            throw new Error("Not implemented");
          },
          uploadStream: async () => {
            throw new Error("Not implemented");
          },
          deleteObject: async () => {},
          deleteObjects: async () => {},
        },
      });

      const { accessToken } = await registerUser(unconfiguredApp);
      const episode = await insertTestEpisode();
      const formData = new FormData();
      formData.append("file", new Blob(["video bytes"], { type: "video/mp4" }), "episode.mp4");
      formData.append("label", "Direct Upload");

      const response = await request(unconfiguredApp, {
        method: "POST",
        path: `/episodes/${episode.id}/sources/upload`,
        headers: authHeaders(accessToken),
        body: formData,
      });

      expect(response.status).toBe(503);
      const body = response.body as { error: { code: string; message: string } };
      expect(body.error.code).toBe("S3_NOT_CONFIGURED");
    });

    it("successfully uploads file to S3 via uploadStream, persists s3 video source to DB, and returns updated episode envelope", async () => {
      let uploadedKey = "";
      let uploadedContentType = "";
      let uploadedStream: ReadableStream | Readable | null = null;
      let streamReceivedBytes = 0;

      const mockS3Service = {
        isConfigured: () => true,
        getPresignedUploadUrl: async (key: string) => ({ uploadUrl: `https://s3.example.com/${key}`, key }),
        getPresignedPlaybackUrl: async (key: string) => `https://s3.signed.com/${key}?playback=true`,
        uploadObject: async () => {},
        uploadStream: async (key: string, body: ReadableStream | Readable, options?: StreamUploadOptions) => {
          uploadedKey = key;
          uploadedContentType = options?.contentType ?? "";
          uploadedStream = body;
          // Consume stream to simulate transfer
          const webStream = body as ReadableStream<Uint8Array>;
          const reader = webStream.getReader ? webStream.getReader() : null;
          if (reader) {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              if (value) streamReceivedBytes += value.length;
            }
          }
        },
        deleteObject: async () => {},
        deleteObjects: async () => {},
      };

      const customApp = await buildApp({ s3StorageService: mockS3Service });
      const { accessToken } = await registerUser(customApp);
      const episode = await insertTestEpisode();

      const formData = new FormData();
      formData.append("file", new Blob(["my video binary data"], { type: "video/mp4" }), "awesome-movie.mp4");
      formData.append("label", "Main B2 Source");
      formData.append("quality", "1080p");

      const response = await request(customApp, {
        method: "POST",
        path: `/episodes/${episode.id}/sources/upload`,
        headers: authHeaders(accessToken),
        body: formData,
      });

      expect(response.status).toBe(200);
      const body = response.body as {
        data: {
          id: string;
          videoSources: Array<{ id: string; type: string; url: string; label: string; quality: string | null }>;
        };
      };

      expect(body.data.id).toBe(episode.id);
      expect(body.data.videoSources).toHaveLength(1);
      const createdSource = body.data.videoSources[0];
      expect(createdSource.type).toBe("s3");
      expect(createdSource.label).toBe("Main B2 Source");
      expect(createdSource.quality).toBe("1080p");
      // GET playback URL resolved for client response
      expect(createdSource.url).toContain("https://s3.signed.com/episodes/");

      // Check S3 storage call
      expect(uploadedKey).toMatch(new RegExp(`^episodes/${episode.id}/.+-awesome-movie\\.mp4$`));
      expect(uploadedContentType).toBe("video/mp4");
      expect(uploadedStream).toBeDefined();
      expect(streamReceivedBytes).toBe("my video binary data".length);

      // Check real DB row persisted S3 key
      const [dbSource] = await db
        .select()
        .from(videoSourcesTable)
        .where(eq(videoSourcesTable.id, createdSource.id));
      expect(dbSource).toBeDefined();
      expect(dbSource.type).toBe("s3");
      expect(dbSource.url).toBe(uploadedKey);
      expect(dbSource.label).toBe("Main B2 Source");
      expect(dbSource.quality).toBe("1080p");
    });

    it("returns HTTP 413 and FILE_TOO_LARGE when uploaded file exceeds max upload limit", async () => {
      const originalEnv = process.env.MAX_UPLOAD_SIZE_MB;
      process.env.MAX_UPLOAD_SIZE_MB = "10"; // 10MB limit for test

      try {
        const mockS3Service = {
          isConfigured: () => true,
          getPresignedUploadUrl: async () => ({ uploadUrl: "", key: "" }),
          getPresignedPlaybackUrl: async () => "",
          uploadObject: async () => {},
          uploadStream: async () => {},
          deleteObject: async () => {},
          deleteObjects: async () => {},
        };

        const customApp = await buildApp({ s3StorageService: mockS3Service });
        const { accessToken } = await registerUser(customApp);
        const episode = await insertTestEpisode();

        // Create a blob larger than 10MB (11MB)
        const largeBlob = new Blob([new Uint8Array(11 * 1024 * 1024)], { type: "video/mp4" });
        const formData = new FormData();
        formData.append("file", largeBlob, "large-movie.mp4");
        formData.append("label", "Oversized Source");

        const response = await request(customApp, {
          method: "POST",
          path: `/episodes/${episode.id}/sources/upload`,
          headers: authHeaders(accessToken),
          body: formData,
        });

        expect(response.status).toBe(413);
        const body = response.body as { error: { code: string; message: string } };
        expect(body.error).toBeDefined();
        expect(body.error.code).toBe("FILE_TOO_LARGE");
        expect(body.error.message).toBe("File size exceeds the maximum allowed limit of 10MB");
      } finally {
        process.env.MAX_UPLOAD_SIZE_MB = originalEnv;
      }
    });

    it("returns default 1GB error message when file exceeds default limit", async () => {
      const originalEnv = process.env.MAX_UPLOAD_SIZE_MB;
      process.env.MAX_UPLOAD_SIZE_MB = "1"; // Set to 1MB to test format mapping with a real 2MB blob

      try {
        const mockS3Service = {
          isConfigured: () => true,
          getPresignedUploadUrl: async () => ({ uploadUrl: "", key: "" }),
          getPresignedPlaybackUrl: async () => "",
          uploadObject: async () => {},
          uploadStream: async () => {},
          deleteObject: async () => {},
          deleteObjects: async () => {},
        };

        const customApp = await buildApp({ s3StorageService: mockS3Service });
        const { accessToken } = await registerUser(customApp);
        const episode = await insertTestEpisode();

        const largeBlob = new Blob([new Uint8Array(2 * 1024 * 1024)], { type: "video/mp4" });
        const formData = new FormData();
        formData.append("file", largeBlob, "2mb-movie.mp4");
        formData.append("label", "Oversized Source");

        const response = await request(customApp, {
          method: "POST",
          path: `/episodes/${episode.id}/sources/upload`,
          headers: authHeaders(accessToken),
          body: formData,
        });

        expect(response.status).toBe(413);
        const body = response.body as { error: { code: string; message: string } };
        expect(body.error).toBeDefined();
        expect(body.error.code).toBe("FILE_TOO_LARGE");
        expect(body.error.message).toBe("File size exceeds the maximum allowed limit of 1MB");
      } finally {
        if (originalEnv !== undefined) {
          process.env.MAX_UPLOAD_SIZE_MB = originalEnv;
        } else {
          delete process.env.MAX_UPLOAD_SIZE_MB;
        }
      }
    });

    it("handles request abort during streaming upload without unhandled errors", async () => {
      let signalAborted = false;

      const mockS3Service = {
        isConfigured: () => true,
        getPresignedUploadUrl: async () => ({ uploadUrl: "", key: "" }),
        getPresignedPlaybackUrl: async () => "",
        uploadObject: async () => {},
        uploadStream: async (_key: string, _body: ReadableStream | Readable, options?: StreamUploadOptions) => {
          if (options?.signal) {
            if (options.signal.aborted) {
              signalAborted = true;
              throw new Error("Aborted");
            }
            options.signal.addEventListener("abort", () => {
              signalAborted = true;
            });
          }
          // Simulate aborted stream
          throw options?.signal?.reason || new Error("Upload aborted");
        },
        deleteObject: async () => {},
        deleteObjects: async () => {},
      };

      const customApp = await buildApp({ s3StorageService: mockS3Service });
      const { accessToken } = await registerUser(customApp);
      const episode = await insertTestEpisode();

      const controller = new AbortController();
      controller.abort();

      const formData = new FormData();
      formData.append("file", new Blob(["video bytes"], { type: "video/mp4" }), "movie.mp4");
      formData.append("label", "Abort Test");

      const req = new Request(`http://localhost/api/episodes/${episode.id}/sources/upload`, {
        method: "POST",
        headers: {
          ...authHeaders(accessToken),
        },
        body: formData,
        signal: controller.signal,
      });

      const response = await customApp.handle(req);
      expect(response.status).toBeDefined();
      expect(signalAborted).toBe(true);
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
