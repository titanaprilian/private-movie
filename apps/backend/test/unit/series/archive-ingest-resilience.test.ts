import { mkdtemp, rm } from "node:fs/promises";
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

function sseEvents(text: string): { event: string; data: unknown }[] {
  return text
    .split("\n\n")
    .filter(Boolean)
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
});
