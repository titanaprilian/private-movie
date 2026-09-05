import { describe, expect, it } from 'vitest';
import { parseIngestUrl, detectEpisodeNumber, formatBytes } from '@/modules/videos/internal/parseIngestUrl';

describe('parseIngestUrl utility', () => {
  it('handles empty or blank input gracefully', () => {
    expect(parseIngestUrl('')).toEqual({
      filename: '',
      quality: null,
      label: 'S3 Video',
      detectedEpisodeNumber: null,
    });
    expect(parseIngestUrl('   ')).toEqual({
      filename: '',
      quality: null,
      label: 'S3 Video',
      detectedEpisodeNumber: null,
    });
  });

  it('extracts filename and infers 1080p quality & episode number', () => {
    const res = parseIngestUrl('https://example.com/videos/Episode.01.1080p.mp4');
    expect(res.filename).toBe('Episode.01.1080p.mp4');
    expect(res.quality).toBe('1080p');
    expect(res.label).toBe('S3 1080p');
    expect(res.detectedEpisodeNumber).toBe(1);
  });

  it('extracts filename and infers 720p quality & ep pattern', () => {
    const res = parseIngestUrl('https://stream.host.org/files/show_ep2_720.mkv');
    expect(res.filename).toBe('show_ep2_720.mkv');
    expect(res.quality).toBe('720p');
    expect(res.label).toBe('S3 720p');
    expect(res.detectedEpisodeNumber).toBe(2);
  });

  it('extracts filename and infers 480p quality', () => {
    const res = parseIngestUrl('https://cdn.com/v/sample_480p.webm?token=xyz');
    expect(res.filename).toBe('sample_480p.webm');
    expect(res.quality).toBe('480p');
    expect(res.label).toBe('S3 480p');
    expect(res.detectedEpisodeNumber).toBeNull();
  });

  it('detects episode numbers across various common patterns', () => {
    expect(detectEpisodeNumber('https://cdn.com/Teach.You.a.Lesson.E03.720.mp4')).toBe(3);
    expect(detectEpisodeNumber('https://cdn.com/anime-ep2-1080p.mp4')).toBe(2);
    expect(detectEpisodeNumber('https://cdn.com/show_episode-03.mkv')).toBe(3);
    expect(detectEpisodeNumber('https://cdn.com/series.s01e12.mp4')).toBe(12);
    expect(detectEpisodeNumber('https://cdn.com/series_05_720p.mp4')).toBe(5);
    expect(detectEpisodeNumber('https://cdn.com/hash12345.mp4')).toBeNull();
  });

  it('formats bytes properly', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(280 * 1024 * 1024)).toBe('280 MB');
    expect(formatBytes(540 * 1024 * 1024)).toBe('540 MB');
  });
});
