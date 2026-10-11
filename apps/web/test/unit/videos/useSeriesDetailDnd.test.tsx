import { createTestQueryClient, renderHook, waitFor, act } from '../../utils';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { useSeriesDetailDnd } from '@/modules/videos/internal/catalog/hooks/useSeriesDetailDnd';
import type { SeriesDetailEpisode } from '@/modules/videos/internal/catalog/hooks/useSeriesDetail';
import type { SeasonDetails } from '@/modules/videos/internal/api';
import { setAccessToken } from '@/lib/api';
import { toast } from 'sonner';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

function makeEpisode(
  id: string,
  seasonId: string | null,
  order: number
): SeriesDetailEpisode {
  return { id, seasonId, order, title: id } as SeriesDetailEpisode;
}

const seasonA = { id: 'season-a', title: 'Season 1' } as SeasonDetails;
const seasonB = { id: 'season-b', title: 'Season 2' } as SeasonDetails;

function setup(
  episodes: SeriesDetailEpisode[],
  seasons: SeasonDetails[] = [seasonA],
  activeSeason: SeasonDetails | null = seasonA,
  selectedEpisodeIds: string[] = []
) {
  const queryClient = createTestQueryClient();
  const onCloseMoveDialog = vi.fn();
  const onBulkMoveSuccess = vi.fn();
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const utils = renderHook(
    ({
      serverEpisodes,
      selected,
    }: {
      serverEpisodes: SeriesDetailEpisode[];
      selected: string[];
    }) =>
      useSeriesDetailDnd({
        seriesId: 'series-1',
        serverEpisodes,
        seasons,
        activeSeason,
        selectedEpisodeIds: selected,
        onCloseMoveDialog,
        onBulkMoveSuccess,
      }),
    { wrapper, initialProps: { serverEpisodes: episodes, selected: selectedEpisodeIds } }
  );
  return { ...utils, onCloseMoveDialog, onBulkMoveSuccess };
}

