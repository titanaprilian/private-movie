import { describe, expect, it, vi } from 'vitest';
import {
  fetchEpisodes,
  episodesQueryOptions,
  fetchSeriesDetail,
  seriesDetailQueryOptions,
} from '@/modules/videos/internal/api';

describe('videos api', () => {
  it('fetchEpisodes returns episode list and metadata from backend API', async () => {
    const mockData = {
      data: {
        episodes: [
          {
            id: 'ep-1',
            sourceUrl: 'https://otakudesu.cloud/ep1',
            source: 'otakudesu',
            title: 'Episode 1: Dawn',
            videoType: 'mp4',
            videoUrl: 'https://stream.com/1.mp4',
            description: 'First episode',
            duration: '24m',
            tags: ['action'],
            resolution: '1080p',
            format: 'mp4',
            size: '300MB',
            metadata: null,
            seriesId: 'series-1',
            createdAt: '2025-01-10T00:00:00.000Z',
            updatedAt: '2025-01-10T00:00:00.000Z',
          },
        ],
        meta: {
          total: 1,
          page: 1,
          limit: 20,
        },
      },
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () =>
        new Response(JSON.stringify(mockData), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
    );

    const result = await fetchEpisodes({ page: 1, limit: 20 });

    expect(result.episodes).toHaveLength(1);
    expect(result.episodes[0].id).toBe('ep-1');
    expect(result.meta.total).toBe(1);

    fetchSpy.mockRestore();
  });

  it('fetchEpisodes throws error when backend API returns failure', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () =>
        new Response(
          JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'Database connection failed' } }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          }
        )
    );

    await expect(fetchEpisodes()).rejects.toThrow('Failed to fetch episodes');

    fetchSpy.mockRestore();
  });

  it('episodesQueryOptions returns query key and queryFn', () => {
    const options = episodesQueryOptions({ page: 2, limit: 10 });

    expect(options.queryKey).toEqual(['episodes', { page: 2, limit: 10 }]);
    expect(typeof options.queryFn).toBe('function');
  });

  it('fetchSeriesDetail returns series detail with episodes from backend API', async () => {
    const mockSeriesData = {
      data: {
        id: 'series-1',
        sourceUrl: 'https://otakudesu.cloud/anime/series-1',
        source: 'otakudesu',
        title: 'Test Series Title',
        description: 'Test Series Description',
        posterUrl: 'https://otakudesu.cloud/poster.jpg',
        createdAt: '2025-01-10T00:00:00.000Z',
        updatedAt: '2025-01-10T00:00:00.000Z',
        episodes: [
          {
            id: 'ep-1',
            sourceUrl: 'https://otakudesu.cloud/ep1',
            source: 'otakudesu',
            title: 'Episode 1',
            videoUrl: 'https://stream.com/1.mp4',
            createdAt: '2025-01-10T00:00:00.000Z',
            updatedAt: '2025-01-10T00:00:00.000Z',
          },
        ],
      },
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () =>
        new Response(JSON.stringify(mockSeriesData), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
    );

    const result = await fetchSeriesDetail('series-1');

    expect(result.id).toBe('series-1');
    expect(result.title).toBe('Test Series Title');
    expect(result.episodes).toHaveLength(1);

    fetchSpy.mockRestore();
  });

  it('fetchSeriesDetail throws error when backend returns failure', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () =>
        new Response(
          JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Series not found' } }),
          {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          }
        )
    );

    await expect(fetchSeriesDetail('invalid-id')).rejects.toThrow('Failed to fetch series details');

    fetchSpy.mockRestore();
  });

  it('seriesDetailQueryOptions returns query key and queryFn', () => {
    const options = seriesDetailQueryOptions('series-1');

    expect(options.queryKey).toEqual(['series', 'series-1']);
    expect(typeof options.queryFn).toBe('function');
  });
});
