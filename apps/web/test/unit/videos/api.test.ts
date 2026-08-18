import { describe, expect, it, vi } from 'vitest';
import {
  fetchEpisode,
  fetchEpisodes,
  episodesQueryOptions,
  fetchSeries,
  seriesListQueryOptions,
  fetchSeriesDetail,
  seriesDetailQueryOptions,
  previewScrapeSeries,
  saveMedia,
  updateEpisode,
  updateEpisodeOrders,
  addVideoSource,
  updateVideoSource,
  deleteVideoSource,
  type Episode,
  type VideoSource,
} from '@/modules/videos/internal/api';

describe('videos api', () => {
  it('Episode type includes videoSources array instead of embedUrl and videoUrl', () => {
    const mockSource: VideoSource = {
      id: 'src-1',
      type: 'direct',
      url: 'https://stream.com/1.mp4',
      label: 'Server 1',
      quality: '1080p',
    };

    const mockEpisode: Episode = {
      id: 'ep-1',
      sourceUrl: 'https://otakudesu.cloud/ep1',
      source: 'otakudesu',
      title: 'Episode 1',
      videoSources: [mockSource],
      createdAt: '2025-01-10T00:00:00.000Z',
      updatedAt: '2025-01-10T00:00:00.000Z',
    };

    expect(mockEpisode.videoSources).toHaveLength(1);
    expect(mockEpisode.videoSources[0].id).toBe('src-1');
    expect('embedUrl' in mockEpisode).toBe(false);
    expect('videoUrl' in mockEpisode).toBe(false);
  });

  it('VideoSource type has id, type, url, label, and quality fields', () => {
    const source: VideoSource = {
      id: 'vs-100',
      type: 'embed',
      url: 'https://embed.com/1',
      label: 'Embed Server 1',
      quality: '720p',
    };

    expect(source.id).toBe('vs-100');
    expect(source.type).toBe('embed');
    expect(source.url).toBe('https://embed.com/1');
    expect(source.label).toBe('Embed Server 1');
    expect(source.quality).toBe('720p');
  });

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
            videoSources: [
              {
                id: 'vs-1',
                type: 'direct',
                url: 'https://stream.com/1.mp4',
                label: 'Server 1',
                quality: '1080p',
              },
            ],
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
    expect(result.episodes[0].videoSources).toHaveLength(1);
    expect(result.episodes[0].videoSources[0].label).toBe('Server 1');
    expect(result.meta.total).toBe(1);

    fetchSpy.mockRestore();
  });

  it('fetchEpisode returns episode with nested video sources', async () => {
    const mockEpisodeData = {
      data: {
        id: 'ep-1',
        sourceUrl: 'https://otakudesu.cloud/ep1',
        source: 'otakudesu',
        title: 'Episode 1',
        videoSources: [
          {
            id: 'vs-1',
            type: 'embed',
            url: 'https://embed.com/1',
            label: 'Embed Server',
            quality: '720p',
          },
        ],
        createdAt: '2025-01-10T00:00:00.000Z',
        updatedAt: '2025-01-10T00:00:00.000Z',
      },
    };

    let requestedUrl = '';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(
      async (input) => {
        requestedUrl = typeof input === 'string' ? input : (input as Request).url;
        return new Response(JSON.stringify(mockEpisodeData), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    );

    const episode = await fetchEpisode('ep-1');

    expect(requestedUrl).toContain('/episodes/ep-1');
    expect(episode.id).toBe('ep-1');
    expect(episode.videoSources).toHaveLength(1);
    expect(episode.videoSources[0].type).toBe('embed');

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
            videoSources: [
              {
                id: 'vs-1',
                type: 'direct',
                url: 'https://stream.com/1.mp4',
                label: 'Server 1',
                quality: '1080p',
              },
            ],
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
    expect(result.episodes[0].videoSources).toHaveLength(1);

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

  it('previewScrapeSeries posts payload to backend API and returns parsed series and episodes batch', async () => {
    const mockSeriesResult = {
      data: {
        series: {
          sourceUrl: 'https://otakudesu.cloud/anime/test-series',
          source: 'otakudesu',
          title: 'Batch Series Title',
          description: 'Batch series description',
          posterUrl: 'https://otakudesu.cloud/poster.jpg',
        },
        episodes: [
          {
            title: 'Batch Episode 1',
            url: 'https://otakudesu.cloud/episode/ep-1',
            date: '10 Jan 2025',
          },
          {
            title: 'Batch Episode 2',
            url: 'https://otakudesu.cloud/episode/ep-2',
            date: '17 Jan 2025',
          },
        ],
      },
    };

    let postUrl = '';
    let postBody = '';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(
      async (input, init) => {
        postUrl = typeof input === 'string' ? input : (input as Request).url;
        postBody = init?.body as string;
        return new Response(JSON.stringify(mockSeriesResult), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    );

    const result = await previewScrapeSeries({
      sourceUrl: 'https://otakudesu.cloud/anime/test-series',
      source: 'otakudesu',
    });

    expect(postUrl).toContain('/preview-scrape-series');
    expect(JSON.parse(postBody)).toEqual({
      sourceUrl: 'https://otakudesu.cloud/anime/test-series',
      source: 'otakudesu',
    });
    expect(result.series.title).toBe('Batch Series Title');
    expect(result.episodes).toHaveLength(2);
    expect(result.episodes[0].title).toBe('Batch Episode 1');

    fetchSpy.mockRestore();
  });

  it('saveMedia posts payload to backend API and returns saved media', async () => {
    const mockSavedResult = {
      data: {
        episode: {
          id: 'ep-saved-1',
          sourceUrl: 'https://otakudesu.cloud/ep1',
          source: 'otakudesu',
          title: 'Saved Episode Title',
          videoSources: [
            {
              id: 'vs-1',
              type: 'direct',
              url: 'https://stream.com/saved.mp4',
              label: 'Direct Stream',
              quality: '1080p',
            },
          ],
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
        videoSources: [
          {
            type: 'direct',
            url: 'https://stream.com/saved.mp4',
            label: 'Direct Stream',
            quality: '1080p',
          },
        ],
        metadata: {},
      },
    });

    expect(result.episode.id).toBe('ep-saved-1');
    expect(result.episode.videoSources).toHaveLength(1);
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
          videoSources: [],
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
        videoSources: [
          {
            id: 'vs-1',
            type: 'direct',
            url: 'https://stream.com/1-updated.mp4',
            label: 'Server 1',
            quality: '1080p',
          },
        ],
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

    let postUrl = '';
    let postBody = '';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(
      async (input, init) => {
        postUrl = typeof input === 'string' ? input : (input as Request).url;
        postBody = init?.body as string;
        return new Response(JSON.stringify(mockEpisodeWithNewSource), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    );

    const result = await addVideoSource('ep-1', {
      type: 'direct',
      url: 'https://stream.com/new.mp4',
      label: 'Server 2',
      quality: '1080p',
    });

    expect(postUrl).toContain('/episodes/ep-1/sources');
    expect(JSON.parse(postBody)).toEqual({
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

    fetchSpy.mockRestore();
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

    let patchUrl = '';
    let patchBody = '';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(
      async (input, init) => {
        patchUrl = typeof input === 'string' ? input : (input as Request).url;
        patchBody = init?.body as string;
        return new Response(JSON.stringify(mockUpdatedResult), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    );

    const result = await updateVideoSource('ep-1', 'vs-1', {
      label: 'Updated Server',
      url: 'https://stream.com/updated.mp4',
    });

    expect(patchUrl).toContain('/episodes/ep-1/sources/vs-1');
    expect(JSON.parse(patchBody)).toEqual({
      label: 'Updated Server',
      url: 'https://stream.com/updated.mp4',
    });
    expect(result.id).toBe('ep-1');
    expect(result.videoSources[0].label).toBe('Updated Server');

    fetchSpy.mockRestore();
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

    let deleteUrl = '';
    let deleteMethod = '';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(
      async (input, init) => {
        deleteUrl = typeof input === 'string' ? input : (input as Request).url;
        deleteMethod = init?.method ?? 'GET';
        return new Response(JSON.stringify(mockDeleteResult), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    );

    const result = await deleteVideoSource('ep-1', 'vs-1');

    expect(deleteUrl).toContain('/episodes/ep-1/sources/vs-1');
    expect(deleteMethod).toBe('DELETE');
    expect(result.id).toBe('ep-1');
    expect(result.videoSources).toHaveLength(0);

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
});

