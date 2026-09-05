import { describe, expect, it, beforeAll, afterEach } from "vitest";
import { videoSources as videoSourcesTable, seasons, series, episodes } from "@repo/db";
import { buildApp, type App } from "../../utils/app";
import { registerUser, authHeaders } from "../../utils/auth";
import { db } from "../../utils/db";
import { eq } from "drizzle-orm";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function parseSSE(sseText: string): Array<{ event: string; data: any }> {
  const blocks = sseText.split("\n\n").filter((b) => b.trim().length > 0);
  const events: Array<{ event: string; data: any }> = [];
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
        events.push({ event, data: JSON.parse(dataStr) });
      } catch {
        events.push({ event, data: dataStr });
      }
    }
  }
  return events;
}

async function ensureSeason(id: string): Promise<string> {
  const [existing] = await db.select().from(seasons).where(eq(seasons.id, id));
  if (existing) return existing.id;

  const now = new Date();
  const [sRow] = await db
    .insert(series)
    .values({
      id: crypto.randomUUID(),
      title: "Test Series Remote Ingest",
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  const [seasonRow] = await db
    .insert(seasons)
    .values({
      id,
      seriesId: sRow.id,
      title: "Test Season Remote Ingest",
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
  const title = overrides?.title ?? "Remote Ingest Test Episode";
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

describe("POST /api/episodes/:id/sources/remote-ingest (SSE)", () => {
  let app: App;

  beforeAll(async () => {
    app = await buildApp();
  });

  it("returns 401 Unauthorized when missing or invalid Bearer token", async () => {
    const episode = await insertTestEpisode();

    const response = await app.handle(
      new Request(`http://localhost/api/episodes/${episode.id}/sources/remote-ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: "https://example.com/video.mp4",
          label: "S3 Video",
        }),
      })
    );

    expect(response.status).toBe(401);
  });

  it("returns 404 EPISODE_NOT_FOUND when targeted episode does not exist", async () => {
    const { accessToken } = await registerUser(app);
    const nonexistentId = crypto.randomUUID();

    const response = await app.handle(
      new Request(`http://localhost/api/episodes/${nonexistentId}/sources/remote-ingest`, {
        method: "POST",
        headers: {
          ...authHeaders(accessToken),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: "https://example.com/video.mp4",
          label: "S3 Video",
        }),
      })
    );

    expect(response.status).toBe(404);
    const body = (await response.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("EPISODE_NOT_FOUND");
  });

  it("returns 503 S3_NOT_CONFIGURED when S3 credentials are unconfigured", async () => {
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

    const response = await unconfiguredApp.handle(
      new Request(`http://localhost/api/episodes/${episode.id}/sources/remote-ingest`, {
        method: "POST",
        headers: {
          ...authHeaders(accessToken),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: "https://example.com/video.mp4",
          label: "S3 Video",
        }),
      })
    );

    expect(response.status).toBe(503);
    const body = (await response.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("S3_NOT_CONFIGURED");
  });

  it("successfully ingests remote video stream to S3, emits SSE progress and complete events, and saves s3 source in DB", async () => {
    let capturedUploadKey = "";
    let capturedUploadOptions: any = null;

    const mockS3Service = {
      isConfigured: () => true,
      getPresignedUploadUrl: async (key: string) => ({ uploadUrl: `https://s3.example.com/${key}`, key }),
      getPresignedPlaybackUrl: async (key: string) => `https://s3.signed.com/${key}?signed=true`,
      uploadObject: async () => {},
      uploadStream: async (key: string, bodyStream: any, options?: any) => {
        capturedUploadKey = key;
        capturedUploadOptions = options;
        const reader = bodyStream.getReader();
        let loadedBytes = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          loadedBytes += value.byteLength;
          options?.onProgress?.({ loaded: loadedBytes, total: 200 });
        }
      },
      deleteObject: async () => {},
      deleteObjects: async () => {},
    };

    const customApp = await buildApp({ s3StorageService: mockS3Service });
    const { accessToken } = await registerUser(customApp);
    const episode = await insertTestEpisode();

    // Insert an existing direct source to verify non-destructive behavior
    await db.insert(videoSourcesTable).values({
      id: crypto.randomUUID(),
      episodeId: episode.id,
      type: "direct",
      url: "https://example.com/original.mp4",
      label: "Existing Direct Source",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    let outboundHeaders: Record<string, string> = {};
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString();
      if (url.startsWith("https://remote-host.com/")) {
        outboundHeaders = Object.fromEntries(new Headers(init?.headers).entries());
        const chunk1 = new TextEncoder().encode("A".repeat(100));
        const chunk2 = new TextEncoder().encode("B".repeat(100));
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(chunk1);
            controller.enqueue(chunk2);
            controller.close();
          },
        });
        return new Response(stream, {
          status: 200,
          headers: {
            "Content-Type": "video/mp4",
            "Content-Length": "200",
          },
        });
      }
      return originalFetch(input, init);
    }) as typeof fetch;

    const response = await customApp.handle(
      new Request(`http://localhost/api/episodes/${episode.id}/sources/remote-ingest`, {
        method: "POST",
        headers: {
          ...authHeaders(accessToken),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: "https://remote-host.com/files/action-movie-1080p.mp4",
          label: "S3 1080p Ingested",
          quality: "1080p",
          referer: "https://custom-referer.org/watch",
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");

    const sseText = await response.text();
    const events = parseSSE(sseText);

    // Verify progress and complete events
    const progressEvents = events.filter((e) => e.event === "progress");
    const completeEvent = events.find((e) => e.event === "complete");

    expect(progressEvents.length).toBeGreaterThan(0);
    const lastProgress = progressEvents[progressEvents.length - 1];
    expect(lastProgress.data).toEqual({
      loaded: 200,
      total: 200,
      percent: 100,
    });

    expect(completeEvent).toBeDefined();
    expect(completeEvent?.data.videoSource.type).toBe("s3");
    expect(completeEvent?.data.videoSource.label).toBe("S3 1080p Ingested");
    expect(completeEvent?.data.videoSource.quality).toBe("1080p");
    expect(completeEvent?.data.episode.id).toBe(episode.id);

    // Verify User-Agent and Referer headers forwarded
    expect(outboundHeaders["user-agent"]).toContain("Mozilla/5.0");
    expect(outboundHeaders["referer"]).toBe("https://custom-referer.org/watch");

    // Verify S3 key format
    expect(capturedUploadKey).toMatch(new RegExp(`^episodes/${episode.id}/.+-action-movie-1080p\\.mp4$`));

    // Verify DB persistence & non-destructive behavior
    const sourcesInDb = await db
      .select()
      .from(videoSourcesTable)
      .where(eq(videoSourcesTable.episodeId, episode.id));
    expect(sourcesInDb).toHaveLength(2);
    expect(sourcesInDb.map((s) => s.type)).toContain("direct");
    expect(sourcesInDb.map((s) => s.type)).toContain("s3");
  });

  it("defaults referer header to target URL origin when referer is omitted", async () => {
    const mockS3Service = {
      isConfigured: () => true,
      getPresignedUploadUrl: async (key: string) => ({ uploadUrl: `https://s3.example.com/${key}`, key }),
      getPresignedPlaybackUrl: async (key: string) => `https://s3.signed.com/${key}`,
      uploadObject: async () => {},
      uploadStream: async (_key: string, bodyStream: any) => {
        const reader = bodyStream.getReader();
        while (true) {
          const { done } = await reader.read();
          if (done) break;
        }
      },
      deleteObject: async () => {},
      deleteObjects: async () => {},
    };

    const customApp = await buildApp({ s3StorageService: mockS3Service });
    const { accessToken } = await registerUser(customApp);
    const episode = await insertTestEpisode();

    let outboundHeaders: Record<string, string> = {};
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString();
      if (url.startsWith("https://cdn.provider.com/")) {
        outboundHeaders = Object.fromEntries(new Headers(init?.headers).entries());
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode("data"));
            controller.close();
          },
        });
        return new Response(stream, { status: 200 });
      }
      return originalFetch(input, init);
    }) as typeof fetch;

    const response = await customApp.handle(
      new Request(`http://localhost/api/episodes/${episode.id}/sources/remote-ingest`, {
        method: "POST",
        headers: {
          ...authHeaders(accessToken),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: "https://cdn.provider.com/stream/v1.mp4",
          label: "Default Referer Source",
        }),
      })
    );

    expect(response.status).toBe(200);
    await response.text();
    expect(outboundHeaders["referer"]).toBe("https://cdn.provider.com");
  });

  it("emits error event and does not write to database when remote HTTP fetch fails (e.g. 404 from host)", async () => {
    const mockS3Service = {
      isConfigured: () => true,
      getPresignedUploadUrl: async (key: string) => ({ uploadUrl: `https://s3.example.com/${key}`, key }),
      getPresignedPlaybackUrl: async (key: string) => `https://s3.signed.com/${key}`,
      uploadObject: async () => {},
      uploadStream: async () => {},
      deleteObject: async () => {},
      deleteObjects: async () => {},
    };

    const customApp = await buildApp({ s3StorageService: mockS3Service });
    const { accessToken } = await registerUser(customApp);
    const episode = await insertTestEpisode();

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString();
      if (url.startsWith("https://broken-link.com/")) {
        return new Response("Not Found", { status: 404, statusText: "Not Found" });
      }
      return originalFetch(input, init);
    }) as typeof fetch;

    const response = await customApp.handle(
      new Request(`http://localhost/api/episodes/${episode.id}/sources/remote-ingest`, {
        method: "POST",
        headers: {
          ...authHeaders(accessToken),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: "https://broken-link.com/video-404.mp4",
          label: "Broken Source",
        }),
      })
    );

    expect(response.status).toBe(200);
    const sseText = await response.text();
    const events = parseSSE(sseText);

    const errorEvent = events.find((e) => e.event === "error");
    expect(errorEvent).toBeDefined();
    expect(errorEvent?.data.code).toBe("REMOTE_FETCH_FAILED");
    expect(errorEvent?.data.message).toContain("404");

    // DB should remain empty for this episode
    const sourcesInDb = await db
      .select()
      .from(videoSourcesTable)
      .where(eq(videoSourcesTable.episodeId, episode.id));
    expect(sourcesInDb).toHaveLength(0);
  });

  it("automatically terminates upstream fetch and S3 upload when client signal aborts", async () => {
    let s3UploadAborted = false;

    const mockS3Service = {
      isConfigured: () => true,
      getPresignedUploadUrl: async (key: string) => ({ uploadUrl: `https://s3.example.com/${key}`, key }),
      getPresignedPlaybackUrl: async (key: string) => `https://s3.signed.com/${key}`,
      uploadObject: async () => {},
      uploadStream: async (_key: string, bodyStream: any, options?: any) => {
        if (options?.signal?.aborted) {
          s3UploadAborted = true;
          throw new Error("Upload aborted");
        }
        return new Promise<void>((resolve, reject) => {
          const onAbort = () => {
            s3UploadAborted = true;
            reject(new Error("Upload aborted"));
          };
          options?.signal?.addEventListener("abort", onAbort, { once: true });

          const reader = bodyStream.getReader();
          const readChunk = async () => {
            try {
              const { done } = await reader.read();
              if (done) resolve();
              else readChunk();
            } catch (err) {
              s3UploadAborted = true;
              reject(err);
            }
          };
          readChunk();
        });
      },
      deleteObject: async () => {},
      deleteObjects: async () => {},
    };

    const customApp = await buildApp({ s3StorageService: mockS3Service });
    const { accessToken } = await registerUser(customApp);
    const episode = await insertTestEpisode();

    let fetchSignalAborted = false;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString();
      if (url.startsWith("https://abort-test.com/")) {
        const signal = init?.signal;
        signal?.addEventListener("abort", () => {
          fetchSignalAborted = true;
        });
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode("chunk-1"));
            // Keep stream open
          },
        });
        return new Response(stream, { status: 200 });
      }
      return originalFetch(input, init);
    }) as typeof fetch;

    const clientAbortController = new AbortController();

    const responsePromise = customApp.handle(
      new Request(`http://localhost/api/episodes/${episode.id}/sources/remote-ingest`, {
        method: "POST",
        headers: {
          ...authHeaders(accessToken),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: "https://abort-test.com/large-file.mp4",
          label: "Abort Source",
        }),
        signal: clientAbortController.signal,
      })
    );

    // Give the request a moment to start streaming
    await new Promise((r) => setTimeout(r, 50));
    clientAbortController.abort();

    try {
      await responsePromise;
    } catch {
      // Abort exception expected
    }

    expect(fetchSignalAborted).toBe(true);
    expect(s3UploadAborted).toBe(true);

    // Verify DB row not written
    const sourcesInDb = await db
      .select()
      .from(videoSourcesTable)
      .where(eq(videoSourcesTable.episodeId, episode.id));
    expect(sourcesInDb).toHaveLength(0);
  });

  it("handles S3 uploadStream exception cleanly, logs error, and flushes error event over SSE", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const mockS3Service = {
      isConfigured: () => true,
      getPresignedUploadUrl: async (key: string) => ({ uploadUrl: `https://s3.example.com/${key}`, key }),
      getPresignedPlaybackUrl: async (key: string) => `https://s3.signed.com/${key}`,
      uploadObject: async () => {},
      uploadStream: async () => {
        throw new Error("S3 connection timeout during multipart upload completion");
      },
      deleteObject: async () => {},
      deleteObjects: async () => {},
    };

    const customApp = await buildApp({ s3StorageService: mockS3Service });
    const { accessToken } = await registerUser(customApp);
    const episode = await insertTestEpisode();

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString();
      if (url.startsWith("https://s3-error-test.com/")) {
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode("chunk-1"));
            controller.close();
          },
        });
        return new Response(stream, { status: 200 });
      }
      return originalFetch(input, init);
    }) as typeof fetch;

    const response = await customApp.handle(
      new Request(`http://localhost/api/episodes/${episode.id}/sources/remote-ingest`, {
        method: "POST",
        headers: {
          ...authHeaders(accessToken),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: "https://s3-error-test.com/large-video.mp4",
          label: "S3 Error Source",
        }),
      })
    );

    expect(response.status).toBe(200);
    const sseText = await response.text();
    const events = parseSSE(sseText);

    const errorEvent = events.find((e) => e.event === "error");
    expect(errorEvent).toBeDefined();
    expect(errorEvent?.data.code).toBe("INGEST_FAILED");
    expect(errorEvent?.data.message).toBe("S3 connection timeout during multipart upload completion");

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[remote-ingest] Remote video ingestion failed:",
      expect.any(Error)
    );

    // Verify DB row not written
    const sourcesInDb = await db
      .select()
      .from(videoSourcesTable)
      .where(eq(videoSourcesTable.episodeId, episode.id));
    expect(sourcesInDb).toHaveLength(0);

    consoleErrorSpy.mockRestore();
  });
});
