import { Elysia } from "elysia";
import type { AuthenticationService } from "@repo/contracts";
import type { DbClient } from "@repo/db";
import { cors } from "@elysiajs/cors";
import { rateLimit } from "@elysiajs/rate-limit";
import { errorResponse } from "./lib/response";
import { authRoutes } from "./modules/authentication/http";
import { healthRoutes } from "./modules/health/http";
import { mediaRoutes } from "./modules/media/http";
import type { FetchFn } from "@repo/media-service";
import { InternalServerError } from "./lib/errors";

export interface CreateAppDeps {
  db: DbClient;
  auth: AuthenticationService;
  fetchHtml?: FetchFn;
}

function getAllowedOrigin(): string | undefined {
  if (process.env.NODE_ENV === "development") {
    return "http://localhost:5173";
  }
  return process.env.CORS_ORIGIN || "http://localhost:5173";
}

export const createApp = (deps: CreateAppDeps) => {
  const { db, auth } = deps;
  const allowedOrigin = getAllowedOrigin();

  return new Elysia({ name: "app" })
    .use(
      cors({
        origin: (request) => {
          const origin = request.headers.get("origin");
          if (!origin || !allowedOrigin) {
            return false;
          }
          return origin === allowedOrigin;
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
          return false;
        },
      })
    )
    .group("/api", (app) =>
      app
        .use(healthRoutes({ db }))
        .use(authRoutes({ authService: auth }))
        .use(mediaRoutes({ db, authService: auth, fetchHtml: deps.fetchHtml }))
    );
};

export type App = ReturnType<typeof createApp>;
