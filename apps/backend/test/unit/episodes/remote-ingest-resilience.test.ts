import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../../../src/lib/sentry", () => ({
  captureException: vi.fn(),
  initSentry: vi.fn(() => false),
}));
vi.mock("../../../src/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), child: vi.fn() },
  createLogger: vi.fn(),
}));
vi.mock("@repo/media-service", async (orig) => {
  const actual = await orig<object>();
  return {
    ...(actual as object),
    createEpisodeRepositoryInternal: vi.fn(() => ({
      findById: async () => ({ id: "ep-1" }),
    })),
    createVideoSourceRepositoryInternal: vi.fn(() => ({
      upsert: async () => ({ id: "vs-1" }),
    })),
  };
});

import { captureException } from "../../../src/lib/sentry";
import { logger } from "../../../src/lib/logger";
import { IngestService } from "../../../src/modules/episodes";

function sseEvents(text: string): { event: string; data: unknown }[] {
  return text.split("\n\n").filter(Boolean).map((block) => {
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
    out += dec.decode(value as Uint8Array, { stream: true });
  }
  return out;
}

function chunked(total: number, chunk = 1024): ReadableStream<Uint8Array> {
  const n = Math.ceil(total / chunk);
  return new ReadableStream<Uint8Array>({
    start(c) {
      for (let i = 0; i < n; i++) c.enqueue(new Uint8Array(Math.min(chunk, total - i * chunk)));
      c.close();
    },
  });
}

describe("remote ingest resilience", () => {
  beforeEach(() => vi.clearAllMocks());

  function svc(uploadImpl: (key: string, body: unknown, opts: { onProgress?: (p: { loaded: number; total: number }) => void }) => Promise<unknown>) {
    const fakeS3 = {
      isConfigured: () => true,
      getPresignedUploadUrl: async () => ({ url: "x", key: "k" }),
      uploadStream: uploadImpl,
    };
    return new IngestService({} as never, fakeS3 as never);
  }

  it("throttles progress events (many onProgress calls -> few SSE events)", async () => {
    const svcInst = svc(async (_k, _b, opts) => {
      for (let i = 1; i <= 60; i++) opts.onProgress?.({ loaded: i * 100, total: 10 * 1024 * 1024 });
    });
    vi.stubGlobal("fetch", async () =>
      new Response(chunked(60 * 100), { status: 200, headers: { "content-type": "video/mp4" } }),
    );
    try {
      const stream = await svcInst.remoteIngestStream("ep-1", { url: "https://x/v.mp4", label: "l" }, new AbortController().signal);
      const events = sseEvents(await readAll(stream));
      const progress = events.filter((e) => e.event === "progress");
      expect(progress.length).toBeLessThan(60);
      expect(progress.length).toBeGreaterThan(0);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("emits DOWNLOAD_INCOMPLETE and reports to Sentry/logger on truncation", async () => {
    const svcInst = svc(async (_k, _b, opts) => {
      opts.onProgress?.({ loaded: 2 * 1024, total: 10 * 1024 });
    });
    vi.stubGlobal("fetch", async () =>
      new Response(chunked(2 * 1024), { status: 200, headers: { "content-length": String(10 * 1024), "content-type": "video/mp4" } }),
    );
    try {
      const stream = await svcInst.remoteIngestStream("ep-1", { url: "https://x/v.mp4", label: "l" }, new AbortController().signal);
      const events = sseEvents(await readAll(stream));
      const err = events.find((e) => e.event === "error");
      expect(err?.data).toMatchObject({ code: "DOWNLOAD_INCOMPLETE" });
      expect(captureException).toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("reports unhandled streaming failures to Sentry and logger", async () => {
    const svcInst = svc(async () => { throw new Error("s3-boom"); });
    vi.stubGlobal("fetch", async () =>
      new Response(chunked(1024), { status: 200, headers: { "content-length": "1024", "content-type": "video/mp4" } }),
    );
    try {
      const stream = await svcInst.remoteIngestStream("ep-1", { url: "https://x/v.mp4", label: "l" }, new AbortController().signal);
      const events = sseEvents(await readAll(stream));
      expect(events.some((e) => e.event === "error")).toBe(true);
      expect(captureException).toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
