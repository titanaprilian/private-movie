import { createDbClient } from "@repo/db";
import { initBrowser, closeBrowser, createStealthBrowserFn } from "@repo/media-scraper";
import { createS3StorageService } from "@repo/media-service";
import { createApp } from "./app";
import { createAuthenticationService } from "./modules/authentication";

await initBrowser();
const browserFn = createStealthBrowserFn();

const db = createDbClient(process.env.DATABASE_URL);
const auth = createAuthenticationService(db);
const s3StorageService = createS3StorageService();

const port = Number(process.env.PORT ?? 3000);
const hostname = process.env.HOST ?? "0.0.0.0";

const app = createApp({ db, auth, browserFn, s3StorageService }).listen({ port, hostname });

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);

const handleShutdown = async () => {
  await closeBrowser();
  process.exit(0);
};

process.on("SIGINT", handleShutdown);
process.on("SIGTERM", handleShutdown);

export type { App } from "./app";
