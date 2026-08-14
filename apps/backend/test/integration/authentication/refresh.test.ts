import { describe, expect, it, beforeAll } from "vitest";
import { eq } from "drizzle-orm";
import { refreshTokens } from "@repo/db";
import { buildApp, request } from "../../utils/app";
import { authHeaders, registerUser, loginUser } from "../../utils/auth";
import { db } from "../../utils/db";
import type { App } from "../../utils/app";

describe("POST /auth/refresh", () => {
  let app: App;

  beforeAll(async () => {
    app = await buildApp();
  });

  it("web refresh returns 200, rotates the refresh token in an httpOnly cookie, omits it from the body, and revokes the old token", async () => {
    const registered = await registerUser(app, {
      email: "web-refresh@example.com",
      clientType: "web",
    });

    const response = await request(app, {
      method: "POST",
      path: "/auth/refresh",
      cookies: { refreshToken: registered.refreshToken },
    });

    expect(response.status).toBe(200);

    const body = response.body as {
      data: {
        user: { id: string; email: string };
        tokens: { accessToken: string; refreshToken?: string };
      };
    };
    expect(body.data.tokens.accessToken).toBeDefined();
    expect(body.data.tokens.refreshToken).toBeUndefined();

    const setCookies = response.headers.getSetCookie?.() ?? [];
    const refreshCookie = setCookies.find((cookie) =>
      cookie.startsWith("refreshToken=")
    );
    expect(refreshCookie).toBeDefined();
    expect(refreshCookie).toMatch(/HttpOnly/i);
    expect(refreshCookie).toMatch(/Secure/i);

    const tokens = await db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.userId, registered.user.id));

    expect(tokens).toHaveLength(2);
    expect(tokens.some((token) => token.revoked)).toBe(true);
    expect(tokens.some((token) => !token.revoked)).toBe(true);
  });

  it("mobile refresh returns 200, includes both tokens in the body, sets no cookie, and revokes the old token", async () => {
    const registered = await registerUser(app, {
      email: "mobile-refresh@example.com",
      clientType: "mobile",
    });

    const response = await request(app, {
      method: "POST",
      path: "/auth/refresh",
      headers: { "x-client-type": "mobile" },
      body: { refreshToken: registered.refreshToken },
    });

    expect(response.status).toBe(200);

    const body = response.body as {
      data: {
        user: { id: string; email: string };
        tokens: { accessToken: string; refreshToken: string };
      };
    };
    expect(body.data.tokens.accessToken).toBeDefined();
    expect(body.data.tokens.refreshToken).toBeDefined();
    expect(response.cookies.refreshToken).toBeUndefined();

    const tokens = await db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.userId, registered.user.id));

    expect(tokens).toHaveLength(2);
    expect(tokens.some((token) => token.revoked)).toBe(true);
    expect(tokens.some((token) => !token.revoked)).toBe(true);
  });

  it("body refreshToken takes precedence over the cookie refreshToken", async () => {
    const firstSession = await registerUser(app, {
      email: "body-precedence@example.com",
      clientType: "web",
    });
    const secondSession = await loginUser(app, {
      email: firstSession.user.email,
      password: "password123",
    });

    const response = await request(app, {
      method: "POST",
      path: "/auth/refresh",
      body: { refreshToken: firstSession.refreshToken },
      cookies: { refreshToken: secondSession.refreshToken },
    });

    expect(response.status).toBe(200);

    const tokens = await db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.userId, firstSession.user.id));

    const revokedTokens = tokens.filter((token) => token.revoked);
    const activeTokens = tokens.filter((token) => !token.revoked);

    expect(revokedTokens).toHaveLength(1);
    expect(activeTokens).toHaveLength(2);

    const responseBody = response.body as {
      data: { tokens: { accessToken: string; refreshToken?: string } };
    };
    expect(responseBody.data.tokens.accessToken).toBeDefined();
    expect(responseBody.data.tokens.refreshToken).toBeUndefined();
  });

  it("no token returns 401 with UNAUTHORIZED", async () => {
    const response = await request(app, {
      method: "POST",
      path: "/auth/refresh",
    });

    expect(response.status).toBe(401);

    const body = response.body as { error: { code: string; message: string } };
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(body.error.message).toBe("refresh token is required");
  });

  it("unknown token returns 401 with UNAUTHORIZED", async () => {
    const response = await request(app, {
      method: "POST",
      path: "/auth/refresh",
      body: { refreshToken: "not-a-real-token" },
    });

    expect(response.status).toBe(401);

    const body = response.body as { error: { code: string; message: string } };
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(body.error.message).toBe("invalid or expired refresh token");
  });

  it("reuse detection revokes all tokens for the user and returns 401", async () => {
    const registered = await registerUser(app, {
      email: "reuse-detection@example.com",
      clientType: "mobile",
    });

    const firstRefresh = await request(app, {
      method: "POST",
      path: "/auth/refresh",
      headers: { "x-client-type": "mobile" },
      body: { refreshToken: registered.refreshToken },
    });

    expect(firstRefresh.status).toBe(200);

    const firstRefreshBody = firstRefresh.body as {
      data: { tokens: { refreshToken: string } };
    };
    const newToken = firstRefreshBody.data.tokens.refreshToken;

    const reuseAttempt = await request(app, {
      method: "POST",
      path: "/auth/refresh",
      headers: { "x-client-type": "mobile" },
      body: { refreshToken: registered.refreshToken },
    });

    expect(reuseAttempt.status).toBe(401);

    const reuseBody = reuseAttempt.body as { error: { code: string } };
    expect(reuseBody.error.code).toBe("UNAUTHORIZED");

    const newTokenAttempt = await request(app, {
      method: "POST",
      path: "/auth/refresh",
      headers: { "x-client-type": "mobile" },
      body: { refreshToken: newToken },
    });

    expect(newTokenAttempt.status).toBe(401);

    const newTokenBody = newTokenAttempt.body as { error: { code: string } };
    expect(newTokenBody.error.code).toBe("UNAUTHORIZED");
  });

  it("token created before logout-all is invalidated by sessionsValidAfter and returns 401", async () => {
    const registered = await registerUser(app, {
      email: "logout-all-invalidation@example.com",
      clientType: "mobile",
    });

    const logoutAllResponse = await request(app, {
      method: "POST",
      path: "/auth/logout-all",
      headers: authHeaders(registered.accessToken),
    });

    expect(logoutAllResponse.status).toBe(200);

    const response = await request(app, {
      method: "POST",
      path: "/auth/refresh",
      headers: { "x-client-type": "mobile" },
      body: { refreshToken: registered.refreshToken },
    });

    expect(response.status).toBe(401);

    const body = response.body as { error: { code: string } };
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("expired token returns 401 with UNAUTHORIZED", async () => {
    const registered = await registerUser(app, {
      email: "expired-refresh@example.com",
      clientType: "mobile",
    });

    const [tokenRecord] = await db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.userId, registered.user.id));

    await db
      .update(refreshTokens)
      .set({ expiresAt: new Date(Date.now() - 60_000) })
      .where(eq(refreshTokens.id, tokenRecord.id));

    const response = await request(app, {
      method: "POST",
      path: "/auth/refresh",
      headers: { "x-client-type": "mobile" },
      body: { refreshToken: registered.refreshToken },
    });

    expect(response.status).toBe(401);

    const body = response.body as { error: { code: string; message: string } };
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(body.error.message).toBe("invalid or expired refresh token");
  });
});
