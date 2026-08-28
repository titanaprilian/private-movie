import { describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { getSeriesWithEpisodesQueryOptions } from '@/modules/watch/internal/api';
import { useWatchState } from '@/modules/watch/internal/useWatchState';
import { api } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  api: {
    series: {
      get: vi.fn(),
    },
  },
}));

const mockSeriesData = {
  id: 'series-1',
  title: 'Test Series',
  description: 'A test series description',
  posterUrl: 'https://example.com/poster.jpg',
  seasons: [
    {
      id: 'season-1',
      seriesId: 'series-1',
      title: 'Season 1',
      episodes: [
        {
          id: 'ep-1',
          title: 'Episode 1',
          order: 1,
          seasonId: 'season-1',
          videoSources: [
            { id: 'src-1', type: 'embed' as const, url: 'https://embed.com/1', label: 'Server 1' },
            { id: 'src-2', type: 'embed' as const, url: 'https://embed.com/2', label: 'Server 2' },
          ],
        },
        {
          id: 'ep-2',
          title: 'Episode 2',
          order: 2,
          seasonId: 'season-1',
          videoSources: [
            { id: 'src-3', type: 'embed' as const, url: 'https://embed.com/3', label: 'Server 1' },
          ],
        },
      ],
    },
    {
      id: 'season-2',
      seriesId: 'series-1',
      title: 'Season 2',
      episodes: [
        {
          id: 'ep-3',
          title: 'Episode 3',
          order: 1,
          seasonId: 'season-2',
          videoSources: [
            { id: 'src-4', type: 'embed' as const, url: 'https://embed.com/4', label: 'Server 1' },
          ],
        },
      ],
    },
  ],
  episodes: [
    {
      id: 'ep-1',
      title: 'Episode 1',
      order: 1,
      seasonId: 'season-1',
      videoSources: [
        { id: 'src-1', type: 'embed' as const, url: 'https://embed.com/1', label: 'Server 1' },
        { id: 'src-2', type: 'embed' as const, url: 'https://embed.com/2', label: 'Server 2' },
      ],
    },
    {
      id: 'ep-2',
      title: 'Episode 2',
      order: 2,
      seasonId: 'season-1',
      videoSources: [
        { id: 'src-3', type: 'embed' as const, url: 'https://embed.com/3', label: 'Server 1' },
      ],
    },
    {
      id: 'ep-3',
      title: 'Episode 3',
      order: 1,
      seasonId: 'season-2',
      videoSources: [
        { id: 'src-4', type: 'embed' as const, url: 'https://embed.com/4', label: 'Server 1' },
      ],
    },
  ],
};

describe('getSeriesWithEpisodesQueryOptions', () => {
  it('creates query options with correct queryKey and enabled property', () => {
    const options = getSeriesWithEpisodesQueryOptions('series-1');

    expect(options.queryKey).toEqual(['watch', 'series', 'series-1']);
    expect(options.enabled).toBe(true);

    const disabledOptions = getSeriesWithEpisodesQueryOptions('');
    expect(disabledOptions.enabled).toBe(false);
  });

  it('fetches series detail when queryFn is executed', async () => {
    const mockGet = vi.fn().mockResolvedValue({
      data: { data: mockSeriesData },
    });
    (api.series as unknown as Record<string, { get: typeof mockGet }>)[
      'series-1'
    ] = { get: mockGet };

    const options = getSeriesWithEpisodesQueryOptions('series-1');
    const result = await options.queryFn!({
      queryKey: options.queryKey,
      meta: undefined,
      signal: new AbortController().signal,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client: undefined as any,
    });

    expect(mockGet).toHaveBeenCalled();
    expect(result).toEqual(mockSeriesData);
  });
});

