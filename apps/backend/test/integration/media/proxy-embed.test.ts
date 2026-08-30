import { describe, expect, it, beforeAll, afterEach, vi } from "vitest";
import { buildApp, request, type App } from "../../utils/app";

describe("GET /media/proxy-embed", () => {
  let app: App;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches embed html with spoofed referer and injects base tag", async () => {
    let capturedUrl = "";
    let capturedHeaders: Record<string, string> = {};

    vi.spyOn(global, "fetch").mockImplementation(async (input, init) => {
      capturedUrl = input.toString();
      capturedHeaders = (init?.headers as Record<string, string>) || {};
      return new Response(
        "<!DOCTYPE html><html><head><title>Bello Player</title></head><body><video></video></body></html>",
        {
          status: 200,
          headers: { "Content-Type": "text/html" },
        }
      );
    });

    const response = await request(app, {
      method: "GET",
      path: "/media/proxy-embed?url=https://videobello.net/e/abcd123",
    });

    expect(response.status).toBe(200);
    expect(capturedUrl).toBe("https://videobello.net/e/abcd123");
    expect(capturedHeaders["Referer"]).toBe("https://dramula.com");
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(response.body).toBe(
      '<!DOCTYPE html><html><head><base href="https://videobello.net/"><title>Bello Player</title></head><body><video></video></body></html>'
    );
  });

  it("returns 400 for invalid url parameter", async () => {
    const response = await request(app, {
      method: "GET",
      path: "/media/proxy-embed?url=not-a-valid-url",
    });

    expect(response.status).toBe(400);
  });
});
