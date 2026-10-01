import { describe, expect, it, beforeAll } from "vitest";
import { buildApp, type App } from "../../utils/app";

const RECOGNIZED_TAGS = new Set([
  "Authentication",
  "Dashboard & Scheduler",
  "Series",
  "Seasons",
  "Episodes",
  "Genres",
  "Storage",
  "Media & Playback",
  "Health",
]);

interface OpenApiOperation {
  tags?: string[];
  summary?: string;
  description?: string;
}

interface OpenApiSpec {
  openapi: string;
  paths: Record<string, Record<string, OpenApiOperation>>;
}

async function fetchSpec(app: App): Promise<OpenApiSpec> {
  const response = await app.handle(new Request("http://localhost/docs/json"));
  expect(response.status).toBe(200);
  return (await response.json()) as OpenApiSpec;
}

describe("OpenAPI route tagging and internal route exclusion", () => {
  let app: App;
  let spec: OpenApiSpec;

  beforeAll(async () => {
    app = await buildApp();
    spec = await fetchSpec(app);
  });

  it("does not expose internal reverse-proxy routes", () => {
    const paths = Object.keys(spec.paths);

    for (const path of paths) {
      expect(
        path.includes("_app"),
        `internal route ${path} must be hidden from the spec`
      ).toBe(false);
      expect(
        path.includes("player"),
        `internal route ${path} must be hidden from the spec`
      ).toBe(false);
      // The embed sandbox (/embed/:hash) and its relay helpers are internal plumbing.
      expect(
        /(^|\/)embed/.test(path),
        `internal route ${path} must be hidden from the spec`
      ).toBe(false);
      expect(
        path.includes("proxy") || path.includes("relay"),
        `internal route ${path} must be hidden from the spec`
      ).toBe(false);
      expect(
        path.includes("debug-log") || path.includes("crypto-subtle"),
        `internal route ${path} must be hidden from the spec`
      ).toBe(false);
    }
  });

  it("assigns every exposed /api/* endpoint to a recognized domain tag", () => {
    const apiPaths = Object.entries(spec.paths).filter(([path]) =>
      path.startsWith("/api/")
    );
    expect(apiPaths.length).toBeGreaterThan(0);

    for (const [path, operations] of apiPaths) {
      for (const [method, operation] of Object.entries(operations)) {
        expect(
          Array.isArray(operation.tags) && operation.tags.length > 0,
          `${method.toUpperCase()} ${path} must declare at least one tag`
        ).toBe(true);
        for (const tag of operation.tags ?? []) {
          expect(
            RECOGNIZED_TAGS.has(tag),
            `${method.toUpperCase()} ${path} uses unrecognized tag "${tag}"`
          ).toBe(true);
        }
      }
    }
  });

  it("gives every exposed /api/* endpoint a non-empty summary", () => {
    const apiPaths = Object.entries(spec.paths).filter(([path]) =>
      path.startsWith("/api/")
    );
    expect(apiPaths.length).toBeGreaterThan(0);

    for (const [path, operations] of apiPaths) {
      for (const [method, operation] of Object.entries(operations)) {
        expect(
          typeof operation.summary === "string" &&
            operation.summary.trim().length > 0,
          `${method.toUpperCase()} ${path} must have a non-empty summary`
        ).toBe(true);
      }
    }
  });
});