describe('useWatchState hook', () => {
  it('handles null or undefined series gracefully', () => {
    const { result } = renderHook(() => useWatchState(undefined));

    expect(result.current.activeSeasonId).toBeNull();
    expect(result.current.activeEpisodeId).toBeNull();
    expect(result.current.activeSourceIndex).toBe(0);
    expect(result.current.activeSeason).toBeNull();
    expect(result.current.activeEpisode).toBeNull();
    expect(result.current.activeSource).toBeNull();
    expect(result.current.availableEpisodes).toEqual([]);
    expect(result.current.hasNextEpisode).toBe(false);
    expect(result.current.hasPrevEpisode).toBe(false);
  });

  it('initializes defaults to first season, first episode, and first source', () => {
    const { result } = renderHook(() => useWatchState(mockSeriesData));

    expect(result.current.activeSeasonId).toBe('season-1');
    expect(result.current.activeEpisodeId).toBe('ep-1');
    expect(result.current.activeSourceIndex).toBe(0);
    expect(result.current.activeSeason?.id).toBe('season-1');
    expect(result.current.activeEpisode?.id).toBe('ep-1');
    expect(result.current.activeSource?.id).toBe('src-1');
    expect(result.current.availableEpisodes).toHaveLength(2);
    expect(result.current.hasNextEpisode).toBe(true);
    expect(result.current.hasPrevEpisode).toBe(false);
  });

  it('supports initial state option overrides', () => {
    const { result } = renderHook(() =>
      useWatchState(mockSeriesData, {
        initialEpisodeId: 'ep-3',
        initialSourceIndex: 0,
      })
    );

    expect(result.current.activeSeasonId).toBe('season-2');
    expect(result.current.activeEpisodeId).toBe('ep-3');
    expect(result.current.activeSourceIndex).toBe(0);
    expect(result.current.activeSeason?.id).toBe('season-2');
    expect(result.current.activeEpisode?.id).toBe('ep-3');
    expect(result.current.availableEpisodes).toHaveLength(1);
    expect(result.current.hasNextEpisode).toBe(false);
    expect(result.current.hasPrevEpisode).toBe(false);
  });

  it('changes season and updates episode list & defaults to first episode of new season', () => {
    const { result } = renderHook(() => useWatchState(mockSeriesData));

    act(() => {
      result.current.selectSeason('season-2');
    });

    expect(result.current.activeSeasonId).toBe('season-2');
    expect(result.current.activeEpisodeId).toBe('ep-3');
    expect(result.current.activeSourceIndex).toBe(0);
    expect(result.current.availableEpisodes).toHaveLength(1);
    expect(result.current.availableEpisodes[0].id).toBe('ep-3');
  });

  it('changes episode within same season and resets source index', () => {
    const { result } = renderHook(() => useWatchState(mockSeriesData));

    act(() => {
      result.current.selectSource(1);
    });
    expect(result.current.activeSourceIndex).toBe(1);

    act(() => {
      result.current.selectEpisode('ep-2');
    });

    expect(result.current.activeSeasonId).toBe('season-1');
    expect(result.current.activeEpisodeId).toBe('ep-2');
    expect(result.current.activeSourceIndex).toBe(0);
    expect(result.current.activeSource?.id).toBe('src-3');
  });

  it('changes episode in another season and updates activeSeasonId automatically', () => {
    const { result } = renderHook(() => useWatchState(mockSeriesData));

    act(() => {
      result.current.selectEpisode('ep-3');
    });

    expect(result.current.activeSeasonId).toBe('season-2');
    expect(result.current.activeEpisodeId).toBe('ep-3');
    expect(result.current.activeSourceIndex).toBe(0);
  });

  it('changes mirror video source index', () => {
    const { result } = renderHook(() => useWatchState(mockSeriesData));

    expect(result.current.activeSource?.id).toBe('src-1');

    act(() => {
      result.current.selectSource(1);
    });

    expect(result.current.activeSourceIndex).toBe(1);
    expect(result.current.activeSource?.id).toBe('src-2');
  });

  it('navigates to next and previous episode within current available episodes', () => {
    const { result } = renderHook(() => useWatchState(mockSeriesData));

    expect(result.current.activeEpisodeId).toBe('ep-1');
    expect(result.current.hasNextEpisode).toBe(true);
    expect(result.current.hasPrevEpisode).toBe(false);

    act(() => {
      result.current.selectSource(1);
      result.current.goToNextEpisode();
    });

    expect(result.current.activeEpisodeId).toBe('ep-2');
    expect(result.current.activeSourceIndex).toBe(0);
    expect(result.current.hasNextEpisode).toBe(false);
    expect(result.current.hasPrevEpisode).toBe(true);

    act(() => {
      result.current.goToPrevEpisode();
    });

    expect(result.current.activeEpisodeId).toBe('ep-1');
    expect(result.current.hasNextEpisode).toBe(true);
    expect(result.current.hasPrevEpisode).toBe(false);
  });

  it('handles series with no seasons cleanly', () => {
    const seriesWithoutSeasons = {
      id: 'series-2',
      title: 'Flat Series',
      episodes: [
        {
          id: 'ep-flat-1',
          title: 'Flat Ep 1',
          videoSources: [{ id: 'src-f1', type: 'embed' as const, url: 'http://f1', label: 'S1' }],
        },
        {
          id: 'ep-flat-2',
          title: 'Flat Ep 2',
          videoSources: [{ id: 'src-f2', type: 'embed' as const, url: 'http://f2', label: 'S1' }],
        },
      ],
    };

    const { result } = renderHook(() => useWatchState(seriesWithoutSeasons));

    expect(result.current.activeSeasonId).toBeNull();
    expect(result.current.activeEpisodeId).toBe('ep-flat-1');
    expect(result.current.availableEpisodes).toHaveLength(2);
    expect(result.current.hasNextEpisode).toBe(true);

    act(() => {
      result.current.goToNextEpisode();
    });

    expect(result.current.activeEpisodeId).toBe('ep-flat-2');
  });
});
