import { describe, expect, it, beforeAll } from "vitest";
import { buildApp, request } from "../../utils/app";
import { registerUser } from "../../utils/auth";
import type { App } from "../../utils/app";

describe("POST /auth/register", () => {
  let app: App;

  beforeAll(async () => {
    app = await buildApp();
  });

  it("web registration returns 200, sets an httpOnly refreshToken cookie, and omits the refresh token from the body", async () => {
    const response = await request(app, {
      method: "POST",
      path: "/auth/register",
      body: {
        name: "Web User",
        email: "web@example.com",
        password: "password123",
      },
    });

    expect(response.status).toBe(200);

    const body = response.body as {
      data: {
        user: { id: string; email: string; name?: string };
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
  });

  it("mobile registration returns 200, includes both tokens in the body, and sets no cookie", async () => {
    const response = await request(app, {
      method: "POST",
      path: "/auth/register",
      headers: { "x-client-type": "mobile" },
      body: {
        name: "Mobile User",
        email: "mobile@example.com",
        password: "password123",
      },
    });

    expect(response.status).toBe(200);

    const body = response.body as {
      data: {
        user: { id: string; email: string; name?: string };
        tokens: { accessToken: string; refreshToken: string };
      };
    };
    expect(body.data.tokens.accessToken).toBeDefined();
    expect(body.data.tokens.refreshToken).toBeDefined();

    expect(response.cookies.refreshToken).toBeUndefined();
  });

  it("duplicate email returns 409 with EMAIL_ALREADY_REGISTERED", async () => {
    const email = "duplicate@example.com";

    await registerUser(app, { email, clientType: "web" });

    const response = await request(app, {
      method: "POST",
      path: "/auth/register",
      body: {
        name: "Duplicate User",
        email,
        password: "password123",
      },
    });

    expect(response.status).toBe(409);

    const body = response.body as { error: { code: string; message: string } };
    expect(body.error.code).toBe("EMAIL_ALREADY_REGISTERED");
  });

  it("invalid input returns 400 with INVALID_REGISTRATION_INPUT", async () => {
    const invalidCases = [
      {
        name: "Empty Name",
        body: { name: "", email: "valid@example.com", password: "password123" },
      },
      {
        name: "Bad Email",
        body: { name: "Bad Email", email: "not-an-email", password: "password123" },
      },
      {
        name: "Short Password",
        body: { name: "Short Password", email: "short@example.com", password: "short" },
      },
    ];

    for (const testCase of invalidCases) {
      const response = await request(app, {
        method: "POST",
        path: "/auth/register",
        body: testCase.body,
      });

      expect(response.status).toBe(400);

      const body = response.body as { error: { code: string; message: string } };
      expect(body.error.code).toBe("INVALID_REGISTRATION_INPUT");
    }
  });

  it("unknown error during registration falls through to the global handler and returns 500 INTERNAL_SERVER", async () => {
    const originalHash = (globalThis as Record<string, unknown>).Bun;

    (globalThis as Record<string, unknown>).Bun = {
      ...(originalHash as object),
      password: {
        hash: async () => {
          throw new Error("unexpected hash failure");
        },
        verify: async () => false,
      },
    };

    try {
      const response = await request(app, {
        method: "POST",
        path: "/auth/register",
        body: {
          name: "Error User",
          email: "error@example.com",
          password: "password123",
        },
      });

      expect(response.status).toBe(500);

      const body = response.body as { error: { code: string; message: string } };
      expect(body.error.code).toBe("INTERNAL_SERVER");
    } finally {
      (globalThis as Record<string, unknown>).Bun = originalHash;
    }
  });
});
