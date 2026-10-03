import { Elysia } from "elysia";
import { authRoutes } from "./modules/authentication/http";
import { dashboardRoutes } from "./modules/dashboard/http";
import { episodeRoutes } from "./modules/episodes/http";
import { genreRoutes } from "./modules/genres/http";
import { healthRoutes } from "./modules/health/http";
import { mediaRoutes, embedRoutes } from "./modules/media/http";
import { seasonRoutes } from "./modules/seasons/http";
import { seriesRoutes } from "./modules/series/http";
import { storageRoutes } from "./modules/storage/http";
import { createStorageService } from "./modules/storage/index";
import { loadAppConfig, isApiDocsEnabled } from "./config/app-config";

// Re-exported so existing consumers (e.g. docs tests) keep importing from "@/app".
export { isApiDocsEnabled };
export type { CreateAppDeps, CreateAppOverrides } from "./app-types";
import {
  corsPlugin,
  openapiPlugin,
  errorHandlerPlugin,
  rateLimitPlugin,
} from "./plugins";
import type { CreateAppDeps } from "./app-types";

export const createApp = (deps: CreateAppDeps) => {
  const { db, auth, overrides = {} } = deps;
  const appConfig = loadAppConfig();

  const storageService =
    overrides.storageService === undefined
      ? createStorageService(db, {
          s3StorageService: overrides.s3StorageService,
          storageProviderRegistry: overrides.storageProviderRegistry,
          minioInspector: overrides.minioInspector,
          minioContainerStarter: overrides.minioContainerStarter,
          minioHealthChecker: overrides.minioHealthChecker,
          minioBucketProvisioner: overrides.minioBucketProvisioner,
        })
      : overrides.storageService;
  const storageUsageProvider =
    overrides.storageUsageProvider !== undefined
      ? overrides.storageUsageProvider
      : storageService;

  const shared = {
    db,
    authService: auth,
    fetchHtml: overrides.fetchHtml,
    browserFn: overrides.browserFn,
    s3StorageService: overrides.s3StorageService,
    storageProviderRegistry: overrides.storageProviderRegistry,
  };

  return new Elysia({ name: "app" })
    .use(openapiPlugin({ enabled: appConfig.apiDocsEnabled }))
    .use(embedRoutes())
    .use(corsPlugin(appConfig))
    .use(errorHandlerPlugin())
    .use(rateLimitPlugin(overrides.rateLimit))
    .group("/api", (app) =>
      app
        .use(healthRoutes({ db }))
        .use(authRoutes({ authService: auth, rateLimit: overrides.authRateLimit }))
        .use(
          dashboardRoutes({
            db,
            authService: auth,
            scheduler: overrides.scheduler ?? null,
            storageUsageProvider,
          })
        )
        .use(episodeRoutes({ ...shared }))
        .use(
          seriesRoutes({
            ...shared,
            archiveFetchFn: overrides.archiveFetchFn,
            archiveExtractFn: overrides.archiveExtractFn,
            archiveStagingBaseDir: overrides.archiveStagingBaseDir,
          })
        )
        .use(seasonRoutes({ ...shared }))
        .use(mediaRoutes({ db, authService: auth }))
        .use(genreRoutes({ db, authService: auth }))
        .use(
          storageRoutes({
            ...shared,
            storageService: storageService ?? undefined,
            minioInspector: overrides.minioInspector,
            minioContainerStarter: overrides.minioContainerStarter,
            minioHealthChecker: overrides.minioHealthChecker,
            minioBucketProvisioner: overrides.minioBucketProvisioner,
          })
        )
    );
};

export type App = ReturnType<typeof createApp>;
