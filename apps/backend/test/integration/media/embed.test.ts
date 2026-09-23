import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import type { App } from '../../utils/app';
import { buildApp } from '../../utils/app';
import { truncateAll } from '../../utils/db';

const UPSTREAM_HTML =
  '<!DOCTYPE html><html><head><title>Bello Player</title></head><body><video src="https://skylayer64.online/v/playlist.m3u8"></video></body></html>';

function mockUpstream(html = UPSTREAM_HTML, ok = true) {
  return vi.spyOn(global, "fetch").mockImplementation(async (input) => {
    void input;
    return new Response(html, {
      status: ok ? 200 : 500,
      statusText: ok ? "OK" : "Error",
      headers: { "Content-Type": "text/html" },
    });
  });
}

describe('GET /embed/:hash', () => {
  let app: App;

  beforeAll(async () => {
    app = await buildApp();
  });

  beforeEach(async () => {
    await truncateAll();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return a complete server-rendered player document without service worker registration', async () => {
    mockUpstream();
    const hash = 'test-video-hash-123';
    const response = await app.handle(
      new Request(`http://localhost:3000/embed/${hash}`)
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');

    const html = await response.text();

    // Upstream player content is inlined server-side
    expect(html).toContain('Bello Player');
    // No client-side service worker registration bootstrap or document replacement
    // (embed-scope deregistration cleanup is expected — see pm-sw-cleanup test)
    expect(html).not.toContain('serviceWorker.register');
    expect(html).not.toContain('/media-proxy-sw.js');
    expect(html).not.toContain('document.write');
  });

  it('should fetch upstream with provider referer and forward query params', async () => {
    let capturedUrl = "";
    let capturedHeaders: Record<string, string> = {};
    vi.spyOn(global, "fetch").mockImplementation(async (input, init) => {
      capturedUrl = input.toString();
      capturedHeaders = (init?.headers as Record<string, string>) || {};
      return new Response(UPSTREAM_HTML, {
        status: 200,
        headers: { "Content-Type": "text/html" },
      });
    });

    const response = await app.handle(
      new Request(`http://localhost:3000/embed/abc123?foo=bar`)
    );

    expect(response.status).toBe(200);
    expect(capturedUrl).toBe('https://videobello.net/embed/abc123?foo=bar');
    expect(capturedHeaders["Referer"]).toBe("https://dramula.com");
    expect(capturedHeaders["User-Agent"]).toContain("Mozilla/5.0");
  });

  it('should inject base tag, relay interceptor shim, and ad-suppression shim', async () => {
    mockUpstream();
    const response = await app.handle(
      new Request(`http://localhost:3000/embed/video-123`)
    );

    const html = await response.text();

    expect(html).toContain('<base href="/api/media/proxy/videobello.net/embed/">');
    expect(html).toContain('pm-relay-interceptor');
    expect(html).toContain('/api/media/relay?url=');
    expect(html).toContain('XMLHttpRequest');
    // Ad-suppression shim still present
    expect(html).toContain("Object.defineProperty(window, 'open'");
  });

  it('should enforce mobile-friendly video attributes', async () => {
    mockUpstream();
    const response = await app.handle(
      new Request(`http://localhost:3000/embed/video-123`)
    );

    const html = await response.text();

    expect(html).toContain('playsinline');
    expect(html).toContain('webkit-playsinline');
    expect(html).toContain('pm-mobile-video');
  });

  it('should accept real Dramula hashes with dots, colons, and base64 padding', async () => {
    let capturedUrl = "";
    vi.spyOn(global, "fetch").mockImplementation(async (input) => {
      capturedUrl = input.toString();
      return new Response(UPSTREAM_HTML, {
        status: 200,
        headers: { "Content-Type": "text/html" },
      });
    });

    for (const hash of [
      'ZXBpc29kZToxMDM4Nw.bf0e5daa',
      'ZXBpc29kZToxMDM4Nw.00000000',
      'ZXBpc29kZS0xMjM=',
    ]) {
      const response = await app.handle(
        new Request(`http://localhost:3000/embed/${hash}`)
      );

      expect(response.status).toBe(200);
      expect(capturedUrl).toBe(`https://videobello.net/embed/${hash}`);
    }
  });

  it('should absolutize relative player URLs before deciding to intercept', async () => {
    mockUpstream();
    const response = await app.handle(
      new Request(`http://localhost:3000/embed/video-123`)
    );

    const html = await response.text();

    // Relative HLS/JWPlayer paths must be resolved against document.baseURI
    // before host matching, or they bypass the relay and 403.
    expect(html).toContain('var abs = absolutize(url);');
    expect(html).toContain('if (!shouldIntercept(abs))');
  });

  it('should root relay requests to the local origin instead of the base tag host', async () => {
    mockUpstream();
    const response = await app.handle(
      new Request(`http://localhost:3000/embed/video-123`)
    );

    const html = await response.text();

    // A bare relative relay path would inherit <base href="https://videobello.net/">
    // and 404 on the provider host; the shim must prefix window.location.origin.
    expect(html).toContain('window.location.origin');
    expect(html).toContain("window.location.origin + '/api/media/relay?url='");
  });

  it('should strictly ignore relay route paths before inspecting domain fragments', async () => {
    mockUpstream();
    const response = await app.handle(
      new Request(`http://localhost:3000/embed/video-123`)
    );

    const html = await response.text();

    expect(html).toContain("url.indexOf('/api/media/relay') !== -1) return false");
  });

  it('should proactively deregister legacy embed-scope service workers', async () => {
    mockUpstream();
    const response = await app.handle(
      new Request(`http://localhost:3000/embed/video-123`)
    );

    const html = await response.text();

    expect(html).toContain('pm-sw-cleanup');
    expect(html).toContain('getRegistrations');
    expect(html).toContain('unregister');
    expect(html).toContain('/embed/');
    // Cleanup must never register a new worker.
    expect(html).not.toContain('serviceWorker.register');
  });

  it('should return a user-friendly error document on upstream failure', async () => {
    mockUpstream("", false);
    const response = await app.handle(
      new Request(`http://localhost:3000/embed/video-123`)
    );

    expect(response.status).toBe(502);
    expect(response.headers.get('content-type')).toContain('text/html');
    const html = await response.text();
    expect(html).toContain('Could not load the video player');
    expect(html).not.toContain('serviceWorker');
  });

  it('should return a user-friendly error document on fetch rejection', async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("network down"));
    const response = await app.handle(
      new Request(`http://localhost:3000/embed/video-123`)
    );

    expect(response.status).toBe(502);
    const html = await response.text();
    expect(html).toContain('Could not load the video player');
  });

  it('should reject invalid hashes with a user-friendly error', async () => {
    const spy = mockUpstream();
    const response = await app.handle(
      new Request(`http://localhost:3000/embed/invalid%20hash!`)
    );

    expect(response.status).toBe(400);
    const html = await response.text();
    expect(html).toContain('currently unavailable');
    expect(spy).not.toHaveBeenCalled();
  });

  it('should rewrite root-relative SvelteKit bundles and player assets through the proxy', async () => {
    mockUpstream(
      '<!DOCTYPE html><html><head>' +
        '<link rel="modulepreload" href="/_app/immutable/start.CBwQ8d0s.js">' +
        '<link rel="stylesheet" href="/_app/immutable/app.css">' +
        '<script type="module" src="/_app/immutable/entry/start.js"></script>' +
        '<script src="/player/jwplayer.js"></script>' +
        '</head><body><div id="app"></div></body></html>'
    );
    const response = await app.handle(
      new Request(`http://localhost:3000/embed/video-123`)
    );

    const html = await response.text();

    expect(response.status).toBe(200);
    // Same-origin proxy base routes relative chunk imports through backend
    expect(html).toContain('<base href="/api/media/proxy/videobello.net/embed/">');
    expect(html).not.toContain('<base href="https://videobello.net/">');
    // Root-relative entry bundles / preloaded assets rewritten to proxy
    expect(html).toContain('href="/api/media/proxy/videobello.net/_app/immutable/start.CBwQ8d0s.js"');
    expect(html).toContain('href="/api/media/proxy/videobello.net/_app/immutable/app.css"');
    expect(html).toContain('src="/api/media/proxy/videobello.net/_app/immutable/entry/start.js"');
    expect(html).toContain('src="/api/media/proxy/videobello.net/player/jwplayer.js"');
    // No bare cross-origin root-relative module URLs remain
    expect(html).not.toContain('href="/_app/');
    expect(html).not.toContain('src="/_app/');
  });

  it('should route player /api/embed calls to the same-origin proxy', async () => {
    mockUpstream();
    const response = await app.handle(
      new Request(`http://localhost:3000/embed/video-123`)
    );

    const html = await response.text();

    expect(html).toContain("urlStr === '/api/embed'");
    expect(html).toContain("toProxy(urlStr)");
  });

  it('should never route proxied assets to the relay interceptor', async () => {
    mockUpstream();
    const response = await app.handle(
      new Request(`http://localhost:3000/embed/video-123`)
    );

    const html = await response.text();

    expect(html).toContain("url.indexOf('/api/media/proxy/') !== -1) return false");
  });

  it('should contain the ad-suppression script shim', async () => {
    mockUpstream();
    const response = await app.handle(
      new Request(`http://localhost:3000/embed/test-video-hash-123`)
    );

    expect(response.status).toBe(200);
    const html = await response.text();

    expect(html).toContain("Object.defineProperty(window, 'open'");
    expect(html).toContain('focus: function()');
    expect(html).toContain('blur: function()');
    expect(html).toContain('close: function()');
    expect(html).toContain('closed: true');
    expect(html).toContain("HTMLAnchorElement.prototype.click");
    expect(html).toContain("['click', 'auxclick', 'touchend']");
    expect(html).toContain("target.getAttribute('target') === '_blank'");
    expect(html).toContain('e.preventDefault()');
    expect(html).toContain('e.stopPropagation()');
  });
});
