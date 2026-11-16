import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock(
  "../../../src/modules/series/internal/archive-ingest/services/extractor",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("../../../src/modules/series/internal/archive-ingest/services/extractor")
      >();
    return {
      ...actual,
      probeSevenZipFormatSupport: vi.fn(),
    };
  },
);

import { probeSevenZipFormatSupport } from "../../../src/modules/series";
import {
  ARCHIVE_INGEST_SWEEPER_INTERVAL_MS_DEFAULT,
  startArchiveIngestSubsystem,
  type ArchiveIngestSubsystemLogger,
} from "../../../src/modules/series";
import type { ArchiveIngestRepository } from "../../../src/modules/series";

function fakeLogger(): ArchiveIngestSubsystemLogger & {
  info: ReturnType<typeof vi.fn>;
  warn: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
} {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

function createSubsystemTestRepository(
  overrides: Partial<ArchiveIngestRepository> = {},
): ArchiveIngestRepository {
  return {
    markInterruptedJobsAsFailed: vi.fn().mockResolvedValue([]),
    listAllJobIds: vi.fn().mockResolvedValue([]),
    findExpiredReadyJobs: vi.fn().mockResolvedValue([]),
    markJobsExpired: vi.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as ArchiveIngestRepository;
}

describe("startArchiveIngestSubsystem", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(probeSevenZipFormatSupport).mockResolvedValue({
      binary: "/usr/bin/7zz",
      formats: ["7z", "Zip", "Rar"],
      missing: [],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    delete process.env.ARCHIVE_STAGING_DIR;
  });

  it("probes 7-Zip format support and logs readiness", async () => {
    const logger = fakeLogger();
    const subsystem = await startArchiveIngestSubsystem({
      repository: createSubsystemTestRepository(),
      stagingBaseDir: "/tmp/staging-a",
      logger,
    });

    expect(probeSevenZipFormatSupport).toHaveBeenCalledOnce();
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining("7-Zip archive engine ready"),
    );
    expect(logger.warn).not.toHaveBeenCalled();
    subsystem.stop();
  });

  it("logs a warning when required formats are missing or the binary is absent", async () => {
    const logger = fakeLogger();
    vi.mocked(probeSevenZipFormatSupport).mockResolvedValue({
      binary: "/usr/bin/7zz",
      formats: ["7z"],
      missing: ["rar"],
    });

    const subsystem = await startArchiveIngestSubsystem({
      repository: createSubsystemTestRepository(),
      stagingBaseDir: "/tmp/staging-b",
      logger,
    });
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("rar"));
    subsystem.stop();

    vi.clearAllMocks();
    vi.mocked(probeSevenZipFormatSupport).mockRejectedValue(
      new Error("no binary"),
    );
    const logger2 = fakeLogger();
    const subsystem2 = await startArchiveIngestSubsystem({
      repository: createSubsystemTestRepository(),
      stagingBaseDir: "/tmp/staging-b",
      logger: logger2,
    });
    expect(logger2.warn).toHaveBeenCalledWith(
      expect.stringContaining("7-Zip binary not found"),
      expect.anything(),
    );
    subsystem2.stop();
  });

  it("reconciles interrupted jobs through the repository on boot", async () => {
    const repository = createSubsystemTestRepository();
    const base = mkdtempSync(join(tmpdir(), "subsystem-boot-"));
    mkdirSync(join(base, "probe-entry"), { recursive: true });
    try {
      const subsystem = await startArchiveIngestSubsystem({
        repository,
        stagingBaseDir: base,
        logger: fakeLogger(),
      });

      expect(repository.markInterruptedJobsAsFailed).toHaveBeenCalledOnce();
      expect(repository.listAllJobIds).toHaveBeenCalled();
      expect(subsystem.stagingBaseDir).toBe(base);
      expect(subsystem.jobService).toBeDefined();
      subsystem.stop();
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });

  it("falls back to ARCHIVE_STAGING_DIR env and the default staging dir", async () => {
    process.env.ARCHIVE_STAGING_DIR = "/tmp/from-env";
    const s1 = await startArchiveIngestSubsystem({
      repository: createSubsystemTestRepository(),
      logger: fakeLogger(),
    });
    expect(s1.stagingBaseDir).toBe("/tmp/from-env");
    s1.stop();

    delete process.env.ARCHIVE_STAGING_DIR;
    const s2 = await startArchiveIngestSubsystem({
      repository: createSubsystemTestRepository(),
      logger: fakeLogger(),
    });
    expect(s2.stagingBaseDir).toBe("/tmp/archive-ingest-staging");
    s2.stop();
  });

  it("triggers an initial sweep and schedules periodic sweeps at the configured interval", async () => {
    const repository = createSubsystemTestRepository();
    const subsystem = await startArchiveIngestSubsystem({
      repository,
      stagingBaseDir: "/tmp/staging-d",
      logger: fakeLogger(),
      sweeperIntervalMs: 1000,
    });

    // Initial sweep runs immediately (fire-and-forget promise).
    await vi.advanceTimersByTimeAsync(0);
    expect(repository.findExpiredReadyJobs).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000);
    expect(repository.findExpiredReadyJobs).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(2000);
    expect(repository.findExpiredReadyJobs).toHaveBeenCalledTimes(4);

    subsystem.stop();
  });

  it("uses the default 30-minute sweeper interval", async () => {
    expect(ARCHIVE_INGEST_SWEEPER_INTERVAL_MS_DEFAULT).toBe(30 * 60 * 1000);
    const repository = createSubsystemTestRepository();
    await startArchiveIngestSubsystem({
      repository,
      stagingBaseDir: "/tmp/staging-e",
      logger: fakeLogger(),
    }).then(async (s) => {
      await vi.advanceTimersByTimeAsync(0);
      // Only the initial sweep fired; no periodic sweep before 30 minutes.
      expect(repository.findExpiredReadyJobs).toHaveBeenCalledTimes(1);
      s.stop();
    });
  });

  it("stop() clears the sweeper interval timer and prevents further sweeps", async () => {
    const repository = createSubsystemTestRepository();
    const subsystem = await startArchiveIngestSubsystem({
      repository,
      stagingBaseDir: "/tmp/staging-f",
      logger: fakeLogger(),
      sweeperIntervalMs: 500,
    });

    await vi.advanceTimersByTimeAsync(0);
    expect(repository.findExpiredReadyJobs).toHaveBeenCalledTimes(1);

    subsystem.stop();

    await vi.advanceTimersByTimeAsync(5000);
    expect(repository.findExpiredReadyJobs).toHaveBeenCalledTimes(1);
  });
});