describe('useSeriesDetailDnd', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAccessToken('test-token');
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : (input as Request).url;
      const method = init?.method?.toUpperCase() ?? 'GET';

      if (url.includes('/series/series-1/episodes/order') && method === 'PATCH') {
        return new Response(JSON.stringify({ data: { success: true } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ error: { code: 'NOT_FOUND' } }), {
        status: 404,
      });
    });
  });

  it('syncs local episode state from server episodes', async () => {
    const { result } = setup([
      makeEpisode('e1', 'season-a', 1),
      makeEpisode('e2', 'season-a', 2),
    ]);

    await waitFor(() => {
      expect(result.current.localEpisodes.map((e) => e.id)).toEqual(['e1', 'e2']);
    });
  });

  it('reorders within a season and persists the new order', async () => {
    let patchedBody: unknown = null;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : (input as Request).url;
      if (url.includes('/series/series-1/episodes/order')) {
        patchedBody = JSON.parse(init?.body as string);
        return new Response(JSON.stringify({ data: { success: true } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: { code: 'NOT_FOUND' } }), {
        status: 404,
      });
    });

    const { result } = setup([
      makeEpisode('e1', 'season-a', 1),
      makeEpisode('e2', 'season-a', 2),
      makeEpisode('e3', 'season-a', 3),
    ]);

    await waitFor(() => {
      expect(result.current.localEpisodes).toHaveLength(3);
    });

    act(() => {
      result.current.handleDragEnd({
        draggableId: 'e1',
        source: { index: 0, droppableId: 'episode-list' },
        destination: { index: 2, droppableId: 'episode-list' },
      } as unknown as Parameters<typeof result.current.handleDragEnd>[0]);
    });

    // Positions in local state are stable; the reorder is expressed through
    // the per-episode `order` values (the table renders sorted by order).
    const byId = Object.fromEntries(
      result.current.localEpisodes.map((e) => [e.id, e.order])
    );
    expect(byId).toEqual({ e1: 3, e2: 1, e3: 2 });

    await waitFor(() => {
      expect(patchedBody).toEqual([
        { id: 'e2', order: 1 },
        { id: 'e3', order: 2 },
        { id: 'e1', order: 3 },
      ]);
    });
  });

  it('ignores drops without a destination and no-op reorders', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { result } = setup([
      makeEpisode('e1', 'season-a', 1),
      makeEpisode('e2', 'season-a', 2),
    ]);

    await waitFor(() => {
      expect(result.current.localEpisodes).toHaveLength(2);
    });
    fetchSpy.mockClear();

    act(() => {
      result.current.handleDragEnd({
        draggableId: 'e1',
        source: { index: 0, droppableId: 'episode-list' },
        destination: null,
      } as unknown as Parameters<typeof result.current.handleDragEnd>[0]);
    });

    act(() => {
      result.current.handleDragEnd({
        draggableId: 'e1',
        source: { index: 0, droppableId: 'episode-list' },
        destination: { index: 0, droppableId: 'episode-list' },
      } as unknown as Parameters<typeof result.current.handleDragEnd>[0]);
    });

    expect(result.current.localEpisodes.map((e) => e.id)).toEqual(['e1', 'e2']);
    expect(result.current.localEpisodes.map((e) => e.order)).toEqual([1, 2]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('moves an episode across seasons when dropped on a season tab', async () => {
    let patchedBody: unknown = null;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : (input as Request).url;
      if (url.includes('/series/series-1/episodes/order')) {
        patchedBody = JSON.parse(init?.body as string);
        return new Response(JSON.stringify({ data: { success: true } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: { code: 'NOT_FOUND' } }), {
        status: 404,
      });
    });

    const { result } = setup(
      [
        makeEpisode('e1', 'season-a', 1),
        makeEpisode('e2', 'season-b', 1),
      ],
      [seasonA, seasonB],
      seasonA
    );

    await waitFor(() => {
      expect(result.current.localEpisodes).toHaveLength(2);
    });

    act(() => {
      result.current.handleDragEnd({
        draggableId: 'e1',
        source: { index: 0, droppableId: 'episode-list' },
        destination: { index: 0, droppableId: 'season-tab-season-b' },
      } as unknown as Parameters<typeof result.current.handleDragEnd>[0]);
    });

    await waitFor(() => {
      expect(patchedBody).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'e1', seasonId: 'season-b' }),
        ])
      );
    });
    const moved = result.current.localEpisodes.find((e) => e.id === 'e1');
    expect(moved?.seasonId).toBe('season-b');
  });

  it('bulk-moves selected episodes and notifies on success', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : (input as Request).url;
      if (url.includes('/series/series-1/episodes/order')) {
        return new Response(JSON.stringify({ data: { success: true } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: { code: 'NOT_FOUND' } }), {
        status: 404,
      });
    });

    const { result, onCloseMoveDialog, onBulkMoveSuccess } = setup(
      [
        makeEpisode('e1', 'season-a', 1),
        makeEpisode('e2', 'season-a', 2),
        makeEpisode('e3', 'season-b', 1),
      ],
      [seasonA, seasonB],
      seasonA,
      ['e1', 'e2']
    );

    await waitFor(() => {
      expect(result.current.localEpisodes).toHaveLength(3);
    });

    act(() => {
      result.current.handleBulkMoveEpisodes('season-b');
    });

    await waitFor(() => {
      expect(onBulkMoveSuccess).toHaveBeenCalled();
    });
    expect(onCloseMoveDialog).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Moved'));
  });

  it('closes the move dialog without side effects when there is nothing to move', async () => {
    const { result, onCloseMoveDialog, onBulkMoveSuccess } = setup(
      [makeEpisode('e1', 'season-a', 1)],
      [seasonA],
      seasonA,
      []
    );

    await waitFor(() => {
      expect(result.current.localEpisodes).toHaveLength(1);
    });

    act(() => {
      result.current.handleBulkMoveEpisodes('season-a');
    });

    expect(onCloseMoveDialog).toHaveBeenCalled();
    expect(onBulkMoveSuccess).not.toHaveBeenCalled();
  });

  it('filters season episodes and counts per season', async () => {
    const { result } = setup(
      [
        makeEpisode('e1', 'season-a', 1),
        makeEpisode('e2', 'season-a', 2),
        makeEpisode('e3', 'season-b', 1),
      ],
      [seasonA, seasonB],
      seasonB
    );

    await waitFor(() => {
      expect(result.current.localEpisodes).toHaveLength(3);
    });

    expect(result.current.seasonEpisodes.map((e) => e.id)).toEqual(['e3']);
    expect(result.current.episodeCountBySeason).toEqual({
      'season-a': 2,
      'season-b': 1,
    });
  });
});
