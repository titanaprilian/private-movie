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

  it("fetches embed html with spoofed referer, modern user-agent, and injects base tag", async () => {
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
    expect(capturedHeaders["User-Agent"]).toContain("Mozilla/5.0");
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(response.body).toContain('<base href="https://videobello.net/">');
    expect(response.body).toContain("Object.defineProperty(window, 'open'");
    expect(response.body).toContain("document.addEventListener(eventType, handleBlankLink, true)");
  });

  it("injects hardened ad suppression script shim into <head>", async () => {
    vi.spyOn(global, "fetch").mockImplementation(async () => {
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
    // window.open lockdown and mock Window properties
    expect(response.body).toContain("Object.defineProperty(window, 'open'");
    expect(response.body).toContain("writable: false");
    expect(response.body).toContain("configurable: false");
    expect(response.body).toContain("focus: function() {}");
    expect(response.body).toContain("blur: function() {}");
    expect(response.body).toContain("close: function() {}");
    expect(response.body).toContain("closed: true");
    expect(response.body).toContain("document: {}");
    expect(response.body).toContain("location: { href: '' }");

    // Programmatic .click() intercept on blank targets
    expect(response.body).toContain("HTMLAnchorElement.prototype.click");
    expect(response.body).toContain("this.getAttribute('target') === '_blank'");

    // Capturing phase event listeners on document
    expect(response.body).toContain("['click', 'auxclick', 'touchend']");
    expect(response.body).toContain("e.preventDefault()");
    expect(response.body).toContain("e.stopPropagation()");
    expect(response.body).toContain("e.stopImmediatePropagation()");

    // Frame-busting / unload protection
    expect(response.body).toContain("window.top !== window.self");
  });

  it("returns 400 for invalid url parameter", async () => {
    const response = await request(app, {
      method: "GET",
      path: "/media/proxy-embed?url=not-a-valid-url",
    });

    expect(response.status).toBe(400);
  });
});
