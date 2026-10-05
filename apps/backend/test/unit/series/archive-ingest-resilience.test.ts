import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/lib/sentry", () => ({
  captureException: vi.fn(),
  initSentry: vi.fn(() => false),
}));
vi.mock("../../../src/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), child: vi.fn() },
  createLogger: vi.fn(),
}));

import { captureException } from "../../../src/lib/sentry";
import { logger } from "../../../src/lib/logger";
import { ArchiveIngestService } from "../../../src/modules/series";
import { shouldSendHeartbeat } from "../../../src/lib/sse-progress";

function sseEvents(text: string): { event: string; data: unknown }[] {
  return text
    .split("\n\n")
    .filter(Boolean)
    .filter((block) => !block.startsWith(":"))
    .map((block) => {
      const el = block.split("\n").find((l) => l.startsWith("event: "))!.slice(7);
      const dl = block.split("\n").find((l) => l.startsWith("data: "))!.slice(6);
      return { event: el, data: JSON.parse(dl) };
    });
}

async function readAll(stream: ReadableStream): Promise<string> {
  const reader = stream.getReader();
  const dec = new TextDecoder();
  let out = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    out += dec.decode(value, { stream: true });
  }
  return out;
}

function chunkedBody(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(c) {
      for (const ch of chunks) c.enqueue(ch);
      c.close();
    },
  });
}

