import type { createApp } from "@/app";
import type { FetchFn } from "@/modules/media";

export type App = ReturnType<typeof createApp>;

export interface RequestOptions {
  method?: string;
  path: string;
  headers?: Record<string, string>;
  body?: object;
  cookies?: Record<string, string>;
}

export interface RequestResult {
  status: number;
  headers: Headers;
  body: unknown;
  cookies: Record<string, string>;
}

/**
 * Build a real `createApp` instance wired to the test database. Use this in
 * integration tests inside a `beforeAll` hook to share one Elysia instance per
 * test file.
 */
export async function buildApp(options?: {
  fetchHtml?: FetchFn;
}): Promise<App> {
  const { createApp } = await import("@/app");
  const { createAuthenticationService } = await import("@/modules/authentication");
  const { createDbClient } = await import("@repo/db");
  const { readFileSync } = await import("node:fs");
  const { resolve } = await import("node:path");

  const db = createDbClient(process.env.DATABASE_URL);
  const auth = createAuthenticationService(db);

  const defaultFetchHtml: FetchFn = {
    async get() {
      return readFileSync(
        resolve(import.meta.dirname, "../fixtures/series/sample-series-list.html"),
        "utf8"
      );
    },
    async post() {
      throw new Error("post() is not used in this test helper");
    },
  };

  return createApp({
    db,
    auth,
    fetchHtml: options?.fetchHtml ?? defaultFetchHtml,
  });
}

/**
 * Send a request through an Elysia app. Parses the JSON body and collects any
 * `Set-Cookie` headers into a `cookies` record.
 */
export async function request(
  app: App,
  options: RequestOptions
): Promise<RequestResult> {
  const url = new URL(options.path, "http://localhost");
  const headers = new Headers();

  if (options.body) {
    headers.set("Content-Type", "application/json");
  }

  if (options.headers) {
    for (const [key, value] of Object.entries(options.headers)) {
      headers.set(key, value);
    }
  }

  if (options.cookies) {
    const cookieHeader = Object.entries(options.cookies)
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
    headers.append("Cookie", cookieHeader);
  }

  const init: RequestInit = {
    method: options.method ?? "GET",
    headers,
  };

  if (options.body) {
    init.body = JSON.stringify(options.body);
  }

  const response = await app.handle(new Request(url.toString(), init));
  const cookies = parseSetCookieHeaders(response.headers);

  let body: unknown;
  const text = await response.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  return {
    status: response.status,
    headers: response.headers,
    body,
    cookies,
  };
}

/**
 * Extract a named cookie value from a `Set-Cookie` header string.
 */
export function extractCookie(
  setCookieHeader: string | null,
  name: string
): string | undefined {
  if (!setCookieHeader) {
    return undefined;
  }
  const match = setCookieHeader.match(new RegExp(`${name}=([^;]+)`));
  return match?.[1];
}

function parseSetCookieHeaders(headers: Headers): Record<string, string> {
  const cookies: Record<string, string> = {};
  const setCookie = headers.getSetCookie?.();

  if (!setCookie) {
    return cookies;
  }

  for (const raw of setCookie) {
    const [nameValue] = raw.split(";");
    const [name, value] = nameValue.split("=");
    if (name && value !== undefined) {
      cookies[name.trim()] = value.trim();
    }
  }

  return cookies;
}
