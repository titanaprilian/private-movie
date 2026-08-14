import { describe, expect, it, beforeEach } from "vitest";
import { buildApp, request } from "../utils/app";
import type { App } from "../utils/app";

describe("rate limiting integration tests", () => {
  let app: App;

  beforeEach(async () => {
    app = await buildApp();
  });

  it("skips rate limiting when x-test-rate-limit header is missing", async () => {
    for (let i = 0; i < 15; i++) {
      const response = await request(app, {
        method: "POST",
        path: "/auth/login",
        body: { email: "invalid", password: "short" },
      });
      expect(response.status).not.toBe(429);
    }
  });

  it("activates rate limiting when x-test-rate-limit: true is provided", async () => {
    for (let i = 0; i < 10; i++) {
      const response = await request(app, {
        method: "POST",
        path: "/auth/login",
        headers: {
          "x-test-rate-limit": "true",
        },
        body: { email: "invalid", password: "short" },
      });
      expect(response.status).not.toBe(429);
    }

    const blockedResponse = await request(app, {
      method: "POST",
      path: "/auth/login",
      headers: {
        "x-test-rate-limit": "true",
      },
      body: { email: "invalid", password: "short" },
    });
    expect(blockedResponse.status).toBe(429);
    expect(blockedResponse.body).toEqual({
      error: {
        code: "RATE_LIMIT",
        message: "rate-limit reached",
      },
    });
  });

  it("limits generic endpoint /health to 100 requests", async () => {
    for (let i = 0; i < 100; i++) {
      const response = await request(app, {
        path: "/health",
        headers: {
          "x-test-rate-limit": "true",
        },
      });
      expect(response.status).toBe(200);
    }

    const blockedResponse = await request(app, {
      path: "/health",
      headers: {
        "x-test-rate-limit": "true",
      },
    });
    expect(blockedResponse.status).toBe(429);
    expect(blockedResponse.body).toEqual({
      error: {
        code: "RATE_LIMIT",
        message: "rate-limit reached",
      },
    });
  });

  it("limits /auth/login endpoint to 10 requests", async () => {
    for (let i = 0; i < 10; i++) {
      const response = await request(app, {
        method: "POST",
        path: "/auth/login",
        headers: {
          "x-test-rate-limit": "true",
        },
        body: { email: "invalid", password: "short" },
      });
      expect(response.status).not.toBe(429);
    }

    const blockedResponse = await request(app, {
      method: "POST",
      path: "/auth/login",
      headers: {
        "x-test-rate-limit": "true",
      },
      body: { email: "invalid", password: "short" },
    });
    expect(blockedResponse.status).toBe(429);
    expect(blockedResponse.body).toEqual({
      error: {
        code: "RATE_LIMIT",
        message: "rate-limit reached",
      },
    });
  });

  it("isolates rate-limit buckets between /auth/login and /health for the same IP", async () => {
    // Exhaust /auth/login bucket (10 requests)
    for (let i = 0; i < 10; i++) {
      await request(app, {
        method: "POST",
        path: "/auth/login",
        headers: {
          "x-test-rate-limit": "true",
        },
        body: { email: "invalid", password: "short" },
      });
    }

    // 11th request to /auth/login is rate limited
    const loginBlocked = await request(app, {
      method: "POST",
      path: "/auth/login",
      headers: {
        "x-test-rate-limit": "true",
      },
      body: { email: "invalid", password: "short" },
    });
    expect(loginBlocked.status).toBe(429);

    // /health should still succeed because it uses global bucket
    const healthResponse = await request(app, {
      path: "/health",
      headers: {
        "x-test-rate-limit": "true",
      },
    });
    expect(healthResponse.status).toBe(200);
    expect(healthResponse.body).toEqual({ status: "ok", db: true });
  });
});
