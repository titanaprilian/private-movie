import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchStorageMetrics,
  fetchStorageResources,
  fetchStorageSeries,
  refreshStorageScan,
  updateStorageLimit,
  updateSourceMetadata,
  attachOrphanFile,
  deleteStorageResources,
  purgeOrphanFiles,
  getStoragePreviewUrl,
  fetchStorageProviders,
  createStorageProvider,
  updateStorageProvider,
  deleteStorageProvider,
  testStorageProviderConnection,
  fetchMinioStatus,
  spinMinioUp,
  resolveMinioStatusState,
  deriveMinioEndpoint,
  generateMinioSecret,
  formatBytes,
  formatDualBytes,
} from '@/modules/storage/internal/api';
import { setAccessToken } from '@/lib/api';

describe('Storage API Client Utilities', () => {
  const mockProvider = {
    id: 'prov-1',
    name: 'Primary S3',
    providerType: 'custom' as const,
    endpoint: 'https://s3.example.com',
    region: 'us-east-1',
    bucket: 'test-bucket',
    accessKeyIdMasked: '••••key',
    publicBaseUrl: null,
    forcePathStyle: false,
    storageLimitGb: 100,
    isDefault: true,
    isEnabled: true,
    linkedSourcesCount: 2,
    hasCredentials: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    setAccessToken('test-token');
  });

  describe('formatBytes helper', () => {
    it('formats binary bytes (GiB / MiB / KiB, base-1024) by default', () => {
      expect(formatBytes(0)).toBe('0 B');
      expect(formatBytes(1024)).toBe('1 KiB');
      expect(formatBytes(1048576)).toBe('1 MiB');
      expect(formatBytes(1073741824)).toBe('1 GiB');
      expect(formatBytes(53687091200)).toBe('50 GiB');
    });

    it('formats decimal bytes (GB / MB / KB, base-1000) when unit standard is decimal', () => {
      expect(formatBytes(0, { standard: 'decimal' })).toBe('0 B');
      expect(formatBytes(1000, { standard: 'decimal' })).toBe('1 KB');
      expect(formatBytes(1000000, { standard: 'decimal' })).toBe('1 MB');
      expect(formatBytes(1000000000, { standard: 'decimal' })).toBe('1 GB');
      expect(formatBytes(50000000000, { standard: 'decimal' })).toBe('50 GB');
    });
  });

  describe('formatDualBytes helper', () => {
    it('formats combined binary and decimal units together', () => {
      expect(formatDualBytes(0)).toBe('0 B (0 B)');
      // 1 GiB = 1073741824 bytes ≈ 1.07 GB
      expect(formatDualBytes(1073741824)).toBe('1 GiB (1.07 GB)');
      // 6.94 GiB approx 7451806924 bytes = 7.45 GB
      expect(formatDualBytes(7451806924, 2)).toBe('6.94 GiB (7.45 GB)');
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
      expect(res.totalBytes).toBe(10000);
      expect(res.limitBytes).toBe(50000000000);
      expect(res.percentUsed).toBe(0.02);
      expect(res.totalCount).toBe(10);
      expect(res.linkedCount).toBe(8);
      expect(res.orphanCount).toBe(2);
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/api/storage/metrics'),
        expect.any(Object)
      );
    });

    it('passes providerId query parameter when provided', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            data: {
              totalBytes: 5000,
              limitBytes: 20000,
              percentUsed: 0.25,
              totalCount: 5,
              linkedCount: 4,
              orphanCount: 1,
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      await fetchStorageMetrics('p-123');
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/api/storage/metrics?providerId=p-123'),
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
        expect.stringContaining(
          '/api/storage/resources?status=linked&search=ep1&sortBy=size&sortOrder=desc'
        ),
        expect.any(Object)
      );
    });

    it('throws error when fetch fails', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ error: { message: 'Database error' } }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      await expect(fetchStorageResources()).rejects.toThrow('Database error');
    });
  });

  describe('fetchStorageSeries', () => {
    it('fetches series summaries with season breakdowns', async () => {
      const mockBackendSeries = {
        items: [
          {
            id: 'series-1',
            title: 'Cyberpunk Series',
            s3SourceCount: 2,
            s3SizeBytes: 6442450944,
            seasons: [
              {
                id: 'season-1',
                seasonNumber: 1,
                title: 'Season 1',
                s3SourceCount: 2,
                s3SizeBytes: 6442450944,
              },
            ],
          },
        ],
        total: 1,
      };

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ data: mockBackendSeries }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const res = await fetchStorageSeries();
      expect(res.total).toBe(1);
      expect(res.items[0]).toMatchObject({
        id: 'series-1',
        title: 'Cyberpunk Series',
        s3SourceCount: 2,
        s3SizeBytes: 6442450944,
      });
      expect(res.items[0].seasons).toHaveLength(1);
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/api/storage/series'),
        expect.any(Object)
      );
    });

    it('passes providerId query when provided', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ data: { items: [], total: 0 } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      await fetchStorageSeries({ providerId: 'prov-1' });
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/api/storage/series?providerId=prov-1'),
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

      await expect(fetchStorageSeries()).rejects.toThrow('Server error');
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

    it('passes providerId in body when provided', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ data: { count: 1, totalBytes: 1500 } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      await refreshStorageScan('prov-99');
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/api/storage/scan'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ providerId: 'prov-99' }),
        })
      );
    });

    it('throws error when scan fails', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ error: { message: 'Scan failed' } }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      await expect(refreshStorageScan()).rejects.toThrow('Scan failed');
    });
  });

  describe('updateStorageLimit', () => {
    it('puts updated capacity limit', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            data: { limitGb: 100, limitBytes: 100 * 1024 * 1024 * 1024 },
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        )
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

    it('throws error when limit update fails', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            error: { message: 'Storage limit must be a positive number' },
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      );

      await expect(updateStorageLimit(-5)).rejects.toThrow(
        'Storage limit must be a positive number'
      );
    });
  });

  describe('updateSourceMetadata', () => {
    it('patches source label and quality', async () => {
      const mockUpdated = {
        id: 'src-1',
        label: 'Updated Label',
        quality: '1080p',
        episodeId: 'ep-1',
      };

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ data: mockUpdated }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const res = await updateSourceMetadata('src-1', {
        label: 'Updated Label',
        quality: '1080p',
      });
      expect(res.label).toBe('Updated Label');
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/api/storage/resources/src-1'),
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ label: 'Updated Label', quality: '1080p' }),
        })
      );
    });

    it('throws error when metadata update fails', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({ error: { message: 'Source not found' } }),
          {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      );

      await expect(
        updateSourceMetadata('bad-id', { label: 'New' })
      ).rejects.toThrow('Source not found');
    });
  });

  describe('attachOrphanFile', () => {
    it('posts attachment payload to backend', async () => {
      const input = {
        key: 'orphans/video.mp4',
        episodeId: 'ep-123',
        label: 'S3 Main',
        quality: '1080p',
      };
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

    it('throws error when attach fails', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({ error: { message: 'Target episode not found' } }),
          {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      );

      await expect(
        attachOrphanFile({
          key: 'file.mp4',
          episodeId: 'nonexistent',
          label: 'Label',
        })
      ).rejects.toThrow('Target episode not found');
    });
  });

  describe('deleteStorageResources & purgeOrphanFiles', () => {
    it('sends keys array for batch deletion', async () => {
      const mockResponse = {
        deletedKeys: ['k1', 'k2'],
        reclaimedBytes: 2048,
        deletedSourcesCount: 1,
      };

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

    it('throws error when deleteStorageResources fails', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            error: { message: 'keys array is required and must not be empty' },
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      );

      await expect(deleteStorageResources([])).rejects.toThrow(
        'keys array is required and must not be empty'
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

    it('throws error when purgeOrphanFiles fails', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({ error: { message: 'Provider unavailable' } }),
          {
            status: 502,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      );

      await expect(purgeOrphanFiles('p-fail')).rejects.toThrow(
        'Provider unavailable'
      );
    });
  });

  describe('getStoragePreviewUrl', () => {
    it('fetches presigned playback URL for key', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            data: {
              previewUrl: 'https://b2.s3.preview-url.com/video.mp4?token=123',
            },
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      );

      const url = await getStoragePreviewUrl('videos/video.mp4');
      expect(url).toBe('https://b2.s3.preview-url.com/video.mp4?token=123');
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          '/api/storage/resources/preview-url?key=videos/video.mp4'
        ),
        expect.any(Object)
      );
    });

    it('passes providerId query parameter when provided', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            data: { previewUrl: 'https://preview.com/video.mp4' },
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      );

      const url = await getStoragePreviewUrl('videos/video.mp4', 'p-custom');
      expect(url).toBe('https://preview.com/video.mp4');
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          '/api/storage/resources/preview-url?key=videos/video.mp4&providerId=p-custom'
        ),
        expect.any(Object)
      );
    });

    it('throws error when preview URL fetch fails', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            error: { message: 'key query parameter is required' },
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      );

      await expect(getStoragePreviewUrl('')).rejects.toThrow(
        'key query parameter is required'
      );
    });
  });

  describe('Storage Providers CRUD & Connection testing', () => {
    describe('fetchStorageProviders', () => {
      it('fetches all configured storage providers', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
          new Response(JSON.stringify({ data: [mockProvider] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );

        const providers = await fetchStorageProviders();
        expect(providers).toHaveLength(1);
        expect(providers[0].name).toBe('Primary S3');
        expect(fetchSpy).toHaveBeenCalledWith(
          expect.stringContaining('/api/storage/providers'),
          expect.any(Object)
        );
      });

      it('throws error when fetch fails', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
          new Response(JSON.stringify({ error: { message: 'Unauthorized' } }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          })
        );

        await expect(fetchStorageProviders()).rejects.toThrow('Unauthorized');
      });
    });

    describe('createStorageProvider', () => {
      const input = {
        name: 'New Provider',
        providerType: 'custom' as const,
        endpoint: 'https://s3.example.com',
        region: 'us-west-1',
        bucket: 'new-bucket',
        accessKeyId: 'key',
        secretAccessKey: 'secret',
      };

      it('creates provider successfully', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
          new Response(
            JSON.stringify({ data: { ...mockProvider, name: 'New Provider' } }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }
          )
        );

        const result = await createStorageProvider(input);
        expect(result.name).toBe('New Provider');
        expect(fetchSpy).toHaveBeenCalledWith(
          expect.stringContaining('/api/storage/providers'),
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify(input),
          })
        );
      });

      it('throws error when creation fails', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
          new Response(
            JSON.stringify({
              error: { message: 'Provider name already exists' },
            }),
            {
              status: 409,
              headers: { 'Content-Type': 'application/json' },
            }
          )
        );

        await expect(createStorageProvider(input)).rejects.toThrow(
          'Provider name already exists'
        );
      });
    });

    describe('updateStorageProvider', () => {
      it('updates provider successfully', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
          new Response(
            JSON.stringify({ data: { ...mockProvider, name: 'Updated' } }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }
          )
        );

        const result = await updateStorageProvider('prov-1', {
          name: 'Updated',
        });
        expect(result.name).toBe('Updated');
        expect(fetchSpy).toHaveBeenCalledWith(
          expect.stringContaining('/api/storage/providers/prov-1'),
          expect.objectContaining({
            method: 'PUT',
            body: JSON.stringify({ name: 'Updated' }),
          })
        );
      });

      it('throws error when update fails', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
          new Response(
            JSON.stringify({ error: { message: 'Provider not found' } }),
            {
              status: 404,
              headers: { 'Content-Type': 'application/json' },
            }
          )
        );

        await expect(
          updateStorageProvider('prov-none', { name: 'X' })
        ).rejects.toThrow('Provider not found');
      });
    });

    describe('deleteStorageProvider', () => {
      it('deletes provider successfully', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
          new Response(
            JSON.stringify({ data: { success: true, deletedId: 'prov-1' } }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }
          )
        );

        await expect(deleteStorageProvider('prov-1')).resolves.toBeUndefined();
        expect(fetchSpy).toHaveBeenCalledWith(
          expect.stringContaining('/api/storage/providers/prov-1'),
          expect.objectContaining({ method: 'DELETE' })
        );
      });

      it('throws error when deletion fails', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
          new Response(
            JSON.stringify({
              error: { message: 'Cannot delete default provider' },
            }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }
          )
        );

        await expect(deleteStorageProvider('prov-default')).rejects.toThrow(
          'Cannot delete default provider'
        );
      });
    });

    describe('testStorageProviderConnection', () => {
      it('tests provider connection successfully', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
          new Response(
            JSON.stringify({ data: { success: true, latencyMs: 42 } }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }
          )
        );

        const result = await testStorageProviderConnection({
          providerId: 'prov-1',
        });
        expect(result.success).toBe(true);
        expect(result.latencyMs).toBe(42);
        expect(fetchSpy).toHaveBeenCalledWith(
          expect.stringContaining('/api/storage/providers/test'),
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ providerId: 'prov-1' }),
          })
        );
      });

      it('throws error when test connection fails', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
          new Response(
            JSON.stringify({ error: { message: 'Connection timed out' } }),
            {
              status: 504,
              headers: { 'Content-Type': 'application/json' },
            }
          )
        );

        await expect(
          testStorageProviderConnection({ providerId: 'prov-1' })
        ).rejects.toThrow('Connection timed out');
      });
    });
  });

  describe('MinIO status & spin-up', () => {
    describe('fetchMinioStatus', () => {
      it('fetches MinIO status successfully', async () => {
        const mockStatus = {
          isAvailable: true,
          isRunning: true,
          isConfigured: true,
          endpoint: 'http://localhost:9000',
          bucket: 'private-movie-videos',
          providerId: 'prov-minio',
        };

        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
          new Response(JSON.stringify({ data: mockStatus }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );

        const status = await fetchMinioStatus();
        expect(status.isAvailable).toBe(true);
        expect(status.isRunning).toBe(true);
        expect(status.isConfigured).toBe(true);
        expect(fetchSpy).toHaveBeenCalledWith(
          expect.stringContaining('/api/storage/minio/status'),
          expect.any(Object)
        );
      });

      it('throws error when status fetch fails', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
          new Response(
            JSON.stringify({ error: { message: 'Failed to inspect Docker' } }),
            {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            }
          )
        );

        await expect(fetchMinioStatus()).rejects.toThrow(
          'Failed to inspect Docker'
        );
      });
    });

    describe('spinMinioUp', () => {
      it('posts to spin-up endpoint and returns provider info', async () => {
        const mockResult = {
          provider: {
            ...mockProvider,
            id: 'prov-minio-1',
            name: 'Local MinIO',
          },
          consoleUrl: 'http://localhost:9001',
          accessKeyId: 'minioadmin',
          secretAccessKey: 'minioadmin',
        };

        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
          new Response(JSON.stringify({ data: mockResult }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );

        const result = await spinMinioUp({ port: 9000 });
        expect(result.provider.id).toBe('prov-minio-1');
        expect(result.consoleUrl).toBe('http://localhost:9001');
        expect(fetchSpy).toHaveBeenCalledWith(
          expect.stringContaining('/api/storage/minio/spin-up'),
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ port: 9000 }),
          })
        );
      });

      it('throws error when spin-up fails', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
          new Response(
            JSON.stringify({ error: { message: 'Docker socket unavailable' } }),
            {
              status: 503,
              headers: { 'Content-Type': 'application/json' },
            }
          )
        );

        await expect(spinMinioUp()).rejects.toThrow(
          'Docker socket unavailable'
        );
      });
    });

    describe('resolveMinioStatusState helper', () => {
      it('maps combinations of availability, running, and configured flags', () => {
        expect(
          resolveMinioStatusState({
            isAvailable: false,
            isRunning: false,
            isConfigured: false,
          })
        ).toBe('unavailable');

        expect(
          resolveMinioStatusState({
            isAvailable: true,
            isRunning: true,
            isConfigured: true,
          })
        ).toBe('ready');

        expect(
          resolveMinioStatusState({
            isAvailable: true,
            isRunning: false,
            isConfigured: true,
          })
        ).toBe('stopped');

        expect(
          resolveMinioStatusState({
            isAvailable: true,
            isRunning: true,
            isConfigured: false,
          })
        ).toBe('not-configured');

        expect(
          resolveMinioStatusState({
            isAvailable: true,
            isRunning: false,
            isConfigured: false,
          })
        ).toBe('not-configured');
      });
    });

    describe('deriveMinioEndpoint & generateMinioSecret helpers', () => {
      it('derives endpoint URL with given or default port', () => {
        expect(deriveMinioEndpoint(9000)).toBe('http://localhost:9000');
        expect(deriveMinioEndpoint(9005)).toBe('http://localhost:9005');
      });

      it('generates secret of requested length with valid alphanumeric characters', () => {
        const secret = generateMinioSecret(32);
        expect(secret).toHaveLength(32);
        expect(secret).toMatch(/^[A-Za-z0-9]+$/);
      });
    });
  });
});
