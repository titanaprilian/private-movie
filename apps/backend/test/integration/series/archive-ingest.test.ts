import { describe, expect, it, beforeAll, afterEach } from "vitest";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { episodes, seasons, series, videoSources as videoSourcesTable } from "@repo/db";
import { buildApp, type App } from "../../utils/app";
import { registerUser, authHeaders } from "../../utils/auth";
import { createMockS3 } from "../../utils/s3";
import { db } from "../../utils/db";
import { eq } from "drizzle-orm";
import type { StreamUploadOptions } from "@repo/media-service";
import type { Readable } from "node:stream";

function parseSSE(sseText: string): Array<{ event: string; data: Record<string, unknown> }> {
  const blocks = sseText.split("\n\n").filter((b) => b.trim().length > 0);
  const events: Array<{ event: string; data: Record<string, unknown> }> = [];
  for (const block of blocks) {
    const lines = block.split("\n");
    let event = "";
    let dataStr = "";
    for (const line of lines) {
      if (line.startsWith("event: ")) {
        event = line.substring(7).trim();
      } else if (line.startsWith("data: ")) {
        dataStr = line.substring(6).trim();
      }
    }
    if (event && dataStr) {
      try {
        events.push({ event, data: JSON.parse(dataStr) as Record<string, unknown> });
      } catch {
        events.push({ event, data: { raw: dataStr } });
      }
    }
  }
  return events;
}

let testTmpBase = "";

beforeAll(() => {
  testTmpBase = mkdtempSync(join(tmpdir(), "archive-ingest-test-"));
});

afterEach(() => {
  try {
    rmSync(testTmpBase, { recursive: true, force: true });
    testTmpBase = mkdtempSync(join(tmpdir(), "archive-ingest-test-"));
  } catch {
    /* ignore */
  }
});

