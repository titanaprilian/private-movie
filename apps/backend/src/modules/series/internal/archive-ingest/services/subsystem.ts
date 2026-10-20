import { readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import type {
  S3StorageService,
  StorageProviderRegistry,
} from "@repo/media-service";
import { logger as defaultLogger } from "../../../../../lib/logger";
import type {
  ArchiveIngestJobManager,
  ArchiveIngestRepository,
} from "../types";
import {
  createArchiveIngestJobManager,
  type ArchiveIngestJobManagerOptions,
  type ArchiveIngestVideoSourceWriter,
} from "./job";
import { probeSevenZipFormatSupport } from "./extractor";

export const ARCHIVE_INGEST_SWEEPER_INTERVAL_MS_DEFAULT = 30 * 60 * 1000;

export interface ArchiveIngestSubsystemLogger {
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

export interface ArchiveIngestSubsystemOptions {
  repository: ArchiveIngestRepository;
  s3StorageService?: S3StorageService;
  storageProviderRegistry?: StorageProviderRegistry;
  videoSourceRepository?: ArchiveIngestVideoSourceWriter;
  extractor?: ArchiveIngestJobManagerOptions["extractor"];
  fetchFn?: ArchiveIngestJobManagerOptions["fetchFn"];
  stagingBaseDir?: string;
  logger?: ArchiveIngestSubsystemLogger;
  sweeperIntervalMs?: number;
}

export interface ArchiveIngestSubsystem {
  jobService: ArchiveIngestJobManager;
  stagingBaseDir: string;
  stop: () => void;
}

// ─── Boot reconciliation ──────────────────────────────────────────────────

/**
 * Called once at server startup. Any job that was actively running
 * (queued/downloading/listing/uploading) when the process died is
 * transitioned to `failed` with errorCode `SERVER_RESTARTED`.
 * `ready` jobs are preserved — they can still be confirmed by the user.
 */
export async function markInterruptedJobsOnBoot(
  repository: ArchiveIngestRepository,
): Promise<void> {
  try {
    const result = await repository.markInterruptedJobsAsFailed();

    // Clean up partial staging for interrupted jobs
    for (const row of result) {
      if (row.stagingPath) {
        await rm(row.stagingPath, { recursive: true, force: true }).catch(
          () => {},
        );
      }
    }

    defaultLogger.info(
      { count: result.length },
      "Boot reconciliation: marked interrupted jobs as failed",
    );
  } catch (err) {
    defaultLogger.error({ err }, "Boot reconciliation failed");
  }
}

/**
 * Scans the staging base directory and removes any subdirectory that does not
 * correspond to a known job in the database. Orphan directories accumulate
 * when the process dies before completing cleanup.
 */
export async function purgeOrphanStagingDirs(
  repository: ArchiveIngestRepository,
  stagingBaseDir: string,
): Promise<void> {
  try {
    let entries: string[];
    try {
      entries = await readdir(stagingBaseDir);
    } catch {
      // Directory doesn't exist yet — nothing to purge
      return;
    }

    if (entries.length === 0) return;

    const knownIds = new Set(await repository.listAllJobIds());

    let purged = 0;
    for (const entry of entries) {
      if (!knownIds.has(entry)) {
        const fullPath = join(stagingBaseDir, entry);
        await rm(fullPath, { recursive: true, force: true }).catch(() => {});
        purged++;
      }
    }

    if (purged > 0) {
      defaultLogger.info(
        { purged, stagingBaseDir },
        "Purged orphan staging directories",
      );
    }
  } catch (err) {
    defaultLogger.error({ err }, "purgeOrphanStagingDirs failed");
  }
}

// ─── Background expiration sweeper ───────────────────────────────────────

/**
 * Finds all `ready` jobs whose `expires_at` is in the past, transitions them
 * to `expired`, and deletes their staging directories. Intended to run on a
 * periodic timer (e.g. every 30 minutes).
 */
export async function sweepExpiredJobs(
  repository: ArchiveIngestRepository,
): Promise<void> {
  try {
    const now = new Date();
    const expiredJobs = await repository.findExpiredReadyJobs(now);
    if (expiredJobs.length === 0) return;

    const expired = await repository.markJobsExpired(
      expiredJobs.map((job) => job.id),
      now,
    );

    for (const row of expired) {
      if (row.stagingPath) {
        await rm(row.stagingPath, { recursive: true, force: true }).catch(
          () => {},
        );
      }
    }

    if (expired.length > 0) {
      defaultLogger.info(
        { count: expired.length },
        "Swept expired archive ingest jobs",
      );
    }
  } catch (err) {
    defaultLogger.error({ err }, "sweepExpiredJobs failed");
  }
}

/**
 * Encapsulated archive ingest startup for the server entry point: probes
 * 7-Zip format support with startup logging, reconciles interrupted jobs,
 * purges orphan staging directories, and runs the periodic sweeper timer
 * to expire stale ready jobs. Returns a lifecycle handle whose `stop()`
 * clears the sweeper timer during server shutdown.
 */
export async function startArchiveIngestSubsystem(
  options: ArchiveIngestSubsystemOptions,
): Promise<ArchiveIngestSubsystem> {
  const {
    repository,
    s3StorageService,
    storageProviderRegistry,
    videoSourceRepository,
    extractor,
    fetchFn,
    logger = defaultLogger as unknown as ArchiveIngestSubsystemLogger,
    sweeperIntervalMs = ARCHIVE_INGEST_SWEEPER_INTERVAL_MS_DEFAULT,
  } = options;
  const stagingBaseDir =
    options.stagingBaseDir ??
    process.env.ARCHIVE_STAGING_DIR ??
    "/tmp/archive-ingest-staging";

  try {
    const support = await probeSevenZipFormatSupport();
    if (support.missing.length > 0) {
      logger.warn(
        `7-Zip binary ${support.binary} cannot read ${support.missing.join(", ")}; archive ingest will fail for those formats`,
      );
    } else {
      logger.info(`7-Zip archive engine ready (${support.binary})`);
    }
  } catch (error) {
    logger.warn("7-Zip binary not found; archive ingest will fail", error);
  }

  const jobService = createArchiveIngestJobManager({
    repository,
    s3StorageService,
    storageProviderRegistry,
    videoSourceRepository,
    stagingBaseDir,
    ...(extractor ? { extractor } : {}),
    ...(fetchFn ? { fetchFn } : {}),
  });

  await markInterruptedJobsOnBoot(repository);
  await purgeOrphanStagingDirs(repository, stagingBaseDir);

  const timer = setInterval(() => {
    void sweepExpiredJobs(repository).catch((err) => {
      logger.error("Archive ingest sweeper error", err);
    });
  }, sweeperIntervalMs);
  if (timer && typeof timer === "object" && "unref" in timer) {
    (timer as unknown as { unref(): void }).unref();
  }

  // Run once immediately to catch already-expired jobs from before boot.
  void sweepExpiredJobs(repository).catch((err) => {
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
