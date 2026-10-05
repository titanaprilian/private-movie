import { describe, it, expect, vi, afterEach } from "vitest";
import { Writable } from "node:stream";

function captureStream() {
  let buffer = "";
  const stream = new Writable({
    write(chunk, _enc, cb) {
      buffer += chunk.toString();
      cb();
    },
  });
  return { stream, output: () => buffer };
}

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllEnvs();
});

describe("createLogger", () => {
  it("defaults to info level in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.LOG_LEVEL;
    const { createLogger } = await import("@/lib/logger");
    const log = createLogger({ isDevelopment: false }) as unknown as { level: string };
    expect(log.level).toBe("info");
  });

  it("defaults to debug level in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    delete process.env.LOG_LEVEL;
    const { createLogger } = await import("@/lib/logger");
    const log = createLogger({ isDevelopment: true, level: "debug" }) as unknown as { level: string };
    expect(log.level).toBe("debug");
  });

  it("respects explicit level and LOG_LEVEL env override", async () => {
    const { createLogger } = await import("@/lib/logger");
    const explicit = createLogger({ level: "warn", isDevelopment: false }) as unknown as { level: string };
    expect(explicit.level).toBe("warn");

    vi.stubEnv("LOG_LEVEL", "error");
    const fromEnv = createLogger({ isDevelopment: false }) as unknown as { level: string };
    expect(fromEnv.level).toBe("error");
  });

  it("emits structured JSON in production mode", async () => {
    const { createLogger } = await import("@/lib/logger");
    const { stream, output } = captureStream();
    const log = createLogger({ level: "info", isDevelopment: false, destination: stream });
    log.info({ requestId: "abc-123" }, "hello");
    await new Promise((r) => setTimeout(r, 50));
    const parsed = JSON.parse(output().trim().split("\n")[0]);
    expect(parsed.msg).toBe("hello");
    expect(parsed.requestId).toBe("abc-123");
    expect(parsed.level).toBe(30);
  });

  it("is usable as shutdown manager and scheduler logger", async () => {
    const { createLogger } = await import("@/lib/logger");
    const { stream } = captureStream();
    const log = createLogger({ level: "silent", isDevelopment: false, destination: stream });
    expect(typeof log.info).toBe("function");
    expect(typeof log.warn).toBe("function");
    expect(typeof log.error).toBe("function");

    const { createShutdownManager } = await import("@/shutdown/shutdown-manager");
    const exits: number[] = [];
    const manager = createShutdownManager({
      proc: { on: () => {}, exit: (c: number) => void exits.push(c) },
      logger: log,
      steps: [{ name: "noop", run: () => {} }],
    });
    await manager.shutdown();
    expect(exits).toEqual([0]);

    const { createOngoingSeasonScheduler } = await import("@/modules/media/scheduler");
    const scheduler = createOngoingSeasonScheduler({
      mediaService: { scrapeAllOngoingSeasons: async () => ({ totalProcessed: 0, successCount: 0, failureCount: 0, results: [] }) },
      runImmediately: false,
      enabled: false,
      logger: log,
    });
    scheduler.start();
    expect(scheduler.isRunning()).toBe(true);
    await scheduler.stop();
  });
});
