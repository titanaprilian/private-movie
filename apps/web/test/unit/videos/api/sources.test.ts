import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  addVideoSource,
  updateVideoSource,
  deleteVideoSource,
  previewBulkSources,
  saveBulkSources,
  checkVideoSource,
} from '@/modules/videos/internal/api';
import { mockFetch } from '../../../utils';

describe('videos api - sources', () => {
  beforeEach(() => {
    mockFetch.reset();
  });

  afterAll(() => {
    mockFetch.restore();
  });

  it('addVideoSource(episodeId, source) calls the correct endpoint', async () => {
    const mockEpisodeWithNewSource = {
      data: {
        id: 'ep-1',
        sourceUrl: 'https://otakudesu.cloud/ep1',
        source: 'otakudesu',
        title: 'Episode 1',
        videoSources: [
          {
            id: 'vs-new-1',
            type: 'direct',
            url: 'https://stream.com/new.mp4',
            label: 'Server 2',
            quality: '1080p',
          },
        ],
        createdAt: '2025-01-10T00:00:00.000Z',
        updatedAt: '2025-01-10T00:00:00.000Z',
      },
    };

    mockFetch.post('/api/episodes/:id/sources', mockEpisodeWithNewSource);

    const result = await addVideoSource('ep-1', {
      type: 'direct',
      url: 'https://stream.com/new.mp4',
      label: 'Server 2',
      quality: '1080p',
    });

    const lastReq = mockFetch.lastRequest();
    expect(lastReq?.url.pathname).toContain('/episodes/ep-1/sources');
    expect(lastReq?.bodyJson).toEqual({
      videoSources: [
        {
          type: 'direct',
          url: 'https://stream.com/new.mp4',
          label: 'Server 2',
          quality: '1080p',
        },
      ],
    });
    expect(result.id).toBe('ep-1');
    expect(result.videoSources).toHaveLength(1);
    expect(result.videoSources[0].id).toBe('vs-new-1');
  });

  it('updateVideoSource(episodeId, sourceId, updates) calls the correct endpoint', async () => {
    const mockUpdatedResult = {
      data: {
        id: 'ep-1',
        sourceUrl: 'https://otakudesu.cloud/ep1',
        source: 'otakudesu',
        title: 'Episode 1',
        videoSources: [
          {
            id: 'vs-1',
            type: 'direct',
            url: 'https://stream.com/updated.mp4',
            label: 'Updated Server',
            quality: '1080p',
          },
        ],
        createdAt: '2025-01-10T00:00:00.000Z',
        updatedAt: '2025-01-10T00:00:00.000Z',
      },
    };

    mockFetch.patch(
      '/api/episodes/:episodeId/sources/:sourceId',
      mockUpdatedResult
    );

    const result = await updateVideoSource('ep-1', 'vs-1', {
      label: 'Updated Server',
      url: 'https://stream.com/updated.mp4',
    });

    const lastReq = mockFetch.lastRequest();
    expect(lastReq?.url.pathname).toContain('/episodes/ep-1/sources/vs-1');
    expect(lastReq?.bodyJson).toEqual({
      label: 'Updated Server',
      url: 'https://stream.com/updated.mp4',
    });
    expect(result.id).toBe('ep-1');
    expect(result.videoSources[0].label).toBe('Updated Server');
  });

  it('deleteVideoSource(episodeId, sourceId) calls the correct endpoint', async () => {
    const mockDeleteResult = {
      data: {
        id: 'ep-1',
        sourceUrl: 'https://otakudesu.cloud/ep1',
        source: 'otakudesu',
        title: 'Episode 1',
        videoSources: [],
        createdAt: '2025-01-10T00:00:00.000Z',
        updatedAt: '2025-01-10T00:00:00.000Z',
      },
    };

    mockFetch.delete(
      '/api/episodes/:episodeId/sources/:sourceId',
      mockDeleteResult
    );

    const result = await deleteVideoSource('ep-1', 'vs-1');

    const lastReq = mockFetch.lastRequest();
    expect(lastReq?.url.pathname).toContain('/episodes/ep-1/sources/vs-1');
    expect(lastReq?.method).toBe('DELETE');
    expect(result.id).toBe('ep-1');
    expect(result.videoSources).toHaveLength(0);
  });

  it('previewBulkSources posts payload to /series/:id/preview-bulk-sources', async () => {
    const mockPreviewResult = {
      data: {
        scrapedEpisodes: [
          {
            scrapedTitle: 'Episode 1',
            scrapedUrl: 'https://otakudesu.cloud/ep1',
            episodeNumber: 1,
            calculatedOrder: 1,
            matchedLocalEpisodeId: 'ep-1',
            matchStatus: 'matched',
          },
        ],
        localEpisodes: [],
      },
    };

    mockFetch.post('/api/series/:id/preview-bulk-sources', mockPreviewResult);

    const res = await previewBulkSources({
      seriesId: 'series-1',
      sourceUrl: 'https://otakudesu.cloud/anime/season-1',
      source: 'otakudesu',
      episodeOffset: 0,
    });

    const lastReq = mockFetch.lastRequest();
    expect(lastReq?.url.pathname).toContain(
      '/series/series-1/preview-bulk-sources'
    );
    expect(lastReq?.bodyJson).toEqual({
      sourceUrl: 'https://otakudesu.cloud/anime/season-1',
      source: 'otakudesu',
      episodeOffset: 0,
    });
    expect(res.scrapedEpisodes).toHaveLength(1);
    expect(res.scrapedEpisodes[0].scrapedTitle).toBe('Episode 1');
  });

  it('saveBulkSources posts mappings payload to /series/:id/bulk-sources', async () => {
    const mockSaveResult = {
      data: {
        success: true,
        savedCount: 2,
        skippedCount: 1,
      },
    };

    mockFetch.post('/api/series/:id/bulk-sources', mockSaveResult);

    const res = await saveBulkSources({
      seriesId: 'series-1',
      mappings: [
        {
          episodeId: 'ep-1',
          videoSources: [
            {
              type: 'embed',
              url: 'https://otakudesu.cloud/ep1',
              label: 'Otakudesu',
            },
          ],
        },
      ],
    });

    const lastReq = mockFetch.lastRequest();
    expect(lastReq?.url.pathname).toContain('/series/series-1/bulk-sources');
    expect(lastReq?.bodyJson).toEqual({
      mappings: [
        {
          episodeId: 'ep-1',
          videoSources: [
            {
              type: 'embed',
              url: 'https://otakudesu.cloud/ep1',
              label: 'Otakudesu',
            },
          ],
        },
      ],
    });
    expect(res.success).toBe(true);
    expect(res.savedCount).toBe(2);
  });

  it('checkVideoSource sends POST to /api/media/sources/check and returns health status result', async () => {
    const mockCheckResult = {
      data: {
        status: 'working' as const,
        statusCode: 200,
        latencyMs: 120,
        error: null,
      },
    };

    mockFetch.post('/api/media/sources/check', mockCheckResult);

    const res = await checkVideoSource({
      url: 'https://stream.example.com/video.mp4',
      type: 'direct',
      referer: 'https://example.com',
    });

    const lastReq = mockFetch.lastRequest();
    expect(lastReq?.url.pathname).toContain('/api/media/sources/check');
    expect(lastReq?.method).toBe('POST');
    expect(lastReq?.bodyJson).toEqual({
      url: 'https://stream.example.com/video.mp4',
      type: 'direct',
      referer: 'https://example.com',
    });
    expect(res).toEqual({
      status: 'working',
      statusCode: 200,
      latencyMs: 120,
      error: null,
    });
  });
});
