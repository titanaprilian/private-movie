import { describe, expect, it, beforeAll } from "vitest";
import { buildApp, request, type App } from "../../utils/app";
import { registerUser, authHeaders } from "../../utils/auth";
import { db } from "../../utils/db";
import { episodes, seasons, series } from "@repo/db";
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

async function insertTestEpisode(): Promise<{ id: string; title: string }> {
  const id = crypto.randomUUID();
  const title = "Upload Progress Test Episode";
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

describe("Upload Progress API", () => {
  let app: App;

  beforeAll(async () => {
    app = await buildApp();
  });

  describe("GET /episodes/upload-progress/:sessionId", () => {
    it("returns 404 UPLOAD_SESSION_NOT_FOUND when session is not found", async () => {
      const sessionId = crypto.randomUUID();

      const response = await request(app, {
        path: `/episodes/upload-progress/${sessionId}`,
      });

      expect(response.status).toBe(404);
      const body = response.body as { error: { code: string; message: string } };
      expect(body.error.code).toBe("UPLOAD_SESSION_NOT_FOUND");
    });

    it("returns live progress during active upload and cleans up 404 when upload finishes", async () => {
      const sessionId = crypto.randomUUID();
      let progressDuringUpload: { loaded: number; total: number; percent: number } | null = null;

      const mockS3Service = {
        isConfigured: () => true,
        getPresignedUploadUrl: async () => ({ uploadUrl: "", key: "" }),
        getPresignedPlaybackUrl: async () => "",
        uploadObject: async () => {},
        uploadStream: async (_key: string, body: ReadableStream | Readable, options?: StreamUploadOptions) => {
          // Read stream and invoke progress
          options?.onProgress?.({ loaded: 500, total: 1000 });
          // Fetch live progress endpoint mid-stream
          const progressRes = await request(customApp, {
            path: `/episodes/upload-progress/${sessionId}`,
          });
          if (progressRes.status === 200) {
            progressDuringUpload = (progressRes.body as { data: { loaded: number; total: number; percent: number } }).data;
          }

          options?.onProgress?.({ loaded: 1000, total: 1000 });
        },
        deleteObject: async () => {},
        deleteObjects: async () => {},
      };

      const customApp = await buildApp({ s3StorageService: mockS3Service });
      const { accessToken } = await registerUser(customApp);
      const episode = await insertTestEpisode();

      const formData = new FormData();
      formData.append("file", new Blob([new Uint8Array(1000)], { type: "video/mp4" }), "progress-video.mp4");
      formData.append("label", "Progress Source");
      formData.append("uploadSessionId", sessionId);

      const response = await request(customApp, {
        method: "POST",
        path: `/episodes/${episode.id}/sources/upload`,
        headers: authHeaders(accessToken),
        body: formData,
      });

      expect(response.status).toBe(200);

      // Verify progress queried during active stream
      expect(progressDuringUpload).not.toBeNull();
      expect(progressDuringUpload).toEqual({
        loaded: 500,
        total: 1000,
        percent: 50,
      });

      // Verify cleanup after upload finishes
      const postUploadRes = await request(customApp, {
        path: `/episodes/upload-progress/${sessionId}`,
      });
      expect(postUploadRes.status).toBe(404);
      expect((postUploadRes.body as { error: { code: string } }).error.code).toBe("UPLOAD_SESSION_NOT_FOUND");
    });
  });
});
