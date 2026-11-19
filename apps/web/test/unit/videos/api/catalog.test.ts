import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  fetchEpisode,
  fetchEpisodes,
  episodesQueryOptions,
  fetchSeries,
  seriesListQueryOptions,
  fetchSeriesDetail,
  seriesDetailQueryOptions,
  type Episode,
  type VideoSource,
} from '@/modules/videos/internal/api';
import { mockFetch, errorResponse } from '../../../utils';

describe('videos api - catalog', () => {
  beforeEach(() => {
    mockFetch.reset();
  });

  afterAll(() => {
    mockFetch.restore();
  });

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

    mockFetch.get('/api/episodes', mockData);

    const result = await fetchEpisodes({ page: 1, limit: 20 });

    expect(result.episodes).toHaveLength(1);
    expect(result.episodes[0].id).toBe('ep-1');
    expect(result.episodes[0].videoSources).toHaveLength(1);
    expect(result.episodes[0].videoSources[0].label).toBe('Server 1');
    expect(result.meta.total).toBe(1);
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

    mockFetch.get('/api/episodes/:id', mockEpisodeData);

    const result = await fetchEpisode('ep-1');

    expect(mockFetch.lastRequest()?.url.pathname).toContain(
      '/api/episodes/ep-1'
    );
    expect(result.id).toBe('ep-1');
    expect(result.videoSources).toHaveLength(1);
    expect(result.videoSources[0].id).toBe('vs-1');
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

    mockFetch.get('/api/episodes', mockData);

    await fetchEpisodes({ page: undefined, limit: 20 });
    const req1Url = mockFetch.lastRequest()?.url.toString() ?? '';
    expect(req1Url).not.toContain('undefined');
    expect(req1Url).toContain('limit=20');
    expect(req1Url).not.toContain('page=');

    await fetchEpisodes();
    const req2Url = mockFetch.lastRequest()?.url.toString() ?? '';
    expect(req2Url).not.toContain('undefined');
  });

  it('fetchEpisodes throws error when backend API returns failure', async () => {
    mockFetch.get(
      '/api/episodes',
      errorResponse('Database connection failed', 500, {
        code: 'INTERNAL_ERROR',
      })
    );

    await expect(fetchEpisodes()).rejects.toThrow('Database connection failed');
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

    mockFetch.get('/api/series', mockData);

    const result = await fetchSeries({ page: 1, limit: 20 });

    expect(result.series).toHaveLength(1);
    expect(result.series[0].id).toBe('series-1');
    expect(result.series[0].title).toBe('Series Title 1');
    expect(result.meta.total).toBe(1);
  });

  it('fetchSeries passes genre query parameter to backend API request URL', async () => {
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

    mockFetch.get('/api/series', mockData);

    await fetchSeries({ page: 1, limit: 20, genre: 'sci-fi' });

    expect(mockFetch.lastRequest()?.url.searchParams.get('genre')).toBe(
      'sci-fi'
    );
  });

  it('fetchSeries passes q search query parameter to backend API request URL', async () => {
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

    mockFetch.get('/api/series', mockData);

    await fetchSeries({ page: 1, limit: 20, q: 'naruto' });

    expect(mockFetch.lastRequest()?.url.searchParams.get('q')).toBe('naruto');
  });

  it('fetchSeries passes filter or tab query parameter to backend API request URL', async () => {
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

    mockFetch.get('/api/series', mockData);

    await fetchSeries({ page: 1, limit: 20, tab: 'featured' });
    expect(mockFetch.lastRequest()?.url.searchParams.get('filter')).toBe(
      'featured'
    );

    await fetchSeries({ page: 1, limit: 20, tab: 'ongoing' });
    expect(mockFetch.lastRequest()?.url.searchParams.get('filter')).toBe(
      'ongoing'
    );

    await fetchSeries({ page: 1, limit: 20, filter: 'featured' });
    expect(mockFetch.lastRequest()?.url.searchParams.get('filter')).toBe(
      'featured'
    );
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

    mockFetch.get('/api/series', mockData);

    await fetchSeries({ page: undefined, limit: 20 });
    const req1Url = mockFetch.lastRequest()?.url.toString() ?? '';
    expect(req1Url).not.toContain('undefined');
    expect(req1Url).toContain('limit=20');
    expect(req1Url).not.toContain('page=');

    await fetchSeries();
    const req2Url = mockFetch.lastRequest()?.url.toString() ?? '';
    expect(req2Url).not.toContain('undefined');
  });

  it('fetchSeries throws error when backend API returns failure', async () => {
    mockFetch.get(
      '/api/series',
      errorResponse('Database error', 500, { code: 'INTERNAL_ERROR' })
    );

    await expect(fetchSeries()).rejects.toThrow('Database error');
  });

  it('seriesListQueryOptions returns query key and queryFn', () => {
    const options = seriesListQueryOptions({ page: 1, limit: 20, q: 'naruto' });

    expect(options.queryKey).toEqual([
      'series',
      'list',
      { page: 1, limit: 20, q: 'naruto' },
    ]);
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

    mockFetch.get('/api/series/:id', mockSeriesData);

    const result = await fetchSeriesDetail('series-1');

    expect(result.id).toBe('series-1');
    expect(result.title).toBe('Test Series Title');
    expect(result.episodes).toHaveLength(1);
    expect(result.episodes[0].videoSources).toHaveLength(1);
  });

  it('fetchSeriesDetail throws error when backend returns failure', async () => {
    mockFetch.get(
      '/api/series/:id',
      errorResponse('Series not found', 404, { code: 'NOT_FOUND' })
    );

    await expect(fetchSeriesDetail('invalid-id')).rejects.toThrow(
      'Series not found'
    );
  });

  it('seriesDetailQueryOptions returns query key and queryFn', () => {
    const options = seriesDetailQueryOptions('series-1');

    expect(options.queryKey).toEqual(['series', 'series-1']);
    expect(typeof options.queryFn).toBe('function');
  });
});
