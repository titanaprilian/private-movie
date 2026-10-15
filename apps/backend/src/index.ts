import { createDbClient } from "@repo/db";
import { createStealthBrowser } from "@repo/media-scraper";
import {
  createMediaService,
  createS3StorageService,
  createStorageProviderRegistry,
  createVideoSourceRepositoryInternal,
} from "@repo/media-service";
import { createApp } from "./app";
import { loadServerConfig } from "./config/server-config";
import { logger } from "./lib/logger";
import { initSentry } from "./lib/sentry";
import { createAuthenticationService } from "./modules/authentication";
import { startOngoingSeasonScheduler } from "./modules/media";
import { createStorageService } from "./modules/storage";
import {
  createArchiveIngestRepository,
  startArchiveIngestSubsystem,
} from "./modules/series";
import { createShutdownManager } from "./shutdown";

const shutdown = createShutdownManager({ logger });
shutdown.registerShutdownHandlers();

if (initSentry()) {
  logger.info("Sentry crash reporting initialized");
}

async function bootstrap(): Promise<void> {
  // Stage 1 — Storage & Database (foundational I/O).
  const db = shutdown.track("database", createDbClient(), (client) =>
    client.$client.end(),
  );

  const auth = createAuthenticationService(db);
  const s3StorageService = createS3StorageService();
  // Single database-backed provider registry shared by the archive ingest
  // job service and every HTTP module, so uploads resolve to the active
  // default provider (e.g. IDrive) instead of unconfigured env-based S3.
  const storageProviderRegistry = createStorageProviderRegistry(
    db,
    s3StorageService,
  );
  const storageService = createStorageService(db, { s3StorageService });

  // Stage 2 — Scraping & Media Pipeline (external automation).
  const browser = await shutdown.manage(
    "browser",
    () => createStealthBrowser(),
    (b) => b.close(),
  );

  const mediaService = createMediaService(db, {
    browserFn: browser.browserFn,
    s3StorageService,
  });

  // Stage 3 — Background Daemons (schedulers & ingestion).
  const scheduler = await shutdown.manage(
    "scheduler",
    () => startOngoingSeasonScheduler({ db, mediaService, logger }),
    (s) => s.stop(),
  );

  const archiveSubsystem = await shutdown.manage(
    "archive-ingest",
    () =>
      startArchiveIngestSubsystem({
        repository: createArchiveIngestRepository(db),
        s3StorageService,
        storageProviderRegistry,
        videoSourceRepository: createVideoSourceRepositoryInternal(db, {
          s3StorageService,
          storageProviderRegistry,
        }),
        logger,
      }),
    (subsystem) => subsystem.stop(),
  );

  // Stage 4 — HTTP Presentation Layer.
  const serverConfig = loadServerConfig();

  const app = shutdown.track(
    "http-server",
    createApp({
      db,
      auth,
      storageService,
      storageProviderRegistry,
      browserFn: browser.browserFn,
      s3StorageService,
      scheduler,
      archiveStagingBaseDir: archiveSubsystem.stagingBaseDir,
      archiveJobService: archiveSubsystem.jobService,
    }).listen(serverConfig),
    (listeningApp) => listeningApp.server?.stop(false),
  );

  logger.info(
    `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
  );
}

bootstrap().catch(async (error) => {
  logger.error({ err: error }, "[Startup] failed to start backend");
  await shutdown.shutdown();
  process.exit(1);
});
