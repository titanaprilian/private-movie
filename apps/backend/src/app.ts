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
import { loadAppConfig } from "./config/app-config";

export type { CreateAppDeps, CreateAppOverrides } from "./app-types";
import {
  corsPlugin,
  openapiPlugin,
  errorHandlerPlugin,
  rateLimitPlugin,
  requestLoggerPlugin,
} from "./plugins";
import type { CreateAppDeps } from "./app-types";

export const createApp = (deps: CreateAppDeps) => {
  const {
    db,
    auth,
    storageService,
    storageProviderRegistry,
    browserFn,
    s3StorageService,
    scheduler,
    archiveJobService,
    archiveStagingBaseDir,
    overrides = {},
  } = deps;
  const appConfig = loadAppConfig();

  const storageUsageProvider =
    overrides.storageUsageProvider ??
    overrides.storage?.usageProvider ??
    storageService;

  return new Elysia({ name: "app" })
    .use(requestLoggerPlugin())
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
            scheduler,
            storageUsageProvider,
          })
        )
        .use(
          episodeRoutes({
            db,
            authService: auth,
            fetchHtml: overrides.fetchHtml,
            browserFn,
            s3StorageService,
            storageProviderRegistry,
          })
        )
        .use(
          seriesRoutes({
            db,
            authService: auth,
            fetchHtml: overrides.fetchHtml,
            browserFn,
            s3StorageService,
            storageProviderRegistry,
            archiveFetchFn: overrides.archiveFetchFn,
            archiveStagingBaseDir,
            archiveJobService,
          })
        )
        .use(
          seasonRoutes({
            db,
            authService: auth,
            fetchHtml: overrides.fetchHtml,
            browserFn,
            s3StorageService,
          })
        )
        .use(mediaRoutes({ db, authService: auth }))
        .use(genreRoutes({ db, authService: auth }))
        .use(
          storageRoutes({
            db,
            authService: auth,
            s3StorageService,
            storageProviderRegistry,
            storageService: overrides.storage?.service ?? storageService,
            overrides: overrides.storage,
          })
        )
    );
};

export type App = ReturnType<typeof createApp>;
