import { Elysia } from "elysia";
import type { AuthenticationService } from "@repo/contracts";
import type { DbClient } from "@repo/db";
import { cors } from "@elysiajs/cors";
import { rateLimit } from "@elysiajs/rate-limit";
import { getClientIp } from "./lib/ip";
import { errorResponse } from "./lib/response";
import { authRoutes } from "./modules/authentication/http";
import { episodeRoutes, UNTHROTTLED_EPISODE_ROUTE_SUFFIXES } from "./modules/episodes/http";
import { genreRoutes } from "./modules/genres/http";
import { healthRoutes } from "./modules/health/http";
import { mediaRoutes, embedRoutes, UNTHROTTLED_MEDIA_ROUTE_PREFIXES } from "./modules/media/http";
import { seasonRoutes } from "./modules/seasons/http";
import { seriesRoutes } from "./modules/series/http";
import { storageRoutes } from "./modules/storage/http";
import type { FetchFn, BrowserFn, S3StorageService, StorageProviderRegistry } from "@repo/media-service";
import { InternalServerError, getDomainErrorStatus } from "./lib/errors";

export interface CreateAppDeps {
  db: DbClient;
  auth: AuthenticationService;
  fetchHtml?: FetchFn;
  browserFn?: BrowserFn;
  s3StorageService?: S3StorageService;
  storageProviderRegistry?: StorageProviderRegistry;
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

export const createApp = (deps: CreateAppDeps) => {
  const { db, auth } = deps;
  const allowedOrigins = getAllowedOrigins();

  return new Elysia({ name: "app" })
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
          })
        )
    );
};

export type App = ReturnType<typeof createApp>;
