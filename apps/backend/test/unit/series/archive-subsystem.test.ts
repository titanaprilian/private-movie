import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/modules/series/internal/seven-zip-extractor", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../../src/modules/series/internal/seven-zip-extractor")>();
  return {
    ...actual,
    probeSevenZipFormatSupport: vi.fn(),
  };
});

vi.mock(
  "../../../src/modules/series/internal/archive-ingest-job-service",
  async (importOriginal) => {
    const actual = await importOriginal<
      typeof import("../../../src/modules/series/internal/archive-ingest-job-service")
    >();
    return {
      ...actual,
      markInterruptedJobsOnBoot: vi.fn(),
      purgeOrphanStagingDirs: vi.fn(),
      sweepExpiredJobs: vi.fn(),
    };
  }
);

import {
  markInterruptedJobsOnBoot,
  purgeOrphanStagingDirs,
  sweepExpiredJobs,
  probeSevenZipFormatSupport,
} from "../../../src/modules/series";
import {
  ARCHIVE_INGEST_SWEEPER_INTERVAL_MS_DEFAULT,
  startArchiveIngestSubsystem,
} from "../../../src/modules/series";

function fakeLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

describe("startArchiveIngestSubsystem", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(probeSevenZipFormatSupport).mockResolvedValue({
      binary: "/usr/bin/7zz",
      formats: ["7z", "Zip", "Rar"],
      missing: [],
    });
    vi.mocked(markInterruptedJobsOnBoot).mockResolvedValue(undefined);
    vi.mocked(purgeOrphanStagingDirs).mockResolvedValue(undefined);
    vi.mocked(sweepExpiredJobs).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    delete process.env.ARCHIVE_STAGING_DIR;
  });

  it("probes 7-Zip format support and logs readiness", async () => {
    const logger = fakeLogger();
    const subsystem = await startArchiveIngestSubsystem({
      db: {} as never,
      stagingBaseDir: "/tmp/staging-a",
      logger,
    });

    expect(probeSevenZipFormatSupport).toHaveBeenCalledOnce();
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("7-Zip archive engine ready"));
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
      db: {} as never,
      stagingBaseDir: "/tmp/staging-b",
      logger,
    });
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("rar"));
    subsystem.stop();

    vi.clearAllMocks();
    vi.mocked(probeSevenZipFormatSupport).mockRejectedValue(new Error("no binary"));
    const logger2 = fakeLogger();
    const subsystem2 = await startArchiveIngestSubsystem({
      db: {} as never,
      stagingBaseDir: "/tmp/staging-b",
      logger: logger2,
    });
    expect(logger2.warn).toHaveBeenCalledWith(
      expect.stringContaining("7-Zip binary not found"),
      expect.anything()
    );
    subsystem2.stop();
  });

  it("marks interrupted jobs as failed on boot and purges orphan staging dirs", async () => {
    const db = {} as never;
    const subsystem = await startArchiveIngestSubsystem({
      db,
      stagingBaseDir: "/tmp/staging-c",
      logger: fakeLogger(),
    });

    expect(markInterruptedJobsOnBoot).toHaveBeenCalledWith(db);
    expect(purgeOrphanStagingDirs).toHaveBeenCalledWith(db, "/tmp/staging-c");
    expect(subsystem.stagingBaseDir).toBe("/tmp/staging-c");
    expect(subsystem.jobService).toBeDefined();
    subsystem.stop();
  });

  it("falls back to ARCHIVE_STAGING_DIR env and the default staging dir", async () => {
    process.env.ARCHIVE_STAGING_DIR = "/tmp/from-env";
    const s1 = await startArchiveIngestSubsystem({ db: {} as never, logger: fakeLogger() });
    expect(s1.stagingBaseDir).toBe("/tmp/from-env");
    expect(purgeOrphanStagingDirs).toHaveBeenCalledWith(expect.anything(), "/tmp/from-env");
    s1.stop();

    delete process.env.ARCHIVE_STAGING_DIR;
    const s2 = await startArchiveIngestSubsystem({ db: {} as never, logger: fakeLogger() });
    expect(s2.stagingBaseDir).toBe("/tmp/archive-ingest-staging");
    s2.stop();
  });

  it("triggers an initial sweep and schedules periodic sweeps at the configured interval", async () => {
    const db = {} as never;
    const subsystem = await startArchiveIngestSubsystem({
      db,
      stagingBaseDir: "/tmp/staging-d",
      logger: fakeLogger(),
      sweeperIntervalMs: 1000,
    });

    // Initial sweep runs immediately (fire-and-forget promise).
    await vi.advanceTimersByTimeAsync(0);
    expect(sweepExpiredJobs).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000);
    expect(sweepExpiredJobs).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(2000);
    expect(sweepExpiredJobs).toHaveBeenCalledTimes(4);

    subsystem.stop();
  });

  it("uses the default 30-minute sweeper interval", async () => {
    expect(ARCHIVE_INGEST_SWEEPER_INTERVAL_MS_DEFAULT).toBe(30 * 60 * 1000);
    await startArchiveIngestSubsystem({
      db: {} as never,
      stagingBaseDir: "/tmp/staging-e",
      logger: fakeLogger(),
    }).then((s) => {
      // Only the initial sweep fired; no periodic sweep before 30 minutes.
      expect(sweepExpiredJobs).toHaveBeenCalledTimes(1);
      s.stop();
    });
  });

  it("stop() clears the sweeper interval timer and prevents further sweeps", async () => {
    const subsystem = await startArchiveIngestSubsystem({
      db: {} as never,
      stagingBaseDir: "/tmp/staging-f",
      logger: fakeLogger(),
      sweeperIntervalMs: 500,
    });

    await vi.advanceTimersByTimeAsync(0);
    expect(sweepExpiredJobs).toHaveBeenCalledTimes(1);

    subsystem.stop();

    await vi.advanceTimersByTimeAsync(5000);
    expect(sweepExpiredJobs).toHaveBeenCalledTimes(1);
  });
});
