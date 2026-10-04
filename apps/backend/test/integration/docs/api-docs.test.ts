import { describe, expect, it, beforeAll, afterEach } from "vitest";
import { isApiDocsEnabled } from "@/config/app-config";
import { buildApp, type App } from "../../utils/app";

async function fetchRaw(app: App, path: string): Promise<Response> {
  return app.handle(new Request(`http://localhost${path}`));
}

describe("API docs (Scalar) plugin", () => {
  let app: App;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterEach(() => {
    delete process.env.ENABLE_API_DOCS;
  });

  it("is enabled in non-production environments by default", () => {
    // .env.test sets NODE_ENV=test
    expect(isApiDocsEnabled()).toBe(true);
  });

  it("is disabled in production unless ENABLE_API_DOCS=true", async () => {
    const { isApiDocsEnabled: check } = await import("@/config/app-config");
    const originalNodeEnv = process.env.NODE_ENV;

    process.env.NODE_ENV = "production";
    try {
      delete process.env.ENABLE_API_DOCS;
      expect(check()).toBe(false);

      process.env.ENABLE_API_DOCS = "true";
      expect(check()).toBe(true);
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
      delete process.env.ENABLE_API_DOCS;
    }
  });

  it("serves the Scalar UI at /docs", async () => {
    const response = await fetchRaw(app, "/docs");

    expect(response.status).toBe(200);
    const contentType = response.headers.get("content-type") ?? "";
    expect(contentType).toContain("text/html");
    const html = await response.text();
    expect(html.toLowerCase()).toContain("scalar");
  });

  it("serves the OpenAPI JSON spec at /docs/json", async () => {
    const response = await fetchRaw(app, "/docs/json");

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      openapi: string;
      info: { title: string };
      paths: Record<string, unknown>;
    };
    expect(body.openapi).toMatch(/^3\./);
    expect(body.info?.title).toBeDefined();
    expect(body.paths).toBeDefined();
    expect(typeof body.paths).toBe("object");
  });

  it("omits documentation endpoints in production without the opt-in flag", async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    delete process.env.ENABLE_API_DOCS;
    try {
      const prodApp = await buildApp();
      expect((await fetchRaw(prodApp, "/docs")).status).toBe(404);
      expect((await fetchRaw(prodApp, "/docs/json")).status).toBe(404);
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it("serves documentation endpoints in production with ENABLE_API_DOCS=true", async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    process.env.ENABLE_API_DOCS = "true";
    try {
      const prodApp = await buildApp();
      expect((await fetchRaw(prodApp, "/docs")).status).toBe(200);
      expect((await fetchRaw(prodApp, "/docs/json")).status).toBe(200);
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
      delete process.env.ENABLE_API_DOCS;
    }
  });

  it("keeps the legacy /api/openapi.json contract endpoint intact", async () => {
    const response = await fetchRaw(app, "/api/openapi.json");

    expect(response.status).toBe(200);
    const body = (await response.json()) as { openapi: string };
    expect(body.openapi).toMatch(/^3\.1\./);
  });
});
