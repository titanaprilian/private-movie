import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { buildApp, request } from "../../utils/app";
import type { App } from "../../utils/app";

describe("cors", () => {
  describe("CORS_ORIGIN env var path", () => {
    let app: App;
    const allowedOrigin = "https://example.com";

    beforeAll(async () => {
      process.env.CORS_ORIGIN = allowedOrigin;
      app = await buildApp();
    });

    afterAll(() => {
      delete process.env.CORS_ORIGIN;
    });

    it("returns the configured origin on a preflight OPTIONS request", async () => {
      const response = await request(app, {
        method: "OPTIONS",
        path: "/health",
        headers: {
          Origin: allowedOrigin,
          "Access-Control-Request-Method": "GET",
          "Access-Control-Request-Headers": "Content-Type, Authorization",
        },
      });

      expect(response.status).toBe(204);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
        allowedOrigin
      );
    });

    it("exposes the allowed methods on a preflight OPTIONS request", async () => {
      const response = await request(app, {
        method: "OPTIONS",
        path: "/health",
        headers: {
          Origin: allowedOrigin,
          "Access-Control-Request-Method": "GET",
        },
      });

      expect(response.headers.get("Access-Control-Allow-Methods")).toBe(
        "GET, POST, PUT, DELETE, PATCH"
      );
    });

    it("exposes the allowed headers on a preflight OPTIONS request", async () => {
      const response = await request(app, {
        method: "OPTIONS",
        path: "/health",
        headers: {
          Origin: allowedOrigin,
          "Access-Control-Request-Method": "GET",
          "Access-Control-Request-Headers": "Content-Type, Authorization",
        },
      });

      expect(response.headers.get("Access-Control-Allow-Headers")).toBe(
        "Content-Type, Authorization"
      );
    });

    it("sets Access-Control-Allow-Credentials to true on a preflight OPTIONS request", async () => {
      const response = await request(app, {
        method: "OPTIONS",
        path: "/health",
        headers: {
          Origin: allowedOrigin,
          "Access-Control-Request-Method": "GET",
        },
      });

      expect(response.headers.get("Access-Control-Allow-Credentials")).toBe(
        "true"
      );
    });

    it("sets Access-Control-Max-Age to 86400 on a preflight OPTIONS request", async () => {
      const response = await request(app, {
        method: "OPTIONS",
        path: "/health",
        headers: {
          Origin: allowedOrigin,
          "Access-Control-Request-Method": "GET",
        },
      });

      expect(response.headers.get("Access-Control-Max-Age")).toBe("86400");
    });

    it("returns the configured origin on an actual cross-origin GET request", async () => {
      const response = await request(app, {
        path: "/health",
        headers: {
          Origin: allowedOrigin,
        },
      });

      expect(response.status).toBe(200);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
        allowedOrigin
      );
    });
  });

  describe("development origin path", () => {
    let app: App;
    const devOrigin = "http://localhost:5173";
    let previousNodeEnv: string | undefined;

    beforeAll(async () => {
      previousNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";
      app = await buildApp();
    });

    afterAll(() => {
      process.env.NODE_ENV = previousNodeEnv;
    });

    it("allows the localhost:5173 origin in development", async () => {
      const response = await request(app, {
        method: "OPTIONS",
        path: "/health",
        headers: {
          Origin: devOrigin,
          "Access-Control-Request-Method": "GET",
        },
      });

      expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
        devOrigin
      );
    });

    it("returns the development origin on an actual cross-origin GET request", async () => {
      const response = await request(app, {
        path: "/health",
        headers: {
          Origin: devOrigin,
        },
      });

      expect(response.status).toBe(200);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
        devOrigin
      );
    });
  });
});
