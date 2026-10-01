import { Elysia } from "elysia";
import type { AuthenticationService } from "@repo/contracts";
import type { DbClient } from "@repo/db";
import { cors } from "@elysiajs/cors";
import { openapi } from "@elysiajs/openapi";
import { rateLimit } from "@elysiajs/rate-limit";
import { getClientIp } from "./lib/ip";
import { errorResponse } from "./lib/response";
import { authRoutes } from "./modules/authentication/http";
import { dashboardRoutes } from "./modules/dashboard/http";
import { episodeRoutes, UNTHROTTLED_EPISODE_ROUTE_SUFFIXES } from "./modules/episodes/http";
import { genreRoutes } from "./modules/genres/http";
import { healthRoutes } from "./modules/health/http";
import { mediaRoutes, embedRoutes, UNTHROTTLED_MEDIA_ROUTE_PREFIXES } from "./modules/media/http";
import { seasonRoutes } from "./modules/seasons/http";
import { seriesRoutes } from "./modules/series/http";
import { storageRoutes } from "./modules/storage/http";
import { createStorageService } from "./modules/storage/index";
import type { StorageUsageProvider } from "./modules/dashboard/index";
import type { FetchFn, BrowserFn, S3StorageService, StorageProviderRegistry } from "@repo/media-service";
import type { OngoingSeasonScheduler } from "./modules/media/scheduler";
import { InternalServerError, getDomainErrorStatus } from "./lib/errors";
import type {
  ArchiveExtractFn,
  ArchiveFetchFn,
} from "./modules/series";

export interface CreateAppDeps {
  db: DbClient;
  auth: AuthenticationService;
  fetchHtml?: FetchFn;
  browserFn?: BrowserFn;
  s3StorageService?: S3StorageService;
  storageProviderRegistry?: StorageProviderRegistry;
  archiveFetchFn?: ArchiveFetchFn;
  archiveExtractFn?: ArchiveExtractFn;
  archiveStagingBaseDir?: string;
  minioInspector?: Parameters<typeof storageRoutes>[0]["minioInspector"];
  minioContainerStarter?: Parameters<typeof storageRoutes>[0]["minioContainerStarter"];
  minioHealthChecker?: Parameters<typeof storageRoutes>[0]["minioHealthChecker"];
  minioBucketProvisioner?: Parameters<typeof storageRoutes>[0]["minioBucketProvisioner"];
  scheduler?: Pick<
    OngoingSeasonScheduler,
    "runNow" | "isEnabled" | "isExecuting" | "getIntervalMs" | "getLastRunAt" | "getLastRunResult" | "getNextRunAt" | "setEnabled" | "updateInterval"
  > | null;
  storageUsageProvider?: StorageUsageProvider | null;
}

function getAllowedOrigins(): string[] {
  if (process.env.NODE_ENV === "development") {
    return [];
  }
  const raw = process.env.CORS_ORIGIN || "http://localhost:5173";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isApiDocsEnabled(): boolean {
  if (process.env.ENABLE_API_DOCS === "true") return true;
  return process.env.NODE_ENV !== "production";
}

export const createApp = (deps: CreateAppDeps) => {
  const { db, auth } = deps;
  const allowedOrigins = getAllowedOrigins();

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
    .use(
      isApiDocsEnabled()
        ? openapi({
            path: "/docs",
            specPath: "/docs/json",
            provider: "scalar",
            documentation: {
              tags: [
                { name: "Authentication", description: "User registration, login, and session management." },
                { name: "Dashboard & Scheduler", description: "Admin overview statistics and ongoing-season scheduler controls." },
                { name: "Series", description: "Series catalog, discovery feeds, and TMDB import/sync." },
                { name: "Seasons", description: "Season details, updates, and ongoing-season scraping." },
                { name: "Episodes", description: "Episode listing, video sources, uploads, and scraping." },
                { name: "Genres", description: "Genre taxonomy management." },
                { name: "Storage", description: "Storage providers, S3 inventory, and orphan management." },
                { name: "Media & Playback", description: "Video source health checks and playback support." },
                { name: "Health", description: "Service and database health checks." },
              ],
            },
          })
        : (app) => app
    )
    .use(embedRoutes())
    .use(
      cors({
        origin: (request) => {
          const origin = request.headers.get("origin");
          // In development allow any origin matching local dev servers or same-origin
          if (process.env.NODE_ENV === "development" && origin) {
            return true;
          }
          if (!origin || allowedOrigins.length === 0) {
            return false;
          }
          return allowedOrigins.includes(origin);
        },
        methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
        allowedHeaders: ["Content-Type", "Authorization"],
        credentials: true,
        maxAge: 86400,
      })
    )
    .onError(({ code, set, error }) => {
      if (code === "NOT_FOUND") {
        return;
      }
      if (code === "VALIDATION") {
        set.status = 400;
        return {
          error: {
            code: "VALIDATION",
            message: "request validation failed",
          },
        };
      }
      const domainStatus = getDomainErrorStatus(error);
      if (domainStatus !== null) {
        return errorResponse(set, domainStatus, error as Error);
      }
      console.error("[Unhandled Server Error]", error);
      return errorResponse(set, 500, new InternalServerError());
    })
    .use(
      rateLimit({
        duration: 60000,
        max: 100,
        generator: (request, server) => getClientIp(request, server),
        errorResponse: new Response(
          JSON.stringify({
            error: {
              code: "RATE_LIMIT",
              message: "rate-limit reached",
            },
          }),
          {
            status: 429,
            headers: {
              "Content-Type": "application/json",
            },
          }
        ),
        skip: (request) => {
          if (process.env.NODE_ENV === "test") {
            return request.headers.get("x-test-rate-limit") !== "true";
          }
          
          // Do not rate limit embed, media proxy, and long-lived streaming endpoints 
          // (video streams rapidly fetch hundreds of chunks which breaks the global 100/min limit)
          const url = new URL(request.url);
          const isMediaUnthrottled = UNTHROTTLED_MEDIA_ROUTE_PREFIXES.some((prefix) =>
            url.pathname.startsWith(prefix)
          );
          const isEpisodeUnthrottled = UNTHROTTLED_EPISODE_ROUTE_SUFFIXES.some((suffix) =>
            url.pathname.endsWith(suffix)
          );
          return isMediaUnthrottled || isEpisodeUnthrottled;
        },
      })
    )
    .group("/api", (app) =>
      app
        .use(healthRoutes({ db }))
        .use(authRoutes({ authService: auth }))
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
