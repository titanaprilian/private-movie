import { createDbClient } from "@repo/db";
import { createStealthBrowser } from "@repo/media-scraper";
import { createMediaService, createS3StorageService, createStorageProviderRegistry } from "@repo/media-service";
import { createApp } from "./app";
import { loadServerConfig } from "./config/server-config";
import { logger } from "./lib/logger";
import { initSentry } from "./lib/sentry";
import { createAuthenticationService } from "./modules/authentication";
import { startOngoingSeasonScheduler } from "./modules/media";
import { createStorageService } from "./modules/storage";
import { startArchiveIngestSubsystem } from "./modules/series";
import { createShutdownManager } from "./shutdown";

const shutdown = createShutdownManager({ logger });
shutdown.registerShutdownHandlers();

if (initSentry()) {
  logger.info("Sentry crash reporting initialized");
}

async function bootstrap(): Promise<void> {
  const db = createDbClient();
  shutdown.prependStep({ name: "database", run: () => db.$client.end() });

  const auth = createAuthenticationService(db);
  const s3StorageService = createS3StorageService();
  // Single database-backed provider registry shared by the archive ingest
  // job service and every HTTP module, so uploads resolve to the active
  // default provider (e.g. IDrive) instead of unconfigured env-based S3.
  const storageProviderRegistry = createStorageProviderRegistry(db, s3StorageService);
  const storageService = createStorageService(db, { s3StorageService });

  const browser = await createStealthBrowser();
  shutdown.prependStep({ name: "browser", run: () => browser.close() });

  const mediaService = createMediaService(db, {
    browserFn: browser.browserFn,
    s3StorageService,
  });

  const scheduler = await startOngoingSeasonScheduler({ db, mediaService, logger });
  shutdown.prependStep({ name: "scheduler", run: () => scheduler.stop() });

  const serverConfig = loadServerConfig();

  const archiveSubsystem = await startArchiveIngestSubsystem({
    db,
    s3StorageService,
    storageProviderRegistry,
    logger,
  });
  shutdown.prependStep({ name: "archive-ingest", run: () => archiveSubsystem.stop() });

  const app = createApp({
    db,
    auth,
    storageService,
    overrides: {
      browserFn: browser.browserFn,
      s3StorageService,
      storageProviderRegistry,
      scheduler,
      archiveStagingBaseDir: archiveSubsystem.stagingBaseDir,
      archiveJobService: archiveSubsystem.jobService,
    },
  }).listen(serverConfig);
  shutdown.prependStep({
    name: "http-server",
    run: async () => {
      await app.server?.stop(false);
    },
  });

  logger.info(`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`);
}

bootstrap().catch(async (error) => {
  logger.error({ err: error }, "[Startup] failed to start backend");
  await shutdown.shutdown();
  process.exit(1);
});
