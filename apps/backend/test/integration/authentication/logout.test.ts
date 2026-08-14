import { describe, expect, it, beforeAll } from "vitest";
import { buildApp, request } from "../../utils/app";
import { loginUser, registerUser } from "../../utils/auth";
import type { App } from "../../utils/app";

describe("POST /auth/logout", () => {
  let app: App;

  beforeAll(async () => {
    app = await buildApp();
  });

  it("logs out with a body token, returns success, and removes the refreshToken cookie with strict cookie headers", async () => {
    const user = await registerUser(app);

    const response = await request(app, {
      method: "POST",
      path: "/auth/logout",
      cookies: { refreshToken: user.refreshToken },
      body: { refreshToken: user.refreshToken },
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
  });

  it("is idempotent when called with unknown, invalid, or already-revoked tokens", async () => {
    const unknownTokenResponse = await request(app, {
      method: "POST",
      path: "/auth/logout",
      body: { refreshToken: "unknown-or-invalid-token" },
    });
    expect(unknownTokenResponse.status).toBe(200);
    const unknownBody = unknownTokenResponse.body as { data: { success: boolean } };
    expect(unknownBody.data.success).toBe(true);

    const user = await registerUser(app);

    const firstLogout = await request(app, {
      method: "POST",
      path: "/auth/logout",
      body: { refreshToken: user.refreshToken },
    });
    expect(firstLogout.status).toBe(200);

    const secondLogout = await request(app, {
      method: "POST",
      path: "/auth/logout",
      body: { refreshToken: user.refreshToken },
    });
    expect(secondLogout.status).toBe(200);
    const secondBody = secondLogout.body as { data: { success: boolean } };
    expect(secondBody.data.success).toBe(true);
  });

  it("prioritizes body token over cookie token when both are present", async () => {
    const bodyUser = await registerUser(app, { clientType: "mobile" });
    const cookieUser = await registerUser(app, { clientType: "mobile" });

    const logoutResponse = await request(app, {
      method: "POST",
      path: "/auth/logout",
      body: { refreshToken: bodyUser.refreshToken },
      cookies: { refreshToken: cookieUser.refreshToken },
    });

    expect(logoutResponse.status).toBe(200);

    const refreshBodyUser = await request(app, {
      method: "POST",
      path: "/auth/refresh",
      body: { refreshToken: bodyUser.refreshToken },
    });
    expect(refreshBodyUser.status).toBe(401);

    const refreshCookieUser = await request(app, {
      method: "POST",
      path: "/auth/refresh",
      body: { refreshToken: cookieUser.refreshToken },
    });
    expect(refreshCookieUser.status).toBe(200);
  });

  it("logs out via the refreshToken cookie fallback, returns success, and removes the cookie", async () => {
    const user = await registerUser(app);

    const response = await request(app, {
      method: "POST",
      path: "/auth/logout",
      cookies: { refreshToken: user.refreshToken },
    });

    expect(response.status).toBe(200);

    const body = response.body as { data: { success: boolean } };
    expect(body.data.success).toBe(true);

    expect(response.cookies.refreshToken ?? "").toBe("");
  });

  it("preserves other device sessions when one device logs out", async () => {
    const deviceA = await registerUser(app, { clientType: "mobile" });
    const deviceB = await loginUser(
      app,
      { email: deviceA.user.email, password: "password123" },
      "mobile"
    );

    const logoutResponse = await request(app, {
      method: "POST",
      path: "/auth/logout",
      body: { refreshToken: deviceA.refreshToken },
    });

    expect(logoutResponse.status).toBe(200);

    const refreshResponse = await request(app, {
      method: "POST",
      path: "/auth/refresh",
      body: { refreshToken: deviceB.refreshToken },
    });

    expect(refreshResponse.status).toBe(200);
    const refreshBody = refreshResponse.body as {
      data: { tokens: { accessToken: string } };
    };
    expect(refreshBody.data.tokens.accessToken).toBeDefined();
  });

  it("returns 400 with INVALID_REGISTRATION_INPUT when no token is provided", async () => {
    const response = await request(app, {
      method: "POST",
      path: "/auth/logout",
    });

    expect(response.status).toBe(400);

    const body = response.body as { error: { code: string } };
    expect(body.error.code).toBe("INVALID_REGISTRATION_INPUT");
  });
});