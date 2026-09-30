import { createDbClient } from "@repo/db";
import { closeBrowser, createStealthBrowserFn } from "@repo/media-scraper";
import { createMediaService, createS3StorageService } from "@repo/media-service";
import { createApp } from "./app";
import { createAuthenticationService, validateJwtSecret } from "./modules/authentication";
import { createOngoingSeasonScheduler } from "./modules/media";
import { loadSchedulerConfig } from "./modules/dashboard";

validateJwtSecret();

const browserFn = createStealthBrowserFn();

const db = createDbClient(process.env.DATABASE_URL);
const auth = createAuthenticationService(db);
const s3StorageService = createS3StorageService();
const mediaService = createMediaService(db, {
  browserFn,
  s3StorageService,
});

// Load persisted scheduler configuration (falls back to 30min / enabled).
const persistedSchedulerConfig = await loadSchedulerConfig(db);

// Initialize background scheduler for ongoing seasons (runs immediately on startup when enabled)
const scheduler = createOngoingSeasonScheduler({
  mediaService,
  intervalMs: persistedSchedulerConfig.intervalMinutes * 60000,
  enabled: persistedSchedulerConfig.isEnabled,
  runImmediately: true,
});
scheduler.start();

const port = Number(process.env.PORT ?? 3000);
const hostname = process.env.HOST ?? "0.0.0.0";
const maxUploadMb = parseInt(process.env.MAX_UPLOAD_SIZE_MB || "1024", 10) || 1024;
const maxRequestBodySize = maxUploadMb * 1024 * 1024 + 20 * 1024 * 1024;

const app = createApp({ db, auth, browserFn, s3StorageService, scheduler }).listen({
  port,
  hostname,
  maxRequestBodySize,
  idleTimeout: 0,
});

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);

const handleShutdown = async () => {
  await scheduler.stop();
  await closeBrowser();
  process.exit(0);
};

process.on("SIGINT", handleShutdown);
process.on("SIGTERM", handleShutdown);

export type { App } from "./app";
