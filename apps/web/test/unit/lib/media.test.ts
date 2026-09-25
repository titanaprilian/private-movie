import { describe, expect, it } from 'vitest';
import {
  BELLOCLOUD_IFRAME_SANDBOX,
  formatEmbedUrl,
  getEmbedIframeSandbox,
  isBelloCloudEmbedUrl,
} from '@/lib/media';

describe('formatEmbedUrl', () => {
  it('passes through direct video URLs unchanged', () => {
    const url = 'https://s3.example.com/videos/episode-1.mp4';
    expect(formatEmbedUrl(url)).toBe(url);
  });

  it('transforms videobello.net embed URLs to use /embed/{hash} sandbox route', () => {
    const url = 'https://videobello.net/embed/ZXBpc29kZS0xMjM=';
    expect(formatEmbedUrl(url)).toBe('/embed/ZXBpc29kZS0xMjM=');
  });

  it('preserves query parameters when transforming videobello.net embed URLs', () => {
    const url = 'https://videobello.net/embed/ZXBpc29kZS0xMjM=?autoplay=1&muted=1';
    expect(formatEmbedUrl(url)).toBe('/embed/ZXBpc29kZS0xMjM=?autoplay=1&muted=1');
  });

  it('falls back to proxy-embed when videobello.net URL has no hash', () => {
    const url = 'https://videobello.net/watch/123';
    expect(formatEmbedUrl(url)).toBe(
      `/api/media/proxy-embed?url=${encodeURIComponent(url)}`
    );
  });

  it('transforms vidhide provider URLs to /api/media/proxy/:domain/*', () => {
    const url = 'https://vidhidepro.com/embed/abc123xyz?auto=1';
    expect(formatEmbedUrl(url)).toBe(
      '/api/media/proxy/vidhidepro.com/embed/abc123xyz?auto=1'
    );
  });

  it('transforms filedon provider URLs to /api/media/proxy/:domain/*', () => {
    const url = 'https://filedon.co/v/xyz987';
    expect(formatEmbedUrl(url)).toBe(
      '/api/media/proxy/filedon.co/v/xyz987'
    );
  });

  it('transforms desustream.net URLs to /api/media/proxy/:domain/*', () => {
    const url = 'https://desustream.net/embed/ep-1';
    expect(formatEmbedUrl(url)).toBe(
      '/api/media/proxy/desustream.net/embed/ep-1'
    );
  });

  it('retains subpaths and query parameters for desustream.net URLs', () => {
    const url = 'https://desustream.net/embed/sub/ep-1?autoplay=1&muted=1';
    expect(formatEmbedUrl(url)).toBe(
      '/api/media/proxy/desustream.net/embed/sub/ep-1?autoplay=1&muted=1'
    );
  });

  it('transforms onenesuhd.com URLs to /api/media/relay?url=...', () => {
    const url = 'https://onenesuhd.com/player/v1';
    expect(formatEmbedUrl(url)).toBe(
      `/api/media/relay?url=${encodeURIComponent(url)}`
    );
  });

  it('transforms odstream.net URLs to /api/media/proxy/:domain/*', () => {
    const url = 'https://odstream.net/v/abc';
    expect(formatEmbedUrl(url)).toBe(
      '/api/media/proxy/odstream.net/v/abc'
    );
  });

  it('retains subpaths and query parameters for odstream.net URLs', () => {
    const url = 'https://odstream.net/e/sub/abc?autoplay=1';
    expect(formatEmbedUrl(url)).toBe(
      '/api/media/proxy/odstream.net/e/sub/abc?autoplay=1'
    );
  });
});

describe('isBelloCloudEmbedUrl', () => {
  it('detects videobello.net embed URLs', () => {
    expect(
      isBelloCloudEmbedUrl('https://videobello.net/embed/ZXBpc29kZTE')
    ).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(
      isBelloCloudEmbedUrl('https://VIDEOBELLO.NET/embed/abc')
    ).toBe(true);
  });

  it('returns false for other providers', () => {
    expect(isBelloCloudEmbedUrl('https://odvidhide.com/v/abcd1234')).toBe(
      false
    );
    expect(isBelloCloudEmbedUrl('https://filedon.co/v/xyz987')).toBe(false);
    expect(isBelloCloudEmbedUrl('https://embed.com/3')).toBe(false);
    expect(isBelloCloudEmbedUrl('')).toBe(false);
  });
});

describe('getEmbedIframeSandbox', () => {
  it('returns the restrictive sandbox for BelloCloud embeds', () => {
    expect(
      getEmbedIframeSandbox('https://videobello.net/embed/ZXBpc29kZTE')
    ).toBe(BELLOCLOUD_IFRAME_SANDBOX);
  });

  it('omits allow-popups and allow-top-navigation', () => {
    expect(BELLOCLOUD_IFRAME_SANDBOX).not.toContain('allow-popups');
    expect(BELLOCLOUD_IFRAME_SANDBOX).not.toContain('allow-top-navigation');
    expect(BELLOCLOUD_IFRAME_SANDBOX).toContain('allow-scripts');
    expect(BELLOCLOUD_IFRAME_SANDBOX).toContain('allow-same-origin');
  });

  it('returns undefined for non-BelloCloud providers', () => {
    expect(
      getEmbedIframeSandbox('https://odvidhide.com/v/abcd1234')
    ).toBeUndefined();
    expect(getEmbedIframeSandbox('https://filedon.co/v/xyz987')).toBeUndefined();
    expect(getEmbedIframeSandbox('https://embed.com/3')).toBeUndefined();
  });
});
