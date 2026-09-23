import { describe, expect, it, beforeAll, afterEach, vi } from "vitest";
import { buildApp, request, type App } from "../../utils/app";
import { RELAY_EMBED_REFERER } from "../../../src/modules/media";

describe("Reverse Proxy Route (/api/media/proxy/:domain/*)", () => {
  let app: App;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("handles HTML embed responses: sets base tag, shim, rewrites domain links, and injects ad suppression", async () => {
    let capturedUrl = "";
    let capturedHeaders: Record<string, string> = {};

    const sampleHtml = `<!DOCTYPE html>
<html>
<head>
  <title>Vidhide Embed</title>
  <script src="https://vidhidepro.com/assets/css.js"></script>
  <script src="https://tag.min.js?v=123"></script>
  <script src="https://daly2024.com/tracker.js"></script>
  <script src="https://effectivecpmnetwork.com/ads.js"></script>
  <script src="https://bvtpk.net/pop.js"></script>
  <script src="https://humeraldurezza.com/ad.js"></script>
  <script src="https://mc.yandex.ru/metrika/tag.js"></script>
  <script src="https://www.googletagmanager.com/gtag/js"></script>
  <script src="https://vidhidepro.com/player/app.js"></script>
</head>
<body>
  <div id="adbd">Ad banner</div>
  <div class="overdiv">Clickjack overlay</div>
  <a href="https://vidhidepro.com/download/file123">Download</a>
  <video src="/stream/master.m3u8"></video>
</body>
</html>`;

    vi.spyOn(global, "fetch").mockImplementation(async (input, init) => {
      capturedUrl = input.toString();
      capturedHeaders = (init?.headers as Record<string, string>) || {};
      return new Response(sampleHtml, {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    });

    const response = await request(app, {
      method: "GET",
      path: "/media/proxy/vidhidepro.com/v/abcd123?autoplay=1",
    });

    expect(response.status).toBe(200);
    expect(capturedUrl).toBe("https://vidhidepro.com/v/abcd123?autoplay=1");
    expect(capturedHeaders["Referer"]).toBe(RELAY_EMBED_REFERER);
    expect(capturedHeaders["User-Agent"]).toContain("Mozilla/5.0");
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(response.headers.get("access-control-allow-origin")).toBe("*");

    const html = response.body;

    // Base tag
    expect(html).toContain('<base href="/api/media/proxy/vidhidepro.com/">');

    // Shim content
    expect(html).toContain("Object.defineProperty(window, 'open'");
    expect(html).toContain("HTMLIFrameElement.prototype");
    expect(html).toContain("HTMLFormElement.prototype.submit");
    expect(html).toContain("window.top !== window.self");

    // Stripped ad scripts
    expect(html).not.toContain("css.js");
    expect(html).not.toContain("tag.min.js");
    expect(html).not.toContain("daly2024");
    expect(html).not.toContain("effectivecpmnetwork");
    expect(html).not.toContain("bvtpk");
    expect(html).not.toContain("humeraldurezza");
    expect(html).not.toContain("yandex");
    expect(html).not.toContain("googletagmanager");

    // Non-ad script preserved
    expect(html).toContain("player/app.js");

    // Link rewriting
    expect(html).toContain('href="/api/media/proxy/vidhidepro.com/download/file123"');

    // Vidhide anti-clickjack CSS injection
    expect(html).toContain("#adbd");
    expect(html).toContain(".overdiv");
  });

  it("sanitizes Filedon data-page JSON attribute in HTML responses", async () => {
    const filedonHtml = `<!DOCTYPE html>
<html>
<head><title>Filedon</title></head>
<body data-page='{"id":123,"ads_enabled":true,"ad_slots":{"header":"<script>bad()</script>"},"footer_script":"alert(1)","ads_on_embed":true,"title":"My Video"}'>
  <div id="player"></div>
</body>
</html>`;

    vi.spyOn(global, "fetch").mockImplementation(async () => {
      return new Response(filedonHtml, {
        status: 200,
        headers: { "Content-Type": "text/html" },
      });
    });

    const response = await request(app, {
      method: "GET",
      path: "/media/proxy/filedon.co/embed-xyz.html",
    });

    expect(response.status).toBe(200);
    const html = response.body;

    expect(html).toContain('<base href="/api/media/proxy/filedon.co/">');
    expect(html).toContain('"ads_enabled":false');
    expect(html).toContain('"ad_slots":{}');
    expect(html).toContain('"footer_script":""');
    expect(html).toContain('"ads_on_embed":false');
    expect(html).toContain('"title":"My Video"');
  });

  it("streams sub-resources (M3U8 / JS / video chunks) with CORS and essential headers", async () => {
    let capturedUrl = "";
    vi.spyOn(global, "fetch").mockImplementation(async (input) => {
      capturedUrl = input.toString();
      return new Response("#EXTM3U\n#EXT-X-VERSION:3\nchunk-0.ts", {
        status: 206,
        headers: {
          "Content-Type": "application/vnd.apple.mpegurl",
          "Content-Length": "38",
          "Content-Range": "bytes 0-37/38",
          "Accept-Ranges": "bytes",
        },
      });
    });

    const response = await request(app, {
      method: "GET",
      path: "/media/proxy/cdn.vidhidepro.com/hls/master.m3u8",
    });

    expect(response.status).toBe(206);
    expect(capturedUrl).toBe("https://cdn.vidhidepro.com/hls/master.m3u8");
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(response.headers.get("content-type")).toBe("application/vnd.apple.mpegurl");
    expect(response.headers.get("content-length")).toBe("38");
    expect(response.headers.get("content-range")).toBe("bytes 0-37/38");
    expect(response.headers.get("accept-ranges")).toBe("bytes");
    expect(response.body).toBe("#EXTM3U\n#EXT-X-VERSION:3\nchunk-0.ts");
  });

  it("handles upstream error responses properly", async () => {
    vi.spyOn(global, "fetch").mockImplementation(async () => {
      return new Response("Not Found", {
        status: 404,
        statusText: "Not Found",
      });
    });

    const response = await request(app, {
      method: "GET",
      path: "/media/proxy/vidhidepro.com/v/nonexistent",
    });

    expect(response.status).toBe(404);
  });
});
