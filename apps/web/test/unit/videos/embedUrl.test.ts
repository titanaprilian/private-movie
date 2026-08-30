import { describe, expect, it } from 'vitest';
import { formatEmbedUrl } from '../../../src/modules/videos/internal/embedUrl';

describe('formatEmbedUrl', () => {
  it('wraps videobello.net URLs with backend proxy endpoint', () => {
    const original = 'https://videobello.net/e/abcd123';
    const result = formatEmbedUrl(original);
    expect(result).toBe('/api/media/proxy-embed?url=https%3A%2F%2Fvideobello.net%2Fe%2Fabcd123');
  });

  it('returns original URL for non-videobello URLs', () => {
    const original = 'https://embed.com/dm-01';
    const result = formatEmbedUrl(original);
    expect(result).toBe(original);
  });
});
