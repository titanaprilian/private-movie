import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  previewScrapeSeries,
  saveMedia,
  updateEpisode,
  updateEpisodeOrders,
  scrapeEpisodeSources,
  importTmdb,
  syncSeriesTmdb,
  fetchSeriesTmdbPreview,
  fetchSeriesTmdbSyncPreview,
} from '@/modules/videos/internal/api';
import { mockFetch, errorResponse } from '../../../utils';

describe('videos api - ingest', () => {
  beforeEach(() => {
    mockFetch.reset();
  });

  afterAll(() => {
    mockFetch.restore();
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

    mockFetch.post('/api/preview-scrape-series', mockSeriesResult);

    const result = await previewScrapeSeries({
      sourceUrl: 'https://otakudesu.cloud/anime/test-series',
      source: 'otakudesu',
    });

    const lastReq = mockFetch.lastRequest();
    expect(lastReq?.url.pathname).toContain('/preview-scrape-series');
    expect(lastReq?.bodyJson).toEqual({
      sourceUrl: 'https://otakudesu.cloud/anime/test-series',
      source: 'otakudesu',
    });
    expect(result.series.title).toBe('Batch Series Title');
    expect(result.episodes).toHaveLength(2);
    expect(result.episodes[0].title).toBe('Batch Episode 1');
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

    mockFetch.post('/api/save-media', mockSavedResult);

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
  });

  it('saveMedia throws error when backend API fails', async () => {
    mockFetch.post(
      '/api/save-media',
      errorResponse('Invalid payload', 400, { code: 'BAD_REQUEST' })
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
    ).rejects.toThrow('Invalid payload');
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

    mockFetch.patch('/api/episodes/:id', mockUpdatedResult);

    const result = await updateEpisode('ep-1', {
      title: 'Updated Episode',
      description: 'New Description',
    });

    expect(result.id).toBe('ep-1');
    expect(result.description).toBe('New Description');
  });

  it('updateEpisodeOrders patches episode orders array to backend API', async () => {
    mockFetch.patch('/api/series/:id/episodes/order', {
      data: { success: true },
    });

    await updateEpisodeOrders('series-1', [
      { id: 'ep-2', order: 1 },
      { id: 'ep-1', order: 2 },
    ]);

    const lastReq = mockFetch.lastRequest();
    expect(lastReq?.url.pathname).toContain('/series/series-1/episodes/order');
    expect(JSON.stringify(lastReq?.bodyJson)).toContain('ep-2');
  });

  it('scrapeEpisodeSources calls POST /episodes/:id/scrape-sources with sourceUrl payload', async () => {
    const mockData = {
      data: {
        id: 'ep-123',
        title: 'Episode 123',
        videoSources: [
          {
            id: 'vs-1',
            type: 'embed',
            url: 'https://embed.com/1',
            label: 'Mirror 1',
          },
        ],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    };

    mockFetch.post('/api/episodes/:id/scrape-sources', mockData);

    const res = await scrapeEpisodeSources(
      'ep-123',
      'https://otakudesu.cloud/episode/ep-123/'
    );

    const lastReq = mockFetch.lastRequest();
    expect(lastReq?.url.pathname).toContain('/episodes/ep-123/scrape-sources');
    expect(lastReq?.bodyJson).toEqual({
      sourceUrl: 'https://otakudesu.cloud/episode/ep-123/',
    });
    expect(res.id).toBe('ep-123');
    expect(res.videoSources).toHaveLength(1);
  });

  it('importTmdb posts payload to /series/tmdb-import', async () => {
    const mockData = {
      data: {
        id: 'series-tmdb-1',
        title: 'TMDB Series Title',
        source: 'tmdb',
        sourceUrl: 'https://themoviedb.org/tv/1399',
        episodes: [],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    };

    mockFetch.post('/api/series/tmdb-import', mockData);

    const res = await importTmdb({ type: 'tv', tmdbId: 1399 });

    const lastReq = mockFetch.lastRequest();
    expect(lastReq?.url.pathname).toContain('/series/tmdb-import');
    expect(lastReq?.bodyJson).toEqual({ type: 'tv', tmdbId: 1399 });
    expect(res.id).toBe('series-tmdb-1');
  });

  it('syncSeriesTmdb posts payload to /series/:id/tmdb-sync', async () => {
    const mockData = {
      data: {
        id: 'series-uuid-1',
        title: 'TMDB Synced Series',
        source: 'tmdb',
        sourceUrl: 'https://themoviedb.org/tv/1399',
        tmdbId: 1399,
        tmdbSyncStatus: 'SYNCED',
        episodes: [],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    };

    mockFetch.post('/api/series/:id/tmdb-sync', mockData);

    const res = await syncSeriesTmdb('series-uuid-1', {
      type: 'tv',
      tmdbId: 1399,
      includeSpecials: true,
    });

    const lastReq = mockFetch.lastRequest();
    expect(lastReq?.url.pathname).toContain('/series/series-uuid-1/tmdb-sync');
    expect(lastReq?.bodyJson).toEqual({
      type: 'tv',
      tmdbId: 1399,
      includeSpecials: true,
    });
    expect(res.id).toBe('series-uuid-1');
    expect(res.tmdbSyncStatus).toBe('SYNCED');
  });

  it('syncSeriesTmdb throws error when backend API fails', async () => {
    mockFetch.post(
      '/api/series/:id/tmdb-sync',
      errorResponse('Series not found', 404, { code: 'NOT_FOUND' })
    );

    await expect(
      syncSeriesTmdb('series-uuid-1', {
        type: 'tv',
        tmdbId: 1399,
      })
    ).rejects.toThrow('Series not found');
  });

  it('fetchSeriesTmdbPreview gets preview data from /series/tmdb-preview', async () => {
    const mockData = {
      data: {
        title: 'TMDB Show',
        overview: 'Show overview',
        posterUrl: 'https://image.tmdb.org/t/p/w500/poster.jpg',
        backdropUrl: 'https://image.tmdb.org/t/p/w500/backdrop.jpg',
        releaseDate: '2022-01-01',
        genres: ['Action', 'Drama'],
        status: 'Returning Series',
        totalSeasons: 2,
        totalEpisodes: 20,
        seasons: [
          {
            seasonNumber: 1,
            name: 'Season 1',
            episodeCount: 10,
            posterUrl: null,
          },
          {
            seasonNumber: 2,
            name: 'Season 2',
            episodeCount: 10,
            posterUrl: null,
          },
        ],
      },
    };

    mockFetch.get('/api/series/tmdb-preview', mockData);

    const res = await fetchSeriesTmdbPreview('tv', 1399, true);

    const lastReq = mockFetch.lastRequest();
    expect(lastReq?.url.pathname).toContain('/series/tmdb-preview');
    expect(lastReq?.url.searchParams.get('type')).toBe('tv');
    expect(lastReq?.url.searchParams.get('tmdbId')).toBe('1399');
    expect(lastReq?.url.searchParams.get('includeSpecials')).toBe('true');
    expect(res.title).toBe('TMDB Show');
    expect(res.totalSeasons).toBe(2);
    expect(res.seasons).toHaveLength(2);
  });

  it('fetchSeriesTmdbSyncPreview gets preview data from /series/:id/tmdb-sync-preview', async () => {
    const mockData = {
      data: {
        seriesId: 'series-uuid-1',
        seriesUpdated: true,
        series: {
          title: 'TMDB Synced Show',
          overview: 'Show overview',
          posterUrl: 'https://image.tmdb.org/t/p/w500/poster.jpg',
          backdropUrl: 'https://image.tmdb.org/t/p/w500/backdrop.jpg',
          rating: '8.5',
          releaseDate: '2022-01-01',
          genres: ['Action', 'Drama'],
          status: 'Returning Series',
        },
        totalNewEpisodes: 1,
        totalNewSeasons: 0,
        totalUpdatedEpisodes: 1,
        seasonDiffs: [
          {
            seasonNumber: 1,
            name: 'Season 1',
            incomingEpisodeCount: 11,
            localEpisodeCount: 10,
            diff: 1,
            isNewSeason: false,
            badgeText: '+1 new ep (10 → 11)',
            badgeType: 'new-eps',
          },
        ],
        episodeChanges: [
          {
            seasonNumber: 1,
            episodeNumber: 1,
            oldTitle: 'Episode 1',
            newTitle: 'Episode 1: Pilot',
            oldOverview: 'Old overview',
            newOverview: 'New overview',
            oldThumbnailUrl: null,
            newThumbnailUrl: 'https://image.tmdb.org/t/p/w500/ep1.jpg',
            oldAirDate: '2022-01-01',
            newAirDate: '2022-01-01',
            titleChanged: true,
            overviewChanged: true,
            thumbnailChanged: true,
            airDateChanged: false,
          },
        ],
      },
    };

    mockFetch.get('/api/series/:id/tmdb-sync-preview', mockData);

    const res = await fetchSeriesTmdbSyncPreview('series-uuid-1', {
      type: 'tv',
      tmdbId: 1399,
      includeSpecials: false,
    });

    const lastReq = mockFetch.lastRequest();
    expect(lastReq?.url.pathname).toContain(
      '/series/series-uuid-1/tmdb-sync-preview'
    );
    expect(lastReq?.url.searchParams.get('type')).toBe('tv');
    expect(lastReq?.url.searchParams.get('tmdbId')).toBe('1399');
    expect(res.seriesId).toBe('series-uuid-1');
    expect(res.seriesUpdated).toBe(true);
    expect(res.totalNewEpisodes).toBe(1);
    expect(res.totalUpdatedEpisodes).toBe(1);
    expect(res.episodeChanges).toHaveLength(1);
    expect(res.episodeChanges[0].titleChanged).toBe(true);
  });
});
