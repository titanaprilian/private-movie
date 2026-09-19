import { describe, expect, it } from 'vitest';
import { formatEmbedUrl } from '@/lib/media';

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

  it('transforms desustream.net URLs to /api/media/relay?url=...', () => {
    const url = 'https://desustream.net/embed/ep-1';
    expect(formatEmbedUrl(url)).toBe(
      `/api/media/relay?url=${encodeURIComponent(url)}`
    );
  });

  it('transforms onenesuhd.com URLs to /api/media/relay?url=...', () => {
    const url = 'https://onenesuhd.com/player/v1';
    expect(formatEmbedUrl(url)).toBe(
      `/api/media/relay?url=${encodeURIComponent(url)}`
    );
  });

  it('transforms odstream.net URLs to /api/media/relay?url=...', () => {
    const url = 'https://odstream.net/v/abc';
    expect(formatEmbedUrl(url)).toBe(
      `/api/media/relay?url=${encodeURIComponent(url)}`
    );
  });
});
