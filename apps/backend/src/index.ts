import { createDbClient } from "@repo/db";
import { createStealthBrowser } from "@repo/media-scraper";
import { createMediaService, createS3StorageService } from "@repo/media-service";
import { createApp } from "./app";
import { loadServerConfig } from "./config/server-config";
import { createAuthenticationService } from "./modules/authentication";
import { startOngoingSeasonScheduler } from "./modules/media";
import { createShutdownManager } from "./shutdown";

const db = createDbClient(process.env.DATABASE_URL);
const auth = createAuthenticationService(db);
const s3StorageService = createS3StorageService();
const browser = await createStealthBrowser();
const mediaService = createMediaService(db, { browserFn: browser.browserFn, s3StorageService });
const scheduler = await startOngoingSeasonScheduler({ db, mediaService });
const serverConfig = loadServerConfig();

const app = createApp({
  db,
  auth,
  overrides: { browserFn: browser.browserFn, s3StorageService, scheduler },
}).listen(serverConfig);

console.log(`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`);

const shutdown = createShutdownManager({
  steps: [
    { name: "http-server", run: () => app.server?.stop(false) },
    { name: "scheduler", run: () => scheduler.stop() },
    { name: "browser", run: () => browser.close() },
    { name: "database", run: () => db.$client.end() },
  ],
});
shutdown.registerShutdownHandlers();
