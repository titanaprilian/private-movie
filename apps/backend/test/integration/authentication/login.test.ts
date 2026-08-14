import { describe, expect, it, beforeAll } from "vitest";
import { eq } from "drizzle-orm";
import { users } from "@repo/db";
import { buildApp, request } from "../../utils/app";
import { registerUser } from "../../utils/auth";
import { db } from "../../utils/db";
import type { App } from "../../utils/app";

describe("POST /auth/login", () => {
  let app: App;

  beforeAll(async () => {
    app = await buildApp();
  });

  it("web login returns 200, sets an httpOnly refreshToken cookie, and omits the refresh token from the body", async () => {
    const password = "password123";
    const registered = await registerUser(app, {
      email: "web-login@example.com",
      password,
      clientType: "web",
    });

    const response = await request(app, {
      method: "POST",
      path: "/auth/login",
      body: {
        email: registered.user.email,
        password,
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

  it("mobile login returns 200, includes both tokens in the body, and sets no cookie", async () => {
    const password = "password123";
    const registered = await registerUser(app, {
      email: "mobile-login@example.com",
      password,
      clientType: "mobile",
    });

    const response = await request(app, {
      method: "POST",
      path: "/auth/login",
      headers: { "x-client-type": "mobile" },
      body: {
        email: registered.user.email,
        password,
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

  it("invalid credentials returns 401 with INVALID_CREDENTIALS", async () => {
    const password = "password123";
    const registered = await registerUser(app, {
      email: "invalid-creds@example.com",
      password,
      clientType: "web",
    });

    const response = await request(app, {
      method: "POST",
      path: "/auth/login",
      body: {
        email: registered.user.email,
        password: "wrong-password",
      },
    });

    expect(response.status).toBe(401);

    const body = response.body as { error: { code: string; message: string } };
    expect(body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("locked account returns 429 with ACCOUNT_LOCKED", async () => {
    const password = "password123";
    const registered = await registerUser(app, {
      email: "locked-account@example.com",
      password,
      clientType: "web",
    });

    for (let i = 0; i < 5; i++) {
      await request(app, {
        method: "POST",
        path: "/auth/login",
        body: {
          email: registered.user.email,
          password: "wrong-password",
        },
      });
    }

    const response = await request(app, {
      method: "POST",
      path: "/auth/login",
      body: {
        email: registered.user.email,
        password,
      },
    });

    expect(response.status).toBe(429);

    const body = response.body as { error: { code: string; message: string } };
    expect(body.error.code).toBe("ACCOUNT_LOCKED");
  });

  it("unknown error during login falls through to the global handler and returns 500 INTERNAL_SERVER", async () => {
    const password = "password123";
    const registered = await registerUser(app, {
      email: "login-error@example.com",
      password,
      clientType: "web",
    });

    const originalHash = (globalThis as Record<string, unknown>).Bun;

    (globalThis as Record<string, unknown>).Bun = {
      ...(originalHash as object),
      password: {
        hash: async (plaintext: string) => `test$${plaintext}`,
        verify: async () => {
          throw new Error("unexpected verify failure");
        },
      },
    };

    try {
      const response = await request(app, {
        method: "POST",
        path: "/auth/login",
        body: {
          email: registered.user.email,
          password,
        },
      });

      expect(response.status).toBe(500);

      const body = response.body as { error: { code: string; message: string } };
      expect(body.error.code).toBe("INTERNAL_SERVER");
    } finally {
      (globalThis as Record<string, unknown>).Bun = originalHash;
    }
  });

  it("5 failed logins apply a lock: 5th returns 401 and DB has lockedUntil, 6th returns 429", async () => {
    const password = "password123";
    const registered = await registerUser(app, {
      email: "lock-test@example.com",
      password,
      clientType: "web",
    });

    for (let i = 0; i < 4; i++) {
      const failed = await request(app, {
        method: "POST",
        path: "/auth/login",
        body: {
          email: registered.user.email,
          password: "wrong-password",
        },
      });
      expect(failed.status).toBe(401);
    }

    const fifth = await request(app, {
      method: "POST",
      path: "/auth/login",
      body: {
        email: registered.user.email,
        password: "wrong-password",
      },
    });
    expect(fifth.status).toBe(401);

    const [userRow] = await db
      .select()
      .from(users)
      .where(eq(users.email, registered.user.email));

    expect(userRow.lockedUntil).not.toBeNull();
    expect(userRow.failedAttempts).toBe(5);

    const sixth = await request(app, {
      method: "POST",
      path: "/auth/login",
      body: {
        email: registered.user.email,
        password,
      },
    });
    expect(sixth.status).toBe(429);

    const body = sixth.body as { error: { code: string; message: string } };
    expect(body.error.code).toBe("ACCOUNT_LOCKED");
  });

  it("expired lock allows successful login and resets failedAttempts and lockedUntil", async () => {
    const password = "password123";
    const registered = await registerUser(app, {
      email: "lock-expired@example.com",
      password,
      clientType: "web",
    });

    for (let i = 0; i < 5; i++) {
      await request(app, {
        method: "POST",
        path: "/auth/login",
        body: {
          email: registered.user.email,
          password: "wrong-password",
        },
      });
    }

    await db
      .update(users)
      .set({ lockedUntil: new Date(Date.now() - 60_000) })
      .where(eq(users.email, registered.user.email));

    const response = await request(app, {
      method: "POST",
      path: "/auth/login",
      body: {
        email: registered.user.email,
        password,
      },
    });

    expect(response.status).toBe(200);

    const [userRow] = await db
      .select()
      .from(users)
      .where(eq(users.email, registered.user.email));

    expect(userRow.failedAttempts).toBe(0);
    expect(userRow.lockedUntil).toBeNull();
  });

  it("future lockedUntil causes 429 regardless of password correctness", async () => {
    const password = "password123";
    const registered = await registerUser(app, {
      email: "future-lock@example.com",
      password,
      clientType: "web",
    });

    await db
      .update(users)
      .set({ lockedUntil: new Date(Date.now() + 15 * 60 * 1000) })
      .where(eq(users.email, registered.user.email));

    const response = await request(app, {
      method: "POST",
      path: "/auth/login",
      body: {
        email: registered.user.email,
        password: "totally-wrong-password",
      },
    });

    expect(response.status).toBe(429);

    const body = response.body as { error: { code: string; message: string } };
    expect(body.error.code).toBe("ACCOUNT_LOCKED");
  });

  it("successful login after fewer than 5 failures resets failedAttempts and clears lockedUntil", async () => {
    const password = "password123";
    const registered = await registerUser(app, {
      email: "counter-reset@example.com",
      password,
      clientType: "web",
    });

    await db
      .update(users)
      .set({
        failedAttempts: 2,
        lockedUntil: new Date(Date.now() - 60_000),
      })
      .where(eq(users.email, registered.user.email));

    const response = await request(app, {
      method: "POST",
      path: "/auth/login",
      body: {
        email: registered.user.email,
        password,
      },
    });

    expect(response.status).toBe(200);

    const [userRow] = await db
      .select()
      .from(users)
      .where(eq(users.email, registered.user.email));

    expect(userRow.failedAttempts).toBe(0);
    expect(userRow.lockedUntil).toBeNull();
  });

  it("nonexistent user returns 401 with INVALID_CREDENTIALS", async () => {
    const response = await request(app, {
      method: "POST",
      path: "/auth/login",
      body: {
        email: "does-not-exist@example.com",
        password: "any-password",
      },
    });

    expect(response.status).toBe(401);

    const body = response.body as { error: { code: string; message: string } };
    expect(body.error.code).toBe("INVALID_CREDENTIALS");
  });
});
