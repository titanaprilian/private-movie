import { createHmac, randomUUID } from "node:crypto";
import { request, type App } from "./app";

export interface AuthResult {
  user: {
    id: string;
    email: string;
    name?: string;
    createdAt: string;
  };
  accessToken: string;
  refreshToken: string;
  cookies: Record<string, string>;
}

export interface RegisterUserOptions {
  name?: string;
  email?: string;
  password?: string;
  clientType?: "web" | "mobile";
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignTestTokenOptions {
  expiresInSeconds?: number;
}

/**
 * Register a new user and return the parsed response, including the access
 * token and refresh token (from cookie for web, from body for mobile).
 */
export async function registerUser(
  app: App,
  overrides: RegisterUserOptions = {}
): Promise<AuthResult> {
  const payload = {
    name: overrides.name ?? "Test User",
    email: overrides.email ?? `user-${randomUUID()}@example.com`,
    password: overrides.password ?? "password123",
  };

  const response = await request(app, {
    method: "POST",
    path: "/api/auth/register",
    headers: overrides.clientType
      ? { "x-client-type": overrides.clientType }
      : undefined,
    body: payload,
  });

  if (response.status !== 200) {
    throw new Error(
      `registerUser failed with status ${response.status}: ${JSON.stringify(
        response.body
      )}`
    );
  }

  const data = response.body as {
    data: {
      user: AuthResult["user"];
      tokens: { accessToken: string; refreshToken: string };
    };
  };
  const refreshToken =
    overrides.clientType === "mobile"
      ? data.data.tokens.refreshToken
      : response.cookies.refreshToken ?? "";

  return {
    user: data.data.user,
    accessToken: data.data.tokens.accessToken,
    refreshToken,
    cookies: response.cookies,
  };
}

/**
 * Log in an existing user and return the parsed response, including the access
 * token and refresh token (from cookie for web, from body for mobile).
 */
export async function loginUser(
  app: App,
  creds: LoginCredentials,
  clientType: "web" | "mobile" = "web"
): Promise<AuthResult> {
  const response = await request(app, {
    method: "POST",
    path: "/api/auth/login",
    headers: clientType ? { "x-client-type": clientType } : undefined,
    body: creds,
  });

  if (response.status !== 200) {
    throw new Error(
      `loginUser failed with status ${response.status}: ${JSON.stringify(
        response.body
      )}`
    );
  }

  const data = response.body as {
    data: {
      user: AuthResult["user"];
      tokens: { accessToken: string; refreshToken: string };
    };
  };
  const refreshToken =
    clientType === "mobile"
      ? data.data.tokens.refreshToken
      : response.cookies.refreshToken ?? "";

  return {
    user: data.data.user,
    accessToken: data.data.tokens.accessToken,
    refreshToken,
    cookies: response.cookies,
  };
}

/**
 * Build an `Authorization` header for a bearer token.
 */
export function authHeaders(accessToken: string): Record<string, string> {
  return { Authorization: `Bearer ${accessToken}` };
}

/**
 * Sign a test JWT locally using the same HS256/HMAC implementation as the
 * application, reading `JWT_SECRET` from the environment. Useful for crafting
 * valid, expired, or tampered tokens in integration tests without importing
 * `internal/jwt.ts`.
 */
export function signTestToken(
  payload: object,
  options: SignTestTokenOptions = {}
): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not defined");
  }

  const header = { alg: "HS256", typ: "JWT" };
  const exp =
    Math.floor(Date.now() / 1000) + (options.expiresInSeconds ?? 15 * 60);

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString(
    "base64url"
  );
  const encodedPayload = Buffer.from(
    JSON.stringify({ ...payload, exp })
  ).toString("base64url");
  const signatureInput = `${encodedHeader}.${encodedPayload}`;
  const signature = createHmac("sha256", secret)
    .update(signatureInput)
    .digest("base64url");

  return `${signatureInput}.${signature}`;
}
