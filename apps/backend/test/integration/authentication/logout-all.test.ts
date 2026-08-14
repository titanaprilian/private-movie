import { describe, expect, it, beforeAll } from "vitest";
import { buildApp, request } from "../../utils/app";
import { authHeaders, loginUser, registerUser } from "../../utils/auth";
import type { App } from "../../utils/app";

describe("POST /auth/logout-all", () => {
  let app: App;

  beforeAll(async () => {
    app = await buildApp();
  });

  it("revokes all sessions and removes the refreshToken cookie", async () => {
    const user = await registerUser(app);
    const secondSession = await loginUser(app, {
      email: user.user.email,
      password: "password123",
    });

    const response = await request(app, {
      method: "POST",
      path: "/auth/logout-all",
      headers: authHeaders(user.accessToken),
      cookies: { refreshToken: user.refreshToken },
    });

    expect(response.status).toBe(200);

    const body = response.body as { data: { success: boolean } };
    expect(body.data.success).toBe(true);

    expect(response.cookies.refreshToken ?? "").toBe("");

    const setCookieHeaders = response.headers.getSetCookie();
    const refreshTokenCookieHeader = setCookieHeaders.find((h) =>
      h.toLowerCase().includes("refreshtoken")
    );
    expect(refreshTokenCookieHeader).toBeDefined();
    expect(refreshTokenCookieHeader?.toLowerCase()).toContain("path=/");
    expect(refreshTokenCookieHeader?.toLowerCase()).toContain("httponly");
    expect(refreshTokenCookieHeader?.toLowerCase()).toMatch(/expires=|max-age=0/);

    // Indirect proof: every previously-issued refresh token now fails.
    for (const token of [user.refreshToken, secondSession.refreshToken]) {
      const refreshResponse = await request(app, {
        method: "POST",
        path: "/auth/refresh",
        body: { refreshToken: token },
      });

      expect(refreshResponse.status).toBe(401);

      const refreshBody = refreshResponse.body as { error: { code: string } };
      expect(refreshBody.error.code).toBe("UNAUTHORIZED");
    }
  });

  it("revokes all sessions for target user while leaving other users unaffected", async () => {
    const user1 = await registerUser(app);
    const user2 = await registerUser(app);

    const logoutAllResponse = await request(app, {
      method: "POST",
      path: "/auth/logout-all",
      headers: authHeaders(user1.accessToken),
    });

    expect(logoutAllResponse.status).toBe(200);

    const refreshUser1 = await request(app, {
      method: "POST",
      path: "/auth/refresh",
      body: { refreshToken: user1.refreshToken },
    });
    expect(refreshUser1.status).toBe(401);

    const refreshUser2 = await request(app, {
      method: "POST",
      path: "/auth/refresh",
      body: { refreshToken: user2.refreshToken },
    });
    expect(refreshUser2.status).toBe(200);
    const refreshUser2Body = refreshUser2.body as {
      data: { tokens: { accessToken: string } };
    };
    expect(refreshUser2Body.data.tokens.accessToken).toBeDefined();
  });

  it("returns 401 with UNAUTHORIZED when no bearer token is provided", async () => {
    const response = await request(app, {
      method: "POST",
      path: "/auth/logout-all",
    });

    expect(response.status).toBe(401);

    const body = response.body as { error: { code: string } };
    expect(body.error.code).toBe("UNAUTHORIZED");
  });
});