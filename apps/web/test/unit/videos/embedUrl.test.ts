import { describe, it, expect } from 'vitest';
import { formatEmbedUrl } from '@/modules/videos/internal/embedUrl';

describe('formatEmbedUrl', () => {
  describe('videobello.net URLs', () => {
    it('should extract hash and return /embed/{hash} for videobello URLs', () => {
      const url = 'https://videobello.net/embed/ZXBpc29kZS0xMjM';
      const result = formatEmbedUrl(url);
      expect(result).toBe('/embed/ZXBpc29kZS0xMjM');
    });

    it('should handle videobello URLs with query parameters', () => {
      const url = 'https://videobello.net/embed/abc123xyz?param=value';
      const result = formatEmbedUrl(url);
      expect(result).toBe('/embed/abc123xyz?param=value');
    });

    it('should handle videobello URLs with hash fragments', () => {
      const url = 'https://videobello.net/embed/test-hash#fragment';
      const result = formatEmbedUrl(url);
      expect(result).toBe('/embed/test-hash');
    });

    it('should handle videobello URLs with both query and fragment', () => {
      const url = 'https://videobello.net/embed/hash-123?foo=bar#baz';
      const result = formatEmbedUrl(url);
      expect(result).toBe('/embed/hash-123?foo=bar');
    });

    it('should fallback to old proxy behavior if hash extraction fails', () => {
      const url = 'https://videobello.net/some-other-path';
      const result = formatEmbedUrl(url);
      expect(result).toBe('/api/media/proxy-embed?url=' + encodeURIComponent(url));
    });

    it('should handle videobello URLs without protocol', () => {
      const url = 'videobello.net/embed/simple-hash';
      const result = formatEmbedUrl(url);
      expect(result).toBe('/embed/simple-hash');
    });
  });

  describe('direct video URLs', () => {
    it('should pass through direct MP4 URLs unchanged', () => {
      const url = 'https://cdn.example.com/video.mp4';
      const result = formatEmbedUrl(url);
      expect(result).toBe(url);
    });

    it('should pass through direct M3U8 URLs unchanged', () => {
      const url = 'https://streaming.example.com/playlist.m3u8';
      const result = formatEmbedUrl(url);
      expect(result).toBe(url);
    });

    it('should pass through other embed URLs unchanged', () => {
      const url = 'https://player.vimeo.com/video/123456';
      const result = formatEmbedUrl(url);
      expect(result).toBe(url);
    });
  });
});
