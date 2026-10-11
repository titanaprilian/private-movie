import { createTestQueryClient, renderHook, waitFor, act } from '../../utils';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { useSeriesDrawerSync } from '@/modules/videos/internal/catalog/hooks/useSeriesDrawerSync';
import type { SeriesDetailEpisode } from '@/modules/videos/internal/catalog/hooks/useSeriesDetail';

const routerHoisted = vi.hoisted(() => ({
  searchParams: {} as Record<string, unknown>,
  navigateCalls: [] as unknown[],
}));

vi.mock('@tanstack/react-router', () => ({
  useSearch: () => routerHoisted.searchParams,
  useNavigate: () => {
    const navigate = (opts: unknown) => {
      routerHoisted.navigateCalls.push(opts);
    };
    return navigate;
  },
}));

function makeEpisode(id: string, order: number): SeriesDetailEpisode {
  return { id, seasonId: 'season-a', order, title: id } as SeriesDetailEpisode;
}

const episodes = [makeEpisode('e1', 1), makeEpisode('e2', 2), makeEpisode('e3', 3)];

function setup(
  localEpisodes = episodes,
  options: { initialEpisodeId?: string; initialOrder?: number } = {}
) {
  const queryClient = createTestQueryClient();
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(
    () =>
      useSeriesDrawerSync({
        localEpisodes,
        initialEpisodeId: options.initialEpisodeId,
        initialOrder: options.initialOrder,
      }),
    { wrapper }
  );
}

function applySearchUpdate(call: unknown, prev: Record<string, unknown>) {
  const opts = call as {
    search: (prev: Record<string, unknown>) => Record<string, unknown>;
  };
  return opts.search(prev);
}

describe('useSeriesDrawerSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routerHoisted.searchParams = {};
    routerHoisted.navigateCalls = [];
  });

  it('opens the drawer for the episode id from search params', async () => {
    routerHoisted.searchParams = { episodeId: 'e2' };
    const { result } = setup();

    await waitFor(() => {
      expect(result.current.selectedEpisodeId).toBe('e2');
    });
    expect(result.current.isDrawerOpen).toBe(true);
  });

  it('resolves the episode by numeric order from search params', async () => {
    routerHoisted.searchParams = { order: 3 };
    const { result } = setup();

    await waitFor(() => {
      expect(result.current.selectedEpisodeId).toBe('e3');
    });
    expect(result.current.isDrawerOpen).toBe(true);
  });

  it('falls back to initial props when search params are empty', async () => {
    const { result } = setup(episodes, { initialEpisodeId: 'e1' });

    await waitFor(() => {
      expect(result.current.selectedEpisodeId).toBe('e1');
    });
    expect(result.current.isDrawerOpen).toBe(true);
  });

  it('stays closed when params match no episode', async () => {
    routerHoisted.searchParams = { episodeId: 'missing' };
    const { result } = setup();

    // Mount effects flush synchronously; a non-matching id leaves state untouched.
    expect(result.current.selectedEpisodeId).toBeNull();
    expect(result.current.isDrawerOpen).toBe(false);
  });

  it('opens the drawer and syncs the url when an episode is selected', async () => {
    const { result } = setup();

    act(() => {
      result.current.handleOpenEpisodeDrawer(episodes[1]);
    });

    expect(result.current.selectedEpisodeId).toBe('e2');
    expect(result.current.isDrawerOpen).toBe(true);
    expect(routerHoisted.navigateCalls).toHaveLength(1);
    expect(
      applySearchUpdate(routerHoisted.navigateCalls[0], { foo: 'bar' })
    ).toEqual({ foo: 'bar', episodeId: 'e2', order: 2 });
  });

  it('clears url params when the drawer closes', async () => {
    const { result } = setup();

    act(() => {
      result.current.handleOpenEpisodeDrawer(episodes[0]);
    });
    expect(routerHoisted.navigateCalls).toHaveLength(1);

    act(() => {
      result.current.handleCloseEpisodeDrawer(false);
    });

    expect(result.current.isDrawerOpen).toBe(false);
    expect(routerHoisted.navigateCalls).toHaveLength(2);
    expect(
      applySearchUpdate(routerHoisted.navigateCalls[1], {
        episodeId: 'e1',
        order: 1,
        other: 'keep',
      })
    ).toEqual({ other: 'keep' });
  });
});
