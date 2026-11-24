import { describe, expect, it } from 'vitest';
import {
  inferLabelFromUrl,
  inferQualityFromUrl,
  inferSourceMetadata,
} from '@/modules/videos/internal/sources/utils/sourceUrlUtils';

describe('sourceUrlUtils', () => {
  describe('inferQualityFromUrl', () => {
    it('infers 720p quality from video URLs', () => {
      expect(
        inferQualityFromUrl(
          'https://cdn.odcloud.net/anime/Otakudesu.io_TINC--06_720p.mp4'
        )
      ).toBe('720p');
      expect(inferQualityFromUrl('https://example.com/video_720P.mp4')).toBe(
        '720p'
      );
      expect(inferQualityFromUrl('https://example.com/show.720p.mkv')).toBe(
        '720p'
      );
    });

    it('infers other standard resolutions (1080p, 480p, 360p, 1440p, 2160p, 4k)', () => {
      expect(
        inferQualityFromUrl(
          'https://archive.org/download/something/my_video_1080p.mp4'
        )
      ).toBe('1080p');
      expect(inferQualityFromUrl('https://example.com/sample_480p.webm')).toBe(
        '480p'
      );
      expect(inferQualityFromUrl('https://example.com/sample_360p.mp4')).toBe(
        '360p'
      );
      expect(inferQualityFromUrl('https://example.com/sample_1440p.mp4')).toBe(
        '1440p'
      );
      expect(inferQualityFromUrl('https://example.com/sample_2160p.mp4')).toBe(
        '2160p'
      );
      expect(inferQualityFromUrl('https://example.com/sample_4k.mp4')).toBe(
        '2160p'
      );
    });

    it('infers delimited resolution numbers without p suffix', () => {
      expect(inferQualityFromUrl('https://example.com/show_ep2_720.mkv')).toBe(
        '720p'
      );
      expect(inferQualityFromUrl('https://example.com/show.1080.mp4')).toBe(
        '1080p'
      );
    });

    it('returns null when no quality is present and prevents invalid numbers like 1', () => {
      expect(inferQualityFromUrl('https://example.com/video.mp4')).toBeNull();
      expect(inferQualityFromUrl('https://example.com/episodes/1')).toBeNull();
      expect(
        inferQualityFromUrl('https://example.com/season/1/ep/2')
      ).toBeNull();
      expect(inferQualityFromUrl('')).toBeNull();
      expect(inferQualityFromUrl('   ')).toBeNull();
    });
  });

  describe('inferLabelFromUrl', () => {
    it('infers clean label from direct video URL filename', () => {
      expect(
        inferLabelFromUrl(
          'https://cdn.odcloud.net/anime/Otakudesu.io_TINC--06_720p.mp4'
        )
      ).toBe('Otakudesu.io_TINC--06_720p');
      expect(
        inferLabelFromUrl(
          'https://archive.org/download/something/my_video_1080p.mp4'
        )
      ).toBe('my_video_1080p');
    });

    it('strips query parameters and hashes from label', () => {
      expect(
        inferLabelFromUrl(
          'https://cdn.odcloud.net/stream/bleach_1080p.mp4?token=secret123&expires=9999#preview'
        )
      ).toBe('bleach_1080p');
    });

    it('decodes URI-encoded filenames', () => {
      expect(
        inferLabelFromUrl(
          'https://example.com/files/Show%20Name%20-%2001%20%5B720p%5D.mp4'
        )
      ).toBe('Show Name - 01 [720p]');
    });

    it('handles relative paths and trailing slashes', () => {
      expect(inferLabelFromUrl('videos/anime/ep01_720p.mkv')).toBe('ep01_720p');
      expect(inferLabelFromUrl('https://archive.org/details/show-ep01/')).toBe(
        'show-ep01'
      );
    });

    it('returns empty string for empty input or root path', () => {
      expect(inferLabelFromUrl('')).toBe('');
      expect(inferLabelFromUrl('   ')).toBe('');
      expect(inferLabelFromUrl('https://example.com/')).toBe('');
    });
  });

  describe('inferSourceMetadata', () => {
    it('combines label and quality inference', () => {
      expect(
        inferSourceMetadata(
          'https://cdn.odcloud.net/anime/Otakudesu.io_TINC--06_720p.mp4'
        )
      ).toEqual({
        label: 'Otakudesu.io_TINC--06_720p',
        quality: '720p',
      });

      expect(
        inferSourceMetadata('https://example.com/path/plain_video.mp4')
      ).toEqual({
        label: 'plain_video',
        quality: null,
      });
    });
  });
});
