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

shutdown.addStep({
  name: "http-server",
  run: async () => {
    await app?.server?.stop(false);
  },
});
shutdown.addStep({ name: "scheduler", run: () => scheduler?.stop() });
shutdown.addStep({ name: "browser", run: () => browser?.close() });
shutdown.addStep({ name: "database", run: () => db?.$client.end() });

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

  app = createApp({
    db,
    auth,
    storageService,
    overrides: { browserFn: browser.browserFn, s3StorageService, scheduler },
  }).listen(serverConfig);

  logger.info(`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`);
}

bootstrap().catch(async (error) => {
  logger.error({ err: error }, "[Startup] failed to start backend");
  await shutdown.shutdown();
  process.exit(1);
});