describe("archive-ingest resilience", () => {
  const sandboxes: string[] = [];
  afterEach(async () => {
    await Promise.all(sandboxes.splice(0).map((d) => rm(d, { recursive: true, force: true })));
    vi.clearAllMocks();
  });
  async function base(): Promise<string> {
    const d = await mkdtemp(join(tmpdir(), "ingest-res-"));
    sandboxes.push(d);
    return join(d, "sessions");
  }

  function serviceWith(stubs: {
    fetchFn: (url: string, init?: RequestInit) => Promise<Response>;
    totalHeader: string | null;
    chunks: Uint8Array[];
    explode?: boolean;
  }, stagingBaseDir: string) {
    const svc = new ArchiveIngestService({
      db: {} as never,
      stagingBaseDir,
      fetchFn: stubs.fetchFn,
      extractFn: async () => {},
      createSessionId: () => "sess-1",
    });
    (svc as unknown as Record<string, unknown>).resolveSeriesOrThrow = async () => ({
      findByIdWithEpisodes: async () => ({ episodes: [] }),
    });
    return svc;
  }

  it("throttles download_progress events (many chunks, few events)", async () => {
    const b = await base();
    const chunks = Array.from({ length: 50 }, () => new Uint8Array(1024));
    const svc = serviceWith({
      chunks,
      totalHeader: null,
      fetchFn: async () => new Response(chunkedBody(chunks), { status: 200 }),
    }, b);
    const stream = svc.previewStream("series-1", { url: "https://x/archive.zip" } as never, new AbortController().signal);
    const events = sseEvents(await readAll(stream));
    const progress = events.filter((e) => e.event === "download_progress");
    // 50 chunks would flood without throttling; throttled output must be far fewer
    expect(progress.length).toBeLessThan(50);
    expect(progress.length).toBeGreaterThan(0);
  });

  it("aborts truncated downloads with DOWNLOAD_INCOMPLETE before extraction", async () => {
    const b = await base();
    const chunks = [new Uint8Array(1024), new Uint8Array(1024)];
    let extracted = false;
    const svc = new ArchiveIngestService({
      db: {} as never,
      stagingBaseDir: b,
      fetchFn: async () =>
        new Response(chunkedBody(chunks), {
          status: 200,
          headers: { "content-length": String(10 * 1024) },
        }),
      extractFn: async () => { extracted = true; },
      createSessionId: () => "sess-2",
    });
    (svc as unknown as Record<string, unknown>).resolveSeriesOrThrow = async () => ({
      findByIdWithEpisodes: async () => ({ episodes: [] }),
    });
    const stream = svc.previewStream("series-1", { url: "https://x/archive.zip" } as never, new AbortController().signal);
    const events = sseEvents(await readAll(stream));
    const err = events.find((e) => e.event === "error");
    expect(extracted).toBe(false);
    expect(err?.data).toMatchObject({ code: "DOWNLOAD_INCOMPLETE" });
  });

  it("reports unhandled streaming failures to Sentry and logger", async () => {
    const b = await base();
    const svc = new ArchiveIngestService({
      db: {} as never,
      stagingBaseDir: b,
      fetchFn: async () => { throw new Error("boom-stream"); },
      extractFn: async () => {},
      createSessionId: () => "sess-3",
    });
    (svc as unknown as Record<string, unknown>).resolveSeriesOrThrow = async () => ({
      findByIdWithEpisodes: async () => ({ episodes: [] }),
    });
    const stream = svc.previewStream("series-1", { url: "https://x/archive.zip" } as never, new AbortController().signal);
    const events = sseEvents(await readAll(stream));
    expect(events.some((e) => e.event === "error")).toBe(true);
    expect(captureException).toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
  });

  it("survives client SSE disconnect without aborting download or extraction", async () => {
    const b = await base();
    const chunks = [new Uint8Array(512), new Uint8Array(512)];
    let extracted = false;
    const svc = new ArchiveIngestService({
      db: {} as never,
      stagingBaseDir: b,
      fetchFn: async () => new Response(chunkedBody(chunks), { status: 200 }),
      extractFn: async () => { extracted = true; },
      createSessionId: () => "sess-disconnect",
    });
    (svc as unknown as Record<string, unknown>).resolveSeriesOrThrow = async () => ({
      findByIdWithEpisodes: async () => ({ episodes: [] }),
    });
    // Client socket already gone — server-side work must still proceed.
    const dead = new AbortController();
    dead.abort();
    const stream = svc.previewStream("series-1", { url: "https://x/archive.zip" } as never, dead.signal);
    const raw = await readAll(stream);
    const events = sseEvents(raw);
    expect(extracted).toBe(true);
    expect(events.some((e) => e.event === "preview_ready")).toBe(true);
    expect(raw).not.toContain("AbortError");
  });

  it("aborts in-progress download on explicit deleteSession and cleans up", async () => {
    const b = await base();
    let sawAbort = false;
    const hangingBody = (_signal?: AbortSignal | null) =>
      new ReadableStream<Uint8Array>({
        start(c) {
          const timer = setTimeout(() => {
            try { c.enqueue(new Uint8Array(8)); c.close(); } catch { /* late */ }
          }, 5000);
          _signal?.addEventListener("abort", () => {
            sawAbort = true;
            clearTimeout(timer);
            try { c.error(new DOMException("Aborted", "AbortError")); } catch { /* ignore */ }
          });
        },
      });
    const svc = new ArchiveIngestService({
      db: {} as never,
      stagingBaseDir: b,
      fetchFn: async (_url, init) => new Response(hangingBody(init?.signal ?? null), { status: 200 }),
      extractFn: async () => {},
      createSessionId: () => "sess-cancel",
    });
    (svc as unknown as Record<string, unknown>).resolveSeriesOrThrow = async () => ({
      findByIdWithEpisodes: async () => ({ episodes: [] }),
    });
    const stream = svc.previewStream("series-1", { url: "https://x/archive.zip" } as never, new AbortController().signal);
    const reading = readAll(stream);
    await new Promise((r) => setTimeout(r, 100));
    await svc.deleteSession("sess-cancel");
    await reading;
    expect(sawAbort).toBe(true);
    await expect(stat(join(b, "sess-cancel"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("emits SSE ping heartbeat when no progress for the interval", async () => {
    expect(shouldSendHeartbeat(0, 15_000)).toBe(true);
    expect(shouldSendHeartbeat(10_000, 15_000)).toBe(false);
    const b = await base();
    const delayedBody = new ReadableStream<Uint8Array>({
      async start(c) {
        await new Promise((r) => setTimeout(r, 150));
        c.enqueue(new Uint8Array(16));
        c.close();
      },
    });
    const svc = new ArchiveIngestService({
      db: {} as never,
      stagingBaseDir: b,
      fetchFn: async () => new Response(delayedBody, { status: 200 }),
      extractFn: async () => {},
      createSessionId: () => "sess-ping",
      heartbeatMs: 30,
    });
    (svc as unknown as Record<string, unknown>).resolveSeriesOrThrow = async () => ({
      findByIdWithEpisodes: async () => ({ episodes: [] }),
    });
    const stream = svc.previewStream("series-1", { url: "https://x/archive.zip" } as never, new AbortController().signal);
    const raw = await readAll(stream);
    expect(raw).toContain(": ping");
  });

  it("rejects archives larger than MAX_ARCHIVE_DOWNLOAD_MB without downloading", async () => {
    const b = await base();
    let fetchCalls = 0;
    let extracted = false;
    const svc = new ArchiveIngestService({
      db: {} as never,
      stagingBaseDir: b,
      maxArchiveBytes: 1024,
      fetchFn: async () => {
        fetchCalls += 1;
        return new Response(chunkedBody([new Uint8Array(2048)]), {
          status: 200,
          headers: { "content-length": String(2048) },
        });
      },
      extractFn: async () => { extracted = true; },
      createSessionId: () => "sess-toolarge",
    });
    (svc as unknown as Record<string, unknown>).resolveSeriesOrThrow = async () => ({
      findByIdWithEpisodes: async () => ({ episodes: [] }),
    });
    const stream = svc.previewStream("series-1", { url: "https://x/archive.zip" } as never, new AbortController().signal);
    const events = sseEvents(await readAll(stream));
    // Headers may be fetched for the pre-flight check, but the body must
    // never be streamed to disk and extraction must never run.
    expect(fetchCalls).toBe(1);
    expect(extracted).toBe(false);
    expect(events.find((e) => e.event === "error")?.data).toMatchObject({ code: "ARCHIVE_TOO_LARGE" });
    await expect(stat(join(b, "sess-toolarge"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("rejects downloads when disk headroom is insufficient", async () => {
    const b = await base();
    let extracted = false;
    const svc = new ArchiveIngestService({
      db: {} as never,
      stagingBaseDir: b,
      maxArchiveBytes: 100 * 1024 * 1024,
      statfsFn: async () => ({ bavail: 1, bsize: 1024 }),
      fetchFn: async () =>
        new Response(chunkedBody([new Uint8Array(64)]), {
          status: 200,
          headers: { "content-length": String(1024) },
        }),
      extractFn: async () => { extracted = true; },
      createSessionId: () => "sess-nospace",
    });
    (svc as unknown as Record<string, unknown>).resolveSeriesOrThrow = async () => ({
      findByIdWithEpisodes: async () => ({ episodes: [] }),
    });
    const stream = svc.previewStream("series-1", { url: "https://x/archive.zip" } as never, new AbortController().signal);
    const events = sseEvents(await readAll(stream));
    expect(extracted).toBe(false);
    expect(events.find((e) => e.event === "error")?.data).toMatchObject({ code: "INSUFFICIENT_DISK_SPACE" });
  });

  it("deletes the raw archive immediately after extraction", async () => {
    const b = await base();
    const chunks = [new Uint8Array([1, 2, 3, 4])];
    const svc = new ArchiveIngestService({
      db: {} as never,
      stagingBaseDir: b,
      fetchFn: async () => new Response(chunkedBody(chunks), { status: 200 }),
      extractFn: async ({ destDir }) => {
        await writeFile(join(destDir, "episode1.mp4"), new Uint8Array([9, 9, 9]));
      },
      createSessionId: () => "sess-unlink",
    });
    (svc as unknown as Record<string, unknown>).resolveSeriesOrThrow = async () => ({
      findByIdWithEpisodes: async () => ({ episodes: [] }),
    });
    const stream = svc.previewStream("series-1", { url: "https://x/pack.zip" } as never, new AbortController().signal);
    const events = sseEvents(await readAll(stream));
    expect(events.some((e) => e.event === "preview_ready")).toBe(true);
    await expect(stat(join(b, "sess-unlink", "pack.zip"))).rejects.toMatchObject({ code: "ENOENT" });
    await expect(stat(join(b, "sess-unlink", "extracted", "episode1.mp4"))).resolves.toBeDefined();
  });

  it("purges the staging directory on terminal extraction failure", async () => {
    const b = await base();
    const svc = new ArchiveIngestService({
      db: {} as never,
      stagingBaseDir: b,
      fetchFn: async () => new Response(chunkedBody([new Uint8Array([7])]), { status: 200 }),
      extractFn: async () => { throw new Error("corrupt archive"); },
      createSessionId: () => "sess-fail",
    });
    (svc as unknown as Record<string, unknown>).resolveSeriesOrThrow = async () => ({
      findByIdWithEpisodes: async () => ({ episodes: [] }),
    });
    const stream = svc.previewStream("series-1", { url: "https://x/pack.zip" } as never, new AbortController().signal);
    const events = sseEvents(await readAll(stream));
    expect(events.find((e) => e.event === "error")?.data).toMatchObject({ code: "ARCHIVE_EXTRACTION_FAILED" });
    await expect(stat(join(b, "sess-fail"))).rejects.toMatchObject({ code: "ENOENT" });
  });
});
