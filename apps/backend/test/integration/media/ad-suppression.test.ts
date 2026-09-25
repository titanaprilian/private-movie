import { describe, expect, it, beforeAll, afterEach, vi } from "vitest";
import { buildApp, request, type App } from "../../utils/app";

describe("Ad suppression proxy no-op", () => {
  let app: App;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 204 no-op for /cdn/runtime.js through domain proxy without upstream fetch", async () => {
    const spy = vi.spyOn(global, "fetch").mockImplementation(async () => {
      throw new Error("upstream should not be called");
    });
    const response = await request(app, {
      method: "GET",
      path: "/media/proxy/videobello.net/cdn/runtime.js?v=1",
    });
    expect(response.status).toBe(204);
    expect(spy).not.toHaveBeenCalled();
  });

  it("returns 204 no-op for known ad network endpoints via relay", async () => {
    const spy = vi.spyOn(global, "fetch").mockImplementation(async () => {
      throw new Error("upstream should not be called");
    });
    const response = await request(app, {
      method: "GET",
      path: "/media/relay?url=https%3A%2F%2Fdaly2024.com%2Ftracker.js",
    });
    expect(response.status).toBe(204);
    expect(spy).not.toHaveBeenCalled();
  });

  it("server-rendered embed strips runtime scripts and injects clickjack CSS + hardened shim", async () => {
    const upstreamHtml = `<html><head><script src="/cdn/runtime.js"></script><script src="/_app/main.js"></script></head><body><video src="x"></video></body></html>`;
    vi.spyOn(global, "fetch").mockImplementation(async () => {
      return new Response(upstreamHtml, {
        status: 200,
        headers: { "Content-Type": "text/html" },
      });
    });
    const response = await app.handle(
      new Request("http://localhost:3000/embed/abc123")
    );
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).not.toContain("/cdn/runtime.js");
    expect(html).toContain("pm-anti-clickjack");
    expect(html).toContain("shopee:");
    expect(html).toContain("isTrusted");
  });
});
