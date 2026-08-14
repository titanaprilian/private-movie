import { describe, expect, it, beforeAll } from "vitest";
import { eq } from "drizzle-orm";
import { refreshTokens, users } from "@repo/db";
import { buildApp, request } from "../../utils/app";
import { registerUser, authHeaders, signTestToken } from "../../utils/auth";
import { db } from "../../utils/db";
import type { App } from "../../utils/app";

describe("GET /auth/me", () => {
  let app: App;

  beforeAll(async () => {
    app = await buildApp();
  });

  it("valid token returns 200 with the user profile", async () => {
    const { user, accessToken } = await registerUser(app);

    const response = await request(app, {
      method: "GET",
      path: "/auth/me",
      headers: authHeaders(accessToken),
    });

    expect(response.status).toBe(200);
    const body = response.body as { data: { id: string; email: string; name?: string } };
    expect(body.data.id).toBe(user.id);
    expect(body.data.email).toBe(user.email);
    expect(body.data.name).toBe("Test User");
  });

  it("missing authorization header returns 401", async () => {
    const response = await request(app, {
      method: "GET",
      path: "/auth/me",
    });

    expect(response.status).toBe(401);
    const body = response.body as { error: { code: string; message: string } };
    expect(body.error.message).toBe("missing or invalid authorization header");
  });

  it("malformed non-Bearer authorization header returns 401", async () => {
    const response = await request(app, {
      method: "GET",
      path: "/auth/me",
      headers: { Authorization: "Basic some-token" },
    });

    expect(response.status).toBe(401);
    const body = response.body as { error: { code: string; message: string } };
    expect(body.error.message).toBe("missing or invalid authorization header");
  });

  it("malformed token (not 3 parts) returns 401 with unauthorized", async () => {
    const response = await request(app, {
      method: "GET",
      path: "/auth/me",
      headers: { Authorization: "Bearer not-a-valid-jwt" },
    });

    expect(response.status).toBe(401);
    const body = response.body as { error: { code: string; message: string } };
    expect(body.error.message).toBe("unauthorized");
  });

  it("expired token returns 401 with unauthorized", async () => {
    const { user } = await registerUser(app);
    const expiredToken = signTestToken(
      { sub: user.id, email: user.email },
      { expiresInSeconds: -3600 }
    );

    const response = await request(app, {
      method: "GET",
      path: "/auth/me",
      headers: authHeaders(expiredToken),
    });

    expect(response.status).toBe(401);
    const body = response.body as { error: { code: string; message: string } };
    expect(body.error.message).toBe("unauthorized");
  });

  it("tampered token (modified payload) returns 401 with unauthorized", async () => {
    const { user } = await registerUser(app);
    const validToken = signTestToken({ sub: user.id, email: user.email });
    const parts = validToken.split(".");
    const tamperedPayload = Buffer.from(
      JSON.stringify({ sub: "different-user-id", exp: 9999999999 })
    ).toString("base64url");
    const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

    const response = await request(app, {
      method: "GET",
      path: "/auth/me",
      headers: authHeaders(tamperedToken),
    });

    expect(response.status).toBe(401);
    const body = response.body as { error: { code: string; message: string } };
    expect(body.error.message).toBe("unauthorized");
  });

  it("valid token for a deleted user returns 404 with USER_NOT_FOUND", async () => {
    const { user, accessToken } = await registerUser(app);

    await db.delete(refreshTokens).where(eq(refreshTokens.userId, user.id));
    await db.delete(users).where(eq(users.id, user.id));

    const response = await request(app, {
      method: "GET",
      path: "/auth/me",
      headers: authHeaders(accessToken),
    });

    expect(response.status).toBe(404);
    const body = response.body as { error: { code: string; message: string } };
    expect(body.error.code).toBe("USER_NOT_FOUND");
  });
});