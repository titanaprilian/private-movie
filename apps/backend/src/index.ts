import { createDbClient } from "@repo/db";
import { createStealthBrowser } from "@repo/media-scraper";
import { createMediaService, createS3StorageService } from "@repo/media-service";
import { createApp } from "./app";
import { loadServerConfig } from "./config/server-config";
import { logger } from "./lib/logger";
import { initSentry } from "./lib/sentry";
import { createAuthenticationService } from "./modules/authentication";
import { startOngoingSeasonScheduler } from "./modules/media";
import { createStorageService } from "./modules/storage";
import {
  probeSevenZipFormatSupport,
  markInterruptedJobsOnBoot,
  purgeOrphanStagingDirs,
  sweepExpiredJobs,
  ArchiveIngestJobService,
} from "./modules/series";
import { createShutdownManager } from "./shutdown";

const shutdown = createShutdownManager({ logger });
shutdown.registerShutdownHandlers();

if (initSentry()) {
  logger.info("Sentry crash reporting initialized");
}

// Shutdown steps are pre-registered up-front in reverse-dependency (LIFO)
// teardown order: the HTTP listener drains first, the database pool closes
// last. Each step closes over a binding assigned during bootstrap and
// no-ops when startup failed before that component was initialized, so a
// failed startup still tears down only the partially allocated resources.
// (The manager executes steps FIFO, so incremental addStep-as-you-go
// registration would close the database before draining the server.)
let db: ReturnType<typeof createDbClient> | undefined;
let browser: Awaited<ReturnType<typeof createStealthBrowser>> | undefined;
let scheduler: Awaited<ReturnType<typeof startOngoingSeasonScheduler>> | undefined;
let app: ReturnType<typeof createApp> | undefined;
let sweeperTimer: ReturnType<typeof setInterval> | undefined;

shutdown.addStep({
  name: "http-server",
  run: async () => {
    await app?.server?.stop(false);
  },
});
shutdown.addStep({ name: "sweeper", run: () => { if (sweeperTimer) clearInterval(sweeperTimer); } });
shutdown.addStep({ name: "scheduler", run: () => scheduler?.stop() });
shutdown.addStep({ name: "browser", run: () => browser?.close() });
shutdown.addStep({ name: "database", run: () => db?.$client.end() });

/**
 * Archive ingest runs out-of-process 7-Zip. A binary that is present but was
 * compiled without the RAR codec still accepts `7zz` invocations and only fails
 * much later inside a job, so surface it at boot instead of at extract time.
 */
async function logArchiveEngineSupport(): Promise<void> {
  try {
    const support = await probeSevenZipFormatSupport();
    if (support.missing.length > 0) {
      logger.warn(
        { binary: support.binary, missing: support.missing },
        `7-Zip binary ${support.binary} cannot read ${support.missing.join(", ")}; archive ingest will fail for those formats`
      );
      return;
    }
    logger.info({ binary: support.binary }, "7-Zip archive engine ready");
  } catch (error) {
    logger.warn({ err: error }, "7-Zip binary not found; archive ingest will fail");
  }
}

async function bootstrap(): Promise<void> {
  db = createDbClient(process.env.DATABASE_URL);

  const auth = createAuthenticationService(db);
  const s3StorageService = createS3StorageService();
  const storageService = createStorageService(db, { s3StorageService });

  browser = await createStealthBrowser();

  const mediaService = createMediaService(db, {
    browserFn: browser.browserFn,
    s3StorageService,
  });

  scheduler = await startOngoingSeasonScheduler({ db, mediaService, logger });

  const serverConfig = loadServerConfig();

  await logArchiveEngineSupport();

  // ── Archive ingest boot reconciliation ──────────────────────────────────
  const archiveStagingBaseDir =
    process.env.ARCHIVE_STAGING_DIR ?? "/tmp/archive-ingest-staging";

  const archiveJobService = new ArchiveIngestJobService({
    db,
    s3StorageService,
    stagingBaseDir: archiveStagingBaseDir,
  });

  // Mark any in-flight jobs as failed (server restarted) and purge orphan dirs.
  await markInterruptedJobsOnBoot(db);
  await purgeOrphanStagingDirs(db, archiveStagingBaseDir);

  // Start periodic sweeper — every 30 minutes, expire stale ready jobs.
  const SWEEPER_INTERVAL_MS = 30 * 60 * 1000;
  sweeperTimer = setInterval(() => {
    void sweepExpiredJobs(db!).catch((err) => {
      logger.error({ err }, "Archive ingest sweeper error");
    });
  }, SWEEPER_INTERVAL_MS);
  // Run once immediately to catch any already-expired jobs from before boot.
  void sweepExpiredJobs(db).catch((err) => {
    logger.error({ err }, "Archive ingest initial sweep error");
  });

  logger.info("Archive ingest boot reconciliation complete");

  app = createApp({
    db,
    auth,
    storageService,
    overrides: {
      browserFn: browser.browserFn,
      s3StorageService,
      scheduler,
      archiveStagingBaseDir,
      archiveJobService,
    },
  }).listen(serverConfig);

  logger.info(`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`);
}

bootstrap().catch(async (error) => {
  logger.error({ err: error }, "[Startup] failed to start backend");
  await shutdown.shutdown();
  process.exit(1);
});
