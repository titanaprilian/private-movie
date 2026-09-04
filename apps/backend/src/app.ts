import { Elysia } from "elysia";
import type { AuthenticationService } from "@repo/contracts";
import type { DbClient } from "@repo/db";
import { cors } from "@elysiajs/cors";
import { rateLimit } from "@elysiajs/rate-limit";
import { errorResponse } from "./lib/response";
import { authRoutes } from "./modules/authentication/http";
import { genreRoutes } from "./modules/genres/http";
import { healthRoutes } from "./modules/health/http";
import { mediaRoutes, embedRoutes } from "./modules/media/http";
import type { FetchFn, BrowserFn, S3StorageService } from "@repo/media-service";
import { InternalServerError } from "./lib/errors";

export interface CreateAppDeps {
  db: DbClient;
  auth: AuthenticationService;
  fetchHtml?: FetchFn;
  browserFn?: BrowserFn;
  s3StorageService?: S3StorageService;
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
      console.error(error); return errorResponse(set, 500, new InternalServerError());
    })
    .use(
      rateLimit({
        duration: 60000,
        max: (key) => {
          if (key.endsWith(":login")) {
            return 10;
          }
          return 100;
        },
        generator: (request, server) => {
          const ip =
            server?.requestIP(request)?.address ||
            request.headers.get("x-forwarded-for") ||
            request.headers.get("x-real-ip") ||
            "127.0.0.1";
          const url = new URL(request.url);
          const isLogin = url.pathname === "/api/auth/login";
          return `${ip}:${isLogin ? "login" : "global"}`;
        },
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
          
          // Do not rate limit embed and media proxy endpoints 
          // (video streams rapidly fetch hundreds of chunks which breaks the global 100/min limit)
          const url = new URL(request.url);
          return url.pathname.startsWith("/embed") || url.pathname.startsWith("/api/media/relay") || url.pathname.startsWith("/api/media/proxy");
        },
      })
    )
    .group("/api", (app) =>
      app
        .use(healthRoutes({ db }))
        .use(authRoutes({ authService: auth }))
        .use(
          mediaRoutes({
            db,
            authService: auth,
            fetchHtml: deps.fetchHtml,
            browserFn: deps.browserFn,
            s3StorageService: deps.s3StorageService,
          })
        )
        .use(genreRoutes({ db, authService: auth }))
    );
};

export type App = ReturnType<typeof createApp>;
