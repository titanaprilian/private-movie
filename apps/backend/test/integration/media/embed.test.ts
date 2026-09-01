import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import type { App } from '../../utils/app';
import { buildApp } from '../../utils/app';
import { truncateAll } from '../../utils/db';

describe('GET /embed/:hash', () => {
  let app: App;

  beforeAll(async () => {
    app = await buildApp();
  });

  beforeEach(async () => {
    await truncateAll();
  });

  it('should return HTML bootstrap document that registers service worker', async () => {
    const hash = 'test-video-hash-123';
    const response = await app.handle(
      new Request(`http://localhost:3000/embed/${hash}`)
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');

    const html = await response.text();

    // Verify the HTML contains service worker registration
    expect(html).toContain('/media-proxy-sw.js');
    expect(html).toContain('navigator.serviceWorker.register');

    // Verify it waits for service worker activation
    expect(html).toContain('clients.claim');

    // Verify it will fetch from proxy-embed endpoint
    expect(html).toContain('/api/media/proxy-embed');
    expect(html).toContain(hash);

    // Verify document.write usage for injecting HTML
    expect(html).toContain('document.write');
  });

  it('should handle different hash values', async () => {
    const hash = 'another-hash-xyz';
    const response = await app.handle(
      new Request(`http://localhost:3000/embed/${hash}`)
    );

    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain(hash);
  });

  it('should return proper HTML structure', async () => {
    const hash = 'video-123';
    const response = await app.handle(
      new Request(`http://localhost:3000/embed/${hash}`)
    );

    const html = await response.text();

    // Verify basic HTML structure
    expect(html).toMatch(/<!DOCTYPE html>/i);
    expect(html).toMatch(/<html/i);
    expect(html).toMatch(/<head/i);
    expect(html).toMatch(/<body/i);
  });

  it('should construct correct videobello.net/embed URL in fetch call', async () => {
    const hash = 'ZXBpc29kZS0xMjM';
    const response = await app.handle(
      new Request(`http://localhost:3000/embed/${hash}`)
    );

    expect(response.status).toBe(200);
    const html = await response.text();

    // Verify the URL includes /embed/ subpath
    expect(html).toContain('https://videobello.net/embed/');
    expect(html).toContain(`https://videobello.net/embed/${hash}`);
  });
});
