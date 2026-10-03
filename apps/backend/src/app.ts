import { Elysia } from "elysia";
import type { AuthenticationService } from "@repo/contracts";
import type { DbClient } from "@repo/db";
import { authRoutes, type AuthRateLimitOptions } from "./modules/authentication/http";
import { dashboardRoutes } from "./modules/dashboard/http";
import { episodeRoutes } from "./modules/episodes/http";
import { genreRoutes } from "./modules/genres/http";
import { healthRoutes } from "./modules/health/http";
import { mediaRoutes, embedRoutes } from "./modules/media/http";
import { seasonRoutes } from "./modules/seasons/http";
import { seriesRoutes } from "./modules/series/http";
import { storageRoutes } from "./modules/storage/http";
import { createStorageService } from "./modules/storage/index";
import type { MinioDeps } from "./modules/storage/index";
import { loadAppConfig, isApiDocsEnabled } from "./config/app-config";

// Re-exported so existing consumers (e.g. docs tests) keep importing from "@/app".
export { isApiDocsEnabled };
import {
  corsPlugin,
  openapiPlugin,
  errorHandlerPlugin,
  rateLimitPlugin,
  type RateLimitPluginOptions,
} from "./plugins";
import type { StorageUsageProvider } from "./modules/dashboard/index";
import type { FetchFn, BrowserFn, S3StorageService, StorageProviderRegistry } from "@repo/media-service";
import type { OngoingSeasonScheduler } from "./modules/media/scheduler";
import type {
  ArchiveExtractFn,
  ArchiveFetchFn,
} from "./modules/series";

export interface CreateAppDeps extends MinioDeps {
  db: DbClient;
  auth: AuthenticationService;
  fetchHtml?: FetchFn;
  browserFn?: BrowserFn;
  s3StorageService?: S3StorageService;
  storageProviderRegistry?: StorageProviderRegistry;
  archiveFetchFn?: ArchiveFetchFn;
  archiveExtractFn?: ArchiveExtractFn;
  archiveStagingBaseDir?: string;
  scheduler?: Pick<
    OngoingSeasonScheduler,
    "runNow" | "isEnabled" | "isExecuting" | "getIntervalMs" | "getLastRunAt" | "getLastRunResult" | "getNextRunAt" | "setEnabled" | "updateInterval"
  > | null;
  storageUsageProvider?: StorageUsageProvider | null;
  rateLimit?: RateLimitPluginOptions;
  authRateLimit?: AuthRateLimitOptions;
}

export const createApp = (deps: CreateAppDeps) => {
  const { db, auth } = deps;
  const appConfig = loadAppConfig();

  // Dedicated storage service instance for dashboard usage stats. It reuses
  // the storage module's cached S3 inventory scan (60s TTL), so dashboard
  // polling never triggers a live S3 listing on every request.
  const dashboardStorageService = createStorageService(db, {
    s3StorageService: deps.s3StorageService,
    storageProviderRegistry: deps.storageProviderRegistry,
  });
  // Explicit null disables usage reporting (used in tests); undefined uses
  // the built-in cached S3 inventory scan.
  const storageUsageProvider: StorageUsageProvider | null =
    deps.storageUsageProvider === undefined
      ? {
          async getTotalUsedBytes() {
            const providers = await dashboardStorageService.listProviders();
            const enabled = providers.filter((p) => p.isEnabled);
            if (enabled.length === 0) return null;
            // All-or-nothing: a partial sum across providers would be misleading,
            // so any single failure reports usage as unavailable ("Not tracked").
            let total = 0;
            for (const provider of enabled) {
              total += (await dashboardStorageService.getMetrics(provider.id)).totalBytes;
            }
            return total;
          },
        }
      : deps.storageUsageProvider;

  return new Elysia({ name: "app" })
    .use(openapiPlugin({ enabled: appConfig.apiDocsEnabled }))
    .use(embedRoutes())
    .use(corsPlugin(appConfig))
    .use(errorHandlerPlugin())
    .use(rateLimitPlugin(deps.rateLimit))
    .group("/api", (app) =>
      app
        .use(healthRoutes({ db }))
        .use(authRoutes({ authService: auth, rateLimit: deps.authRateLimit }))
        .use(dashboardRoutes({ db, authService: auth, scheduler: deps.scheduler ?? null, storageUsageProvider }))
        .use(
          episodeRoutes({
            db,
            authService: auth,
            fetchHtml: deps.fetchHtml,
            browserFn: deps.browserFn,
            s3StorageService: deps.s3StorageService,
            storageProviderRegistry: deps.storageProviderRegistry,
          })
        )
        .use(
          seriesRoutes({
            db,
            authService: auth,
            fetchHtml: deps.fetchHtml,
            browserFn: deps.browserFn,
            s3StorageService: deps.s3StorageService,
            storageProviderRegistry: deps.storageProviderRegistry,
            archiveFetchFn: deps.archiveFetchFn,
            archiveExtractFn: deps.archiveExtractFn,
            archiveStagingBaseDir: deps.archiveStagingBaseDir,
          })
        )
        .use(
          seasonRoutes({
            db,
            authService: auth,
            fetchHtml: deps.fetchHtml,
            browserFn: deps.browserFn,
            s3StorageService: deps.s3StorageService,
          })
        )
        .use(
          mediaRoutes({
            db,
            authService: auth,
          })
        )
        .use(genreRoutes({ db, authService: auth }))
        .use(
          storageRoutes({
            db,
            authService: auth,
            s3StorageService: deps.s3StorageService,
            storageProviderRegistry: deps.storageProviderRegistry,
            minioInspector: deps.minioInspector,
            minioContainerStarter: deps.minioContainerStarter,
            minioHealthChecker: deps.minioHealthChecker,
            minioBucketProvisioner: deps.minioBucketProvisioner,
          })
        )
    );
};

export type App = ReturnType<typeof createApp>;
