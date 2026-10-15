import { logger as defaultLogger } from "../../../../lib/logger";
import type {
  ArchiveIngestSubsystem,
  ArchiveIngestSubsystemLogger,
  ArchiveIngestSubsystemOptions,
} from "../types";
import {
  ArchiveIngestJobService,
  markInterruptedJobsOnBoot,
  purgeOrphanStagingDirs,
  sweepExpiredJobs,
} from "./archive-ingest-job-service";
import { probeSevenZipFormatSupport } from "./seven-zip-extractor";

export const ARCHIVE_INGEST_SWEEPER_INTERVAL_MS_DEFAULT = 30 * 60 * 1000;
export type {
  ArchiveIngestSubsystem,
  ArchiveIngestSubsystemLogger,
  ArchiveIngestSubsystemOptions,
};

/**
 * Encapsulated archive ingest startup for the server entry point: probes
 * 7-Zip format support with startup logging, reconciles interrupted jobs,
 * purges orphan staging directories, and runs the periodic sweeper timer
 * to expire stale ready jobs. Returns a lifecycle handle whose `stop()`
 * clears the sweeper timer during server shutdown.
 */
export async function startArchiveIngestSubsystem(
  options: ArchiveIngestSubsystemOptions
): Promise<ArchiveIngestSubsystem> {
  const {
    db,
    s3StorageService,
    storageProviderRegistry,
    logger = defaultLogger as unknown as ArchiveIngestSubsystemLogger,
    sweeperIntervalMs = ARCHIVE_INGEST_SWEEPER_INTERVAL_MS_DEFAULT,
  } = options;
  const stagingBaseDir =
    options.stagingBaseDir ?? process.env.ARCHIVE_STAGING_DIR ?? "/tmp/archive-ingest-staging";

  try {
    const support = await probeSevenZipFormatSupport();
    if (support.missing.length > 0) {
      logger.warn(
        `7-Zip binary ${support.binary} cannot read ${support.missing.join(", ")}; archive ingest will fail for those formats`
      );
    } else {
      logger.info(`7-Zip archive engine ready (${support.binary})`);
    }
  } catch (error) {
    logger.warn("7-Zip binary not found; archive ingest will fail", error);
  }

  const jobService = new ArchiveIngestJobService({
    db,
    s3StorageService,
    storageProviderRegistry,
    stagingBaseDir,
  });

  await markInterruptedJobsOnBoot(db);
  await purgeOrphanStagingDirs(db, stagingBaseDir);

  const timer = setInterval(() => {
    void sweepExpiredJobs(db).catch((err) => {
      logger.error("Archive ingest sweeper error", err);
    });
  }, sweeperIntervalMs);
  if (timer && typeof timer === "object" && "unref" in timer) {
    (timer as unknown as { unref(): void }).unref();
  }

  // Run once immediately to catch already-expired jobs from before boot.
  void sweepExpiredJobs(db).catch((err) => {
    logger.error("Archive ingest initial sweep error", err);
  });

  logger.info("Archive ingest boot reconciliation complete");

  return {
    jobService,
    stagingBaseDir,
    stop: () => {
      clearInterval(timer);
    },
  };
}
