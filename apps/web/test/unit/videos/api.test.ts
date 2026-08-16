import { describe, expect, it, vi } from 'vitest';
import {
  fetchEpisodes,
  episodesQueryOptions,
  fetchSeries,
  seriesListQueryOptions,
  fetchSeriesDetail,
  seriesDetailQueryOptions,
  saveMedia,
  updateEpisode,
  updateEpisodeOrders,
  resolveEpisode,
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

  it('fetchEpisodes strips undefined query parameters from API request URL', async () => {
    const mockData = {
      data: {
        episodes: [],
        meta: {
          total: 0,
          page: 1,
          limit: 20,
        },
      },
    };

    let requestedUrl = '';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(
      async (input) => {
        requestedUrl =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.toString()
              : (input as Request).url;
        return new Response(JSON.stringify(mockData), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    );

    await fetchEpisodes({ page: undefined, limit: 20 });

    expect(requestedUrl).not.toContain('undefined');
    expect(requestedUrl).toContain('limit=20');
    expect(requestedUrl).not.toContain('page=');

    await fetchEpisodes();

    expect(requestedUrl).not.toContain('undefined');

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

  it('fetchSeries returns series list and metadata from backend API', async () => {
    const mockData = {
      data: {
        series: [
          {
            id: 'series-1',
            sourceUrl: 'https://otakudesu.cloud/anime/series-1',
            source: 'otakudesu',
            title: 'Series Title 1',
            description: 'Description 1',
            posterUrl: 'https://otakudesu.cloud/poster1.jpg',
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

    const result = await fetchSeries({ page: 1, limit: 20 });

    expect(result.series).toHaveLength(1);
    expect(result.series[0].id).toBe('series-1');
    expect(result.series[0].title).toBe('Series Title 1');
    expect(result.meta.total).toBe(1);

    fetchSpy.mockRestore();
  });

  it('fetchSeries strips undefined query parameters from API request URL', async () => {
    const mockData = {
      data: {
        series: [],
        meta: {
          total: 0,
          page: 1,
          limit: 20,
        },
      },
    };

    let requestedUrl = '';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(
      async (input) => {
        requestedUrl =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.toString()
              : (input as Request).url;
        return new Response(JSON.stringify(mockData), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    );

    await fetchSeries({ page: undefined, limit: 20 });

    expect(requestedUrl).not.toContain('undefined');
    expect(requestedUrl).toContain('limit=20');
    expect(requestedUrl).not.toContain('page=');

    await fetchSeries();

    expect(requestedUrl).not.toContain('undefined');

    fetchSpy.mockRestore();
  });

  it('fetchSeries throws error when backend API returns failure', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () =>
        new Response(
          JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'Database error' } }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          }
        )
    );

    await expect(fetchSeries()).rejects.toThrow('Failed to fetch series');

    fetchSpy.mockRestore();
  });

  it('seriesListQueryOptions returns query key and queryFn', () => {
    const options = seriesListQueryOptions({ page: 1, limit: 20 });

    expect(options.queryKey).toEqual(['series', 'list', { page: 1, limit: 20 }]);
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

  it('saveMedia posts payload to backend API and returns saved media', async () => {
    const mockSavedResult = {
      data: {
        episode: {
          id: 'ep-saved-1',
          sourceUrl: 'https://otakudesu.cloud/ep1',
          source: 'otakudesu',
          title: 'Saved Episode Title',
          videoUrl: 'https://stream.com/saved.mp4',
          createdAt: '2025-01-10T00:00:00.000Z',
          updatedAt: '2025-01-10T00:00:00.000Z',
        },
        series: null,
      },
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () =>
        new Response(JSON.stringify(mockSavedResult), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
    );

    const result = await saveMedia({
      episode: {
        sourceUrl: 'https://otakudesu.cloud/ep1',
        source: 'otakudesu',
        title: 'Saved Episode Title',
        videoType: 'mp4',
        videoUrl: 'https://stream.com/saved.mp4',
        metadata: {},
      },
    });

    expect(result.episode.id).toBe('ep-saved-1');
    expect(fetchSpy).toHaveBeenCalled();

    fetchSpy.mockRestore();
  });

  it('saveMedia throws error when backend API fails', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () =>
        new Response(
          JSON.stringify({ error: { code: 'BAD_REQUEST', message: 'Invalid payload' } }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        )
    );

    await expect(
      saveMedia({
        episode: {
          sourceUrl: 'invalid',
          source: 'otakudesu',
          title: 'Title',
          videoType: null,
          videoUrl: 'invalid',
          metadata: {},
        },
      })
    ).rejects.toThrow('Failed to save media');

    fetchSpy.mockRestore();
  });

  it('updateEpisode patches episode payload including description and returns updated episode', async () => {
    const mockUpdatedResult = {
      data: {
        id: 'ep-1',
        sourceUrl: 'https://otakudesu.cloud/ep1',
        source: 'otakudesu',
        title: 'Updated Episode',
        videoType: 'mp4',
        videoUrl: 'https://stream.com/1-updated.mp4',
        description: 'New Description',
        createdAt: '2025-01-10T00:00:00.000Z',
        updatedAt: '2025-01-10T00:00:00.000Z',
      },
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () =>
        new Response(JSON.stringify(mockUpdatedResult), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
    );

    const result = await updateEpisode('ep-1', {
      title: 'Updated Episode',
      description: 'New Description',
    });

    expect(result.id).toBe('ep-1');
    expect(result.description).toBe('New Description');
    expect(fetchSpy).toHaveBeenCalled();

    fetchSpy.mockRestore();
  });

  it('updateEpisodeOrders patches episode orders array to backend API', async () => {
    const mockResult = {
      data: {
        success: true,
      },
    };

    let patchUrl = '';
    let patchBody = '';

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(
      async (input, init) => {
        patchUrl = typeof input === 'string' ? input : (input as Request).url;
        patchBody = init?.body as string;
        return new Response(JSON.stringify(mockResult), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    );

    await updateEpisodeOrders('series-1', [
      { id: 'ep-2', order: 1 },
      { id: 'ep-1', order: 2 },
    ]);

    expect(patchUrl).toContain('/series/series-1/episodes/order');
    expect(patchBody).toContain('ep-2');
    expect(fetchSpy).toHaveBeenCalled();

    fetchSpy.mockRestore();
  });

  it('resolveEpisode posts resolve request to backend API and returns updated episode', async () => {
    const mockResult = {
      data: {
        id: 'ep-1',
        sourceUrl: 'https://otakudesu.cloud/ep1',
        source: 'otakudesu',
        title: 'Resolved Episode',
        embedUrl: 'https://desustream.net/dstream/arcg/?id=sample',
        videoUrl: 'https://stream.com/1-resolved.mp4',
        createdAt: '2025-01-10T00:00:00.000Z',
        updatedAt: '2025-01-10T00:00:00.000Z',
      },
    };

    let postUrl = '';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(
      async (input) => {
        postUrl = typeof input === 'string' ? input : (input as Request).url;
        return new Response(JSON.stringify(mockResult), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    );

    const result = await resolveEpisode('ep-1');

    expect(postUrl).toContain('/episodes/ep-1/resolve');
    expect(result.id).toBe('ep-1');
    expect(result.videoUrl).toBe('https://stream.com/1-resolved.mp4');

    fetchSpy.mockRestore();
  });

  it('resolveEpisode throws error when backend API resolution fails', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () =>
        new Response(
          JSON.stringify({ error: { code: 'STREAM_NOT_FOUND', message: 'No video stream found' } }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        )
    );

    await expect(resolveEpisode('ep-1')).rejects.toThrow('Failed to resolve episode stream');

    fetchSpy.mockRestore();
  });
});
