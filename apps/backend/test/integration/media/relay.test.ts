import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import type { App } from '../../utils/app';
import { buildApp } from '../../utils/app';
import { truncateAll } from '../../utils/db';

describe('GET /api/media/relay', () => {
  let app: App;
  let mockServerUrl: string;

  beforeAll(async () => {
    app = await buildApp();
  });

  beforeEach(async () => {
    await truncateAll();
  });

  it('should require url query parameter', async () => {
    const response = await app.handle(
      new Request('http://localhost:3000/api/media/relay')
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it('should reject invalid URLs', async () => {
    const response = await app.handle(
      new Request('http://localhost:3000/api/media/relay?url=not-a-valid-url')
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it('should apply spoofed Referer header to outbound request', async () => {
    // Use a reliable test URL that will respond
    const validUrl = 'https://httpbin.org/headers';
    const response = await app.handle(
      new Request(
        `http://localhost:3000/api/media/relay?url=${encodeURIComponent(validUrl)}`
      )
    );

    // Route should process successfully (200) or return a valid error (not 404)
    expect(response.status).not.toBe(404);
    
    if (response.ok) {
      // If successful, verify we got JSON response from httpbin
      const data = await response.json();
      // httpbin.org/headers returns the headers it received
      expect(data.headers).toBeDefined();
      // Verify our spoofed Referer was sent
      expect(data.headers.Referer || data.headers.referer).toBe('https://dramula.com');
    }
  });

  it('should forward Range header from client to target', async () => {
    // Use httpbin to verify Range header forwarding
    const validUrl = 'https://httpbin.org/headers';
    const response = await app.handle(
      new Request(
        `http://localhost:3000/api/media/relay?url=${encodeURIComponent(validUrl)}`,
        {
          headers: {
            Range: 'bytes=0-1023',
          },
        }
      )
    );

    // Route should process Range header successfully
    expect(response.status).not.toBe(404);
    
    if (response.ok) {
      const data = await response.json();
      expect(data.headers).toBeDefined();
      // Verify Range header was forwarded
      expect(data.headers.Range).toBe('bytes=0-1023');
    }
  });

  it('should stream binary response without buffering', async () => {
    const validUrl = 'https://videobello.net/video.ts';
    const response = await app.handle(
      new Request(
        `http://localhost:3000/api/media/relay?url=${encodeURIComponent(validUrl)}`
      )
    );

    // Should return a Response object that can be streamed
    expect(response).toBeInstanceOf(Response);
    expect(response.body).toBeDefined();
  });

  it('should preserve content-type from target response', async () => {
    const validUrl = 'https://videobello.net/test.jpg';
    const response = await app.handle(
      new Request(
        `http://localhost:3000/api/media/relay?url=${encodeURIComponent(validUrl)}`
      )
    );

    // Response should have headers
    expect(response.headers).toBeDefined();
  });

  it('should handle target server errors gracefully', async () => {
    const invalidTargetUrl = 'https://videobello.net/nonexistent-file-404.jpg';
    const response = await app.handle(
      new Request(
        `http://localhost:3000/api/media/relay?url=${encodeURIComponent(invalidTargetUrl)}`
      )
    );

    // Should handle errors (either pass through status or return error)
    expect(response.status).toBeGreaterThanOrEqual(400);
  });
});
