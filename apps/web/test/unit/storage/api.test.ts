import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchStorageMetrics,
  fetchStorageResources,
  refreshStorageScan,
  updateStorageLimit,
  updateSourceMetadata,
  attachOrphanFile,
  deleteStorageResources,
  purgeOrphanFiles,
  getStoragePreviewUrl,
  formatBytes,
} from '@/modules/storage/internal/api';
import { setAccessToken } from '@/lib/api';

describe('Storage API Client Utilities', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setAccessToken('test-token');
  });

  describe('formatBytes helper', () => {
    it('formats bytes correctly into human readable units', () => {
      expect(formatBytes(0)).toBe('0 B');
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(1048576)).toBe('1 MB');
      expect(formatBytes(1073741824)).toBe('1 GB');
      expect(formatBytes(53687091200)).toBe('50 GB');
    });
  });

  describe('fetchStorageMetrics', () => {
    it('fetches storage metrics successfully', async () => {
      const mockBackendMetrics = {
        totalBytes: 10000,
        limitBytes: 50000000000,
        percentUsed: 0.02,
        totalCount: 10,
        linkedCount: 8,
        orphanCount: 2,
      };

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ data: mockBackendMetrics }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const res = await fetchStorageMetrics();
      expect(res.totalSizeBytes).toBe(10000);
      expect(res.limitSizeBytes).toBe(50000000000);
      expect(res.percentUsed).toBe(0.02);
      expect(res.totalFiles).toBe(10);
      expect(res.linkedFiles).toBe(8);
      expect(res.orphanedFiles).toBe(2);
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/api/storage/metrics'),
        expect.any(Object)
      );
    });

    it('throws error when fetch fails', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ error: { message: 'Server error' } }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      await expect(fetchStorageMetrics()).rejects.toThrow('Server error');
    });
  });

  describe('fetchStorageResources', () => {
    it('fetches resources with filter parameters', async () => {
      const mockBackendResponse = {
        items: [
          {
            key: 'videos/ep1.mp4',
            filename: 'ep1.mp4',
            sizeBytes: 1024,
            lastModified: '2026-09-01T00:00:00.000Z',
            status: 'linked' as const,
            videoSourceId: 'src-1',
            label: 'Main 1080p',
            quality: '1080p',
            episodeId: 'ep-1',
            episodeTitle: 'Episode 1',
            episodeOrder: 1,
            seasonId: 'season-1',
            seasonNumber: 1,
            seasonTitle: 'Season 1',
            seriesId: 'series-1',
            seriesTitle: 'Series 1',
            isLoneSource: true,
          },
        ],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      };

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ data: mockBackendResponse }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const res = await fetchStorageResources({
        status: 'linked',
        search: 'ep1',
        sortBy: 'size',
        sortOrder: 'desc',
      });
      expect(res.data).toHaveLength(1);
      expect(res.data[0].key).toBe('videos/ep1.mp4');
      expect(res.data[0].status).toBe('linked');
      expect(res.data[0].episode?.title).toBe('Episode 1');
      expect(res.pagination.total).toBe(1);
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/api/storage/resources?status=linked&search=ep1&sortBy=size&sortOrder=desc'),
        expect.any(Object)
      );
    });
  });

  describe('refreshStorageScan', () => {
    it('posts to scan endpoint to trigger rescan', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ data: { count: 2, totalBytes: 3000 } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const res = await refreshStorageScan();
      expect(res).toEqual({ count: 2, totalBytes: 3000 });
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/api/storage/scan'),
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('updateStorageLimit', () => {
    it('puts updated capacity limit', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ data: { limitGb: 100, limitBytes: 100 * 1024 * 1024 * 1024 } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const res = await updateStorageLimit(100);
      expect(res.limitGb).toBe(100);
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/api/storage/limit'),
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ limitGb: 100 }),
        })
      );
    });
  });

  describe('updateSourceMetadata', () => {
    it('patches source label and quality', async () => {
      const mockUpdated = { id: 'src-1', label: 'Updated Label', quality: '1080p', episodeId: 'ep-1' };

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ data: mockUpdated }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const res = await updateSourceMetadata('src-1', { label: 'Updated Label', quality: '1080p' });
      expect(res.label).toBe('Updated Label');
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/api/storage/resources/src-1'),
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ label: 'Updated Label', quality: '1080p' }),
        })
      );
    });
  });

  describe('attachOrphanFile', () => {
    it('posts attachment payload to backend', async () => {
      const input = { key: 'orphans/video.mp4', episodeId: 'ep-123', label: 'S3 Main', quality: '1080p' };
      const mockBackendSource = {
        id: 'src-new',
        episodeId: 'ep-123',
        label: 'S3 Main',
        quality: '1080p',
        url: 'orphans/video.mp4',
        type: 's3',
      };

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ data: mockBackendSource }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const res = await attachOrphanFile(input);
      expect(res.id).toBe('src-new');
      expect(res.label).toBe('S3 Main');
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/api/storage/resources/attach'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(input),
        })
      );
    });
  });

  describe('deleteStorageResources & purgeOrphanFiles', () => {
    it('sends keys array for batch deletion', async () => {
      const mockResponse = { deletedKeys: ['k1', 'k2'], reclaimedBytes: 2048, deletedSourcesCount: 1 };

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ data: mockResponse }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const res = await deleteStorageResources(['k1', 'k2']);
      expect(res.deletedKeys).toEqual(['k1', 'k2']);
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/api/storage/resources/delete'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ keys: ['k1', 'k2'] }),
        })
      );
    });

    it('triggers orphan purge endpoint', async () => {
      const mockResponse = { deletedKeys: ['orphan1'], reclaimedBytes: 1024 };

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ data: mockResponse }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const res = await purgeOrphanFiles();
      expect(res.deletedKeys).toEqual(['orphan1']);
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/api/storage/resources/purge-orphans'),
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('getStoragePreviewUrl', () => {
    it('fetches presigned playback URL for key', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ data: { previewUrl: 'https://b2.s3.preview-url.com/video.mp4?token=123' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const url = await getStoragePreviewUrl('videos/video.mp4');
      expect(url).toBe('https://b2.s3.preview-url.com/video.mp4?token=123');
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/api/storage/resources/preview-url?key=videos/video.mp4'),
        expect.any(Object)
      );
    });
  });
});
