import { describe, expect, it, vi } from "vitest";
import { Elysia, t } from "elysia";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { corsPlugin } from "@/plugins/cors";
import { openapiPlugin } from "@/plugins/openapi";
import { errorHandlerPlugin } from "@/plugins/error-handler";
import {
  rateLimitPlugin,
  isUnthrottledRoute,
} from "@/plugins/rate-limit";
import { FileTooLargeError } from "@/lib/errors";

const testConfig = {
  allowedOrigins: ["https://example.com"],
  apiDocsEnabled: false,
  isDevelopment: false,
};

describe("corsPlugin", () => {
  it("reflects an allowlisted origin on preflight requests", async () => {
    const app = new Elysia()
      .use(corsPlugin(testConfig))
      .get("/ping", () => "pong");

    const response = await app.handle(
      new Request("http://localhost/ping", {
        method: "OPTIONS",
        headers: {
          Origin: "https://example.com",
          "Access-Control-Request-Method": "GET",
        },
      })
    );

    expect(response.headers.get("access-control-allow-origin")).toBe(
      "https://example.com"
    );
  });

  it("does not reflect an origin missing from the allowlist", async () => {
    const app = new Elysia()
      .use(corsPlugin(testConfig))
      .get("/ping", () => "pong");

    const response = await app.handle(
      new Request("http://localhost/ping", {
        method: "OPTIONS",
        headers: {
          Origin: "https://evil.example",
          "Access-Control-Request-Method": "GET",
        },
      })
    );

    expect(response.headers.get("access-control-allow-origin")).not.toBe(
      "https://evil.example"
    );
  });
});

describe("openapiPlugin", () => {
  it("passes requests through when disabled without registering docs routes", async () => {
    const app = new Elysia()
      .use(openapiPlugin({ enabled: false }))
      .get("/ping", () => "pong");

    const ping = await app.handle(new Request("http://localhost/ping"));
    expect(ping.status).toBe(200);
    expect(await ping.text()).toContain("pong");

    const docs = await app.handle(new Request("http://localhost/docs"));
    expect(docs.status).toBe(404);
  });

  it("serves the OpenAPI spec when enabled", async () => {
    const app = new Elysia()
      .use(openapiPlugin({ enabled: true }))
      .get("/ping", () => "pong");

    const response = await app.handle(
      new Request("http://localhost/docs/json")
    );
    expect(response.status).toBe(200);
  });
});

describe("errorHandlerPlugin", () => {
  it("maps validation errors to 400", async () => {
    const app = new Elysia()
      .use(errorHandlerPlugin())
      .post("/items", ({ body }) => body, {
        body: t.Object({ name: t.String() }),
      });

    const response = await app.handle(
      new Request("http://localhost/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: 42 }),
      })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: { code: "VALIDATION", message: "request validation failed" },
    });
  });

  it("maps domain errors to their status codes", async () => {
    const app = new Elysia().use(errorHandlerPlugin()).get("/big", () => {
      throw new FileTooLargeError();
    });

    const response = await app.handle(new Request("http://localhost/big"));
    expect(response.status).toBe(413);
    const body = (await response.json()) as {
      error: { code: string; message: string };
    };
    expect(body.error.code).toBe("FILE_TOO_LARGE");
  });

  it("maps unhandled errors to a logged 500 envelope", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const app = new Elysia().use(errorHandlerPlugin()).get("/boom", () => {
        throw new Error("kaboom");
      });

      const response = await app.handle(new Request("http://localhost/boom"));
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({
        error: { code: "INTERNAL_SERVER", message: "internal server error" },
      });
      expect(consoleSpy).toHaveBeenCalledWith(
        "[Unhandled Server Error]",
        expect.any(Error)
      );
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it("passes 404s through untouched", async () => {
    const app = new Elysia().use(errorHandlerPlugin());

    const response = await app.handle(
      new Request("http://localhost/nonexistent")
    );
    expect(response.status).toBe(404);
  });
});

describe("rateLimitPlugin", () => {
  it("skips media proxy, embed, and streaming chunk routes", () => {
    expect(
      isUnthrottledRoute(new Request("http://localhost/api/media/proxy/x"))
    ).toBe(true);
    expect(isUnthrottledRoute(new Request("http://localhost/embed/abc"))).toBe(
      true
    );
    expect(
      isUnthrottledRoute(
        new Request("http://localhost/api/episodes/123/sources/remote-ingest")
      )
    ).toBe(true);
    expect(isUnthrottledRoute(new Request("http://localhost/api/health"))).toBe(
      false
    );
  });

  it("throttles past the configured max with the rate-limit envelope", async () => {
    const app = new Elysia()
      .use(rateLimitPlugin({ max: 2, duration: 60000 }))
      .get("/ping", () => "pong");

    expect((await app.handle(new Request("http://localhost/ping"))).status).toBe(
      200
    );
    expect((await app.handle(new Request("http://localhost/ping"))).status).toBe(
      200
    );

    const blocked = await app.handle(new Request("http://localhost/ping"));
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toEqual({
      error: { code: "RATE_LIMIT", message: "rate-limit reached" },
    });
  });

  it("passes all requests through when disabled", async () => {
    const app = new Elysia()
      .use(rateLimitPlugin({ disabled: true }))
      .get("/ping", () => "pong");

    for (let i = 0; i < 5; i++) {
      const response = await app.handle(new Request("http://localhost/ping"));
      expect(response.status).toBe(200);
    }
  });

  it("honours a custom skip predicate", async () => {
    const app = new Elysia()
      .use(rateLimitPlugin({ max: 1, skip: () => true }))
      .get("/ping", () => "pong");

    for (let i = 0; i < 3; i++) {
      const response = await app.handle(new Request("http://localhost/ping"));
      expect(response.status).toBe(200);
    }
  });
});

describe("plugin chain", () => {
  it("chains all four plugins via .use() without breaking routes", async () => {
    const app = new Elysia()
      .use(openapiPlugin({ enabled: false }))
      .use(corsPlugin(testConfig))
      .use(errorHandlerPlugin())
      .use(rateLimitPlugin({ disabled: true }))
      .get("/ping", () => "pong");

    const response = await app.handle(
      new Request("http://localhost/ping", {
        headers: { Origin: "https://example.com" },
      })
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe(
      "https://example.com"
    );
  });
});

describe("production code contains no test hooks", () => {
  const pluginsDir = join(import.meta.dirname, "../../../src/plugins");
  const authHttp = join(
    import.meta.dirname,
    "../../../src/modules/authentication/http.ts"
  );

  it("has no NODE_ENV test checks or x-test-rate-limit headers in plugins or auth routes", () => {
    const files = readdirSync(pluginsDir)
      .filter((f) => f.endsWith(".ts"))
      .map((f) => join(pluginsDir, f));
    files.push(authHttp);

    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const content = readFileSync(file, "utf8");
      expect(content, file).not.toContain("x-test-rate-limit");
      expect(content, file).not.toContain("NODE_ENV");
    }
  });
});
