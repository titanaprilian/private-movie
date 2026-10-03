import { describe, expect, it, beforeEach } from "vitest";
import { buildApp, request } from "../utils/app";
import type { App } from "../utils/app";

const ENABLED = {
  rateLimit: { disabled: false },
  authRateLimit: { disabled: false },
};

describe("rate limiting integration tests", () => {
  let app: App;

  beforeEach(async () => {
    app = await buildApp();
  });

  it("disables rate limiting by default in the test harness", async () => {
    for (let i = 0; i < 15; i++) {
      const response = await request(app, {
        method: "POST",
        path: "/auth/login",
        body: { email: "invalid", password: "short" },
      });
      expect(response.status).not.toBe(429);
    }
  });

  it("activates login rate limiting when explicitly enabled", async () => {
    const limited = await buildApp(ENABLED);
    for (let i = 0; i < 10; i++) {
      const response = await request(limited, {
        method: "POST",
        path: "/auth/login",
        body: { email: "invalid", password: "short" },
      });
      expect(response.status).not.toBe(429);
    }

    const blockedResponse = await request(limited, {
      method: "POST",
      path: "/auth/login",
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
    const limited = await buildApp(ENABLED);
    for (let i = 0; i < 100; i++) {
      const response = await request(limited, {
        path: "/health",
      });
      expect(response.status).toBe(200);
    }

    const blockedResponse = await request(limited, {
      path: "/health",
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
    const limited = await buildApp(ENABLED);
    for (let i = 0; i < 10; i++) {
      const response = await request(limited, {
        method: "POST",
        path: "/auth/login",
        body: { email: "invalid", password: "short" },
      });
      expect(response.status).not.toBe(429);
    }

    const blockedResponse = await request(limited, {
      method: "POST",
      path: "/auth/login",
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
    const limited = await buildApp(ENABLED);
    // Exhaust /auth/login bucket (10 requests)
    for (let i = 0; i < 10; i++) {
      await request(limited, {
        method: "POST",
        path: "/auth/login",
        body: { email: "invalid", password: "short" },
      });
    }

    // 11th request to /auth/login is rate limited
    const loginBlocked = await request(limited, {
      method: "POST",
      path: "/auth/login",
      body: { email: "invalid", password: "short" },
    });
    expect(loginBlocked.status).toBe(429);

    // /health should still succeed because it uses global bucket
    const healthResponse = await request(limited, {
      path: "/health",
    });
    expect(healthResponse.status).toBe(200);
    expect(healthResponse.body).toEqual({ status: "ok", db: true });
  });

  it("does not constrain /auth/refresh by the 10 req/min login bucket", async () => {
    const limited = await buildApp(ENABLED);
    // Exhaust /auth/login bucket (10 requests)
    for (let i = 0; i < 10; i++) {
      await request(limited, {
        method: "POST",
        path: "/auth/login",
        body: { email: "invalid", password: "short" },
      });
    }

    // 11th request to /auth/login is rate limited
    const loginBlocked = await request(limited, {
      method: "POST",
      path: "/auth/login",
      body: { email: "invalid", password: "short" },
    });
    expect(loginBlocked.status).toBe(429);

    // /auth/refresh can execute more than 10 times without 429
    for (let i = 0; i < 15; i++) {
      const refreshResponse = await request(limited, {
        method: "POST",
        path: "/auth/refresh",
        body: {},
      });
      // Will return 401 (unauthorized due to missing token), not 429
      expect(refreshResponse.status).toBe(401);
    }
  });

  it("isolates rate limiting by IP using x-forwarded-for header", async () => {
    const limited = await buildApp(ENABLED);
    const ip1Headers = {
      "x-forwarded-for": "203.0.113.1, 10.0.0.1",
    };

    // Exhaust /auth/login bucket for IP 1
    for (let i = 0; i < 10; i++) {
      await request(limited, {
        method: "POST",
        path: "/auth/login",
        headers: ip1Headers,
        body: { email: "invalid", password: "short" },
      });
    }

    // 11th request for IP 1 is blocked
    const ip1Blocked = await request(limited, {
      method: "POST",
      path: "/auth/login",
      headers: ip1Headers,
      body: { email: "invalid", password: "short" },
    });
    expect(ip1Blocked.status).toBe(429);

    // Request for IP 2 is NOT blocked
    const ip2Response = await request(limited, {
      method: "POST",
      path: "/auth/login",
      headers: {
        "x-forwarded-for": "198.51.100.2, 10.0.0.1",
      },
      body: { email: "invalid", password: "short" },
    });
    expect(ip2Response.status).not.toBe(429);
  });
});
