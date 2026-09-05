import { describe, expect, it } from 'vitest';
import { parseIngestUrl } from '@/modules/videos/internal/parseIngestUrl';

describe('parseIngestUrl utility', () => {
  it('handles empty or blank input gracefully', () => {
    expect(parseIngestUrl('')).toEqual({
      filename: '',
      quality: null,
      label: 'S3 Video',
    });
    expect(parseIngestUrl('   ')).toEqual({
      filename: '',
      quality: null,
      label: 'S3 Video',
    });
  });

  it('extracts filename and infers 1080p quality', () => {
    const res = parseIngestUrl('https://example.com/videos/Episode.01.1080p.mp4');
    expect(res.filename).toBe('Episode.01.1080p.mp4');
    expect(res.quality).toBe('1080p');
    expect(res.label).toBe('S3 1080p');
  });

  it('extracts filename and infers 720p quality', () => {
    const res = parseIngestUrl('https://stream.host.org/files/show_720.mkv');
    expect(res.filename).toBe('show_720.mkv');
    expect(res.quality).toBe('720p');
    expect(res.label).toBe('S3 720p');
  });

  it('extracts filename and infers 480p quality', () => {
    const res = parseIngestUrl('https://cdn.com/v/sample_480p.webm?token=xyz');
    expect(res.filename).toBe('sample_480p.webm');
    expect(res.quality).toBe('480p');
    expect(res.label).toBe('S3 480p');
  });

  it('extracts filename and infers 4k / 2160p quality', () => {
    const res = parseIngestUrl('https://cdn.com/movies/movie_4k.mp4');
    expect(res.filename).toBe('movie_4k.mp4');
    expect(res.quality).toBe('2160p');
    expect(res.label).toBe('S3 2160p');
  });

  it('defaults label to "S3 Video" when no resolution is found in URL', () => {
    const res = parseIngestUrl('https://example.com/stream/video.mp4');
    expect(res.filename).toBe('video.mp4');
    expect(res.quality).toBeNull();
    expect(res.label).toBe('S3 Video');
  });
});