async function createSeriesAndEpisodes() {
  const now = new Date();
  const [sRow] = await db
    .insert(series)
    .values({
      id: crypto.randomUUID(),
      title: "Archive Ingest Test Series",
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  const [seasonRow] = await db
    .insert(seasons)
    .values({
      id: crypto.randomUUID(),
      seriesId: sRow.id,
      title: "Season 1",
      seasonNumber: 1,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  const [ep1] = await db
    .insert(episodes)
    .values({
      id: crypto.randomUUID(),
      seasonId: seasonRow.id,
      title: "Episode 1",
      order: 1,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  const [ep2] = await db
    .insert(episodes)
    .values({
      id: crypto.randomUUID(),
      seasonId: seasonRow.id,
      title: "Episode 2",
      order: 2,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return { seriesId: sRow.id, seasonId: seasonRow.id, ep1Id: ep1.id, ep2Id: ep2.id };
}

describe("Series Archive Ingest Endpoints", () => {
  let app: App;

  beforeAll(async () => {
    app = await buildApp();
  });

  describe("POST /api/series/:id/archive-ingest/preview", () => {
    it("returns 401 Unauthorized when token is missing", async () => {
      const response = await app.handle(
        new Request(`http://localhost/api/series/${crypto.randomUUID()}/archive-ingest/preview`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: "https://example.com/pack.zip" }),
        })
      );
      expect(response.status).toBe(401);
    });

    it("returns 404 SERIES_NOT_FOUND when series does not exist", async () => {
      const { accessToken } = await registerUser(app);
      const response = await app.handle(
        new Request(`http://localhost/api/series/${crypto.randomUUID()}/archive-ingest/preview`, {
          method: "POST",
          headers: {
            ...authHeaders(accessToken),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ url: "https://example.com/pack.zip" }),
        })
      );
      expect(response.status).toBe(404);
    });

    it("streams download_progress, extract_progress, and preview_ready SSE events", async () => {
      const { seriesId, ep1Id, ep2Id } = await createSeriesAndEpisodes();

      const customApp = await buildApp({
        archiveStagingBaseDir: testTmpBase,
        archiveFetchFn: async () => {
          const content = new TextEncoder().encode("mock-zip-binary-data");
          const stream = new ReadableStream({
            start(controller) {
              controller.enqueue(content);
              controller.close();
            },
          });
          return new Response(stream, {
            status: 200,
            headers: { "Content-Length": String(content.byteLength) },
          });
        },
        archiveExtractFn: async (opts) => {
          await mkdir(opts.destDir, { recursive: true });
          await writeFile(join(opts.destDir, "Series.S01E01.1080p.mp4"), "video1");
          await writeFile(join(opts.destDir, "Series.S01E02.1080p.mp4"), "video2");
        },
      });

      const { accessToken } = await registerUser(customApp);

      const response = await customApp.handle(
        new Request(`http://localhost/api/series/${seriesId}/archive-ingest/preview`, {
          method: "POST",
          headers: {
            ...authHeaders(accessToken),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ url: "https://example.com/season1.zip" }),
        })
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/event-stream");

      const text = await response.text();
      const events = parseSSE(text);

      expect(events.some((e) => e.event === "download_progress")).toBe(true);
      expect(events.some((e) => e.event === "extract_progress")).toBe(true);

      const readyEvent = events.find((e) => e.event === "preview_ready");
      expect(readyEvent).toBeDefined();

      const data = readyEvent?.data as {
        stagingSessionId: string;
        items: Array<{ filename: string; matchedEpisodeId: string | null }>;
      };
      expect(data.stagingSessionId).toBeDefined();
      expect(data.items.length).toBe(2);

      const ep1Match = data.items.find((i) => i.filename.includes("E01"));
      const ep2Match = data.items.find((i) => i.filename.includes("E02"));
      expect(ep1Match?.matchedEpisodeId).toBe(ep1Id);
      expect(ep2Match?.matchedEpisodeId).toBe(ep2Id);
    });
  });

  describe("POST /api/series/:id/archive-ingest/commit", () => {
    it("streams upload_progress, file_completed, and all_completed, uploads S3, inserts DB rows, and deletes staging", async () => {
      const { seriesId, ep1Id, ep2Id } = await createSeriesAndEpisodes();

      let uploadedCount = 0;
      const mockS3 = createMockS3({
        uploadStream: async (key: string, bodyStream: ReadableStream<Uint8Array> | Readable, opts?: StreamUploadOptions) => {
          uploadedCount += 1;
          const reader = (bodyStream as ReadableStream<Uint8Array>).getReader();
          let loaded = 0;
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            loaded += value.byteLength;
            opts?.onProgress?.({ loaded, total: loaded });
          }
        },
      });

      const customApp = await buildApp({
        s3StorageService: mockS3,
        archiveStagingBaseDir: testTmpBase,
        archiveFetchFn: async () => {
          const content = new TextEncoder().encode("mock-archive");
          return new Response(content, { status: 200, headers: { "Content-Length": "12" } });
        },
        archiveExtractFn: async (opts) => {
          await mkdir(opts.destDir, { recursive: true });
          await writeFile(join(opts.destDir, "S01E01.mp4"), "video-1-bytes");
          await writeFile(join(opts.destDir, "S01E02.mp4"), "video-2-bytes");
        },
      });

      const { accessToken } = await registerUser(customApp);

      // Step 1: Preview
      const previewRes = await customApp.handle(
        new Request(`http://localhost/api/series/${seriesId}/archive-ingest/preview`, {
          method: "POST",
          headers: {
            ...authHeaders(accessToken),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ url: "https://example.com/season1.zip" }),
        })
      );
      const previewText = await previewRes.text();
      const previewEvents = parseSSE(previewText);
      const ready = previewEvents.find((e) => e.event === "preview_ready")?.data as {
        stagingSessionId: string;
        items: Array<{ fileId: string; filename: string }>;
      };
      const previewSessionId = ready.stagingSessionId;
      const stagedItems = ready.items;

      expect(previewSessionId).toBeDefined();
      expect(stagedItems.length).toBeGreaterThan(0);

      // Step 2: Commit
      const commitRes = await customApp.handle(
        new Request(`http://localhost/api/series/${seriesId}/archive-ingest/commit`, {
          method: "POST",
          headers: {
            ...authHeaders(accessToken),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            stagingSessionId: previewSessionId,
            storageProviderId: "",
            defaultLabel: "Archive Ingest S3",
            items: [
              {
                fileId: stagedItems.find((i) => i.filename.includes("E01"))!.fileId,
                episodeId: ep1Id,
                quality: "1080p",
              },
              {
                fileId: stagedItems.find((i) => i.filename.includes("E02"))!.fileId,
                episodeId: ep2Id,
                quality: "1080p",
              },
            ],
          }),
        })
      );

      expect(commitRes.status).toBe(200);
      const commitText = await commitRes.text();
      const commitEvents = parseSSE(commitText);

      expect(commitEvents.some((e) => e.event === "upload_progress")).toBe(true);
      expect(commitEvents.filter((e) => e.event === "file_completed")).toHaveLength(2);

      const allCompleted = commitEvents.find((e) => e.event === "all_completed");
      expect(allCompleted).toBeDefined();
      expect((allCompleted?.data as { count: number }).count).toBe(2);

      expect(uploadedCount).toBe(2);

      const sourcesEp1 = await db
        .select()
        .from(videoSourcesTable)
        .where(eq(videoSourcesTable.episodeId, ep1Id));
      expect(sourcesEp1).toHaveLength(1);
      expect(sourcesEp1[0].label).toBe("Archive Ingest S3");
      expect(sourcesEp1[0].quality).toBe("1080p");
      expect(sourcesEp1[0].type).toBe("s3");

      const sourcesEp2 = await db
        .select()
        .from(videoSourcesTable)
        .where(eq(videoSourcesTable.episodeId, ep2Id));
      expect(sourcesEp2).toHaveLength(1);

      // Verify cleanup after commit
      const checkCleanupRes = await customApp.handle(
        new Request(`http://localhost/api/series/${seriesId}/archive-ingest/commit`, {
          method: "POST",
          headers: {
            ...authHeaders(accessToken),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            stagingSessionId: previewSessionId,
            storageProviderId: "",
            items: [],
          }),
        })
      );
      const checkText = await checkCleanupRes.text();
      const checkEvents = parseSSE(checkText);
      expect(checkEvents.some((e) => e.event === "error" && (e.data as { code: string }).code === "STAGING_SESSION_NOT_FOUND")).toBe(true);
    });
  });

  describe("DELETE /api/series/:id/archive-ingest/:sessionId", () => {
    it("removes staging directory immediately", async () => {
      const { seriesId } = await createSeriesAndEpisodes();

      const customApp = await buildApp({
        archiveStagingBaseDir: testTmpBase,
        archiveFetchFn: async () => new Response("pack", { status: 200 }),
        archiveExtractFn: async (opts) => {
          await mkdir(opts.destDir, { recursive: true });
          await writeFile(join(opts.destDir, "S01E01.mp4"), "video");
        },
      });

      const { accessToken } = await registerUser(customApp);

      const previewRes = await customApp.handle(
        new Request(`http://localhost/api/series/${seriesId}/archive-ingest/preview`, {
          method: "POST",
          headers: {
            ...authHeaders(accessToken),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ url: "https://example.com/pack.zip" }),
        })
      );
      const text = await previewRes.text();
      const ready = parseSSE(text).find((e) => e.event === "preview_ready")?.data as {
        stagingSessionId: string;
      };
      const sessionId = ready.stagingSessionId;

      const deleteRes = await customApp.handle(
        new Request(`http://localhost/api/series/${seriesId}/archive-ingest/${sessionId}`, {
          method: "DELETE",
          headers: authHeaders(accessToken),
        })
      );

      expect(deleteRes.status).toBe(200);
      const body = (await deleteRes.json()) as { data: { success: boolean } };
      expect(body.data.success).toBe(true);
    });
  });
});
