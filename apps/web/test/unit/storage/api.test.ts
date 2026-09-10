import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

describe('Storage API Client Utilities', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
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
      const mockMetrics = {
        totalSizeBytes: 10000,
        limitSizeBytes: 50000000000,
        percentUsed: 0.02,
        totalFiles: 10,
        linkedFiles: 8,
        orphanedFiles: 2,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockMetrics,
      });

      const res = await fetchStorageMetrics();
      expect(res).toEqual(mockMetrics);
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/storage/metrics', expect.any(Object));
    });

    it('throws error when fetch fails', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        text: async () => 'Server error',
      });

      await expect(fetchStorageMetrics()).rejects.toThrow('Server error');
    });
  });

  describe('fetchStorageResources', () => {
    it('fetches resources with filter parameters', async () => {
      const mockResponse = {
        data: [
          {
            id: 'res-1',
            key: 'videos/ep1.mp4',
            filename: 'ep1.mp4',
            sizeBytes: 1024,
            lastModified: '2026-09-01',
            status: 'linked',
          },
        ],
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const res = await fetchStorageResources({ status: 'linked', search: 'ep1', sortBy: 'size', sortOrder: 'desc' });
      expect(res).toEqual(mockResponse);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/storage/resources?status=linked&search=ep1&sortBy=size&sortOrder=desc'),
        expect.any(Object)
      );
    });
  });

  describe('refreshStorageScan', () => {
    it('posts to scan endpoint to trigger rescan', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      const res = await refreshStorageScan();
      expect(res).toEqual({ success: true });
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/storage/scan', expect.objectContaining({ method: 'POST' }));
    });
  });

  describe('updateStorageLimit', () => {
    it('puts updated capacity limit', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ limitGb: 100 }),
      });

      const res = await updateStorageLimit(100);
      expect(res).toEqual({ limitGb: 100 });
      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/storage/limit',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ limitGb: 100 }),
        })
      );
    });
  });

  describe('updateSourceMetadata', () => {
    it('patches source label and quality', async () => {
      const mockUpdated = { id: 'src-1', label: 'Updated Label', quality: '1080p' };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockUpdated,
      });

      const res = await updateSourceMetadata('src-1', { label: 'Updated Label', quality: '1080p' });
      expect(res).toEqual(mockUpdated);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/storage/resources/src-1',
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

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'res-attached', ...input, status: 'linked' }),
      });

      const res = await attachOrphanFile(input);
      expect(res.status).toBe('linked');
      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/storage/resources/attach',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(input),
        })
      );
    });
  });

  describe('deleteStorageResources & purgeOrphanFiles', () => {
    it('sends keys array for batch deletion', async () => {
      const mockResponse = { deletedKeys: ['k1', 'k2'], reclaimedBytes: 2048 };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const res = await deleteStorageResources(['k1', 'k2']);
      expect(res).toEqual(mockResponse);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/storage/resources/delete',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ keys: ['k1', 'k2'] }),
        })
      );
    });

    it('triggers orphan purge endpoint', async () => {
      const mockResponse = { deletedKeys: ['orphan1'], reclaimedBytes: 1024 };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const res = await purgeOrphanFiles();
      expect(res).toEqual(mockResponse);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/storage/resources/purge-orphans',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('getStoragePreviewUrl', () => {
    it('fetches presigned playback URL for key', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ url: 'https://b2.s3.preview-url.com/video.mp4?token=123' }),
      });

      const url = await getStoragePreviewUrl('videos/video.mp4');
      expect(url).toBe('https://b2.s3.preview-url.com/video.mp4?token=123');
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/storage/resources/preview-url?key=videos%2Fvideo.mp4'),
        expect.any(Object)
      );
    });
  });
});
