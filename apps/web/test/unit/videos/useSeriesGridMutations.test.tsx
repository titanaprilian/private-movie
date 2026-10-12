import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  createTestQueryClient,
  renderHook,
  act,
  waitFor,
} from '../../utils';
import { useSeriesGridMutations } from '@/modules/videos/internal/catalog/hooks/useSeriesGridMutations';
import { updateSeries, deleteSeries } from '@/modules/videos/internal/api';
import type { SeriesItem } from '@/modules/videos/internal/api';

vi.mock('@/modules/videos/internal/api', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/modules/videos/internal/api')>();
  return {
    ...mod,
    updateSeries: vi.fn().mockResolvedValue({ id: 'series-1' }),
    deleteSeries: vi.fn().mockResolvedValue({ id: 'series-1' }),
  };
});

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const mockNavigate = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
}));

const seriesItem = (overrides: Partial<SeriesItem> = {}): SeriesItem =>
  ({
    id: 'series-1',
    title: 'Solo Leveling',
    isFeatured: false,
    isOngoingHighlighted: false,
    ...overrides,
  }) as SeriesItem;

function setup(
  options: Partial<Parameters<typeof useSeriesGridMutations>[0]> = {},
) {
  mockNavigate.mockReset();
  vi.clearAllMocks();
  const queryClient = createTestQueryClient();
  // Keep unobserved seed entries alive for optimistic-cache assertions.
  queryClient.setDefaultOptions({ queries: { retry: false, gcTime: 60_000 } });
  const setDeletingSeries = vi.fn();
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const utils = renderHook(
    () =>
      useSeriesGridMutations({
        seriesList: [seriesItem()],
        currentPage: 1,
        activeTab: 'all',
        setDeletingSeries,
        ...options,
      }),
    { wrapper },
  );
  return { ...utils, queryClient, setDeletingSeries };
}

describe('useSeriesGridMutations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockReset();
  });

  it('deletes a series, invalidates cache, and clears the dialog', async () => {
    const { result, queryClient } = setup();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    act(() => {
      result.current.deleteMutation.mutate('series-1');
    });

    await waitFor(() => expect(deleteSeries).toHaveBeenCalledWith('series-1'));
    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['series'] }),
    );
  });

  it('steps back a page when deleting the sole item on page > 1', async () => {
    const { result, setDeletingSeries } = setup({
      seriesList: [seriesItem()],
      currentPage: 2,
    });

    act(() => {
      result.current.deleteMutation.mutate('series-1');
    });

    await waitFor(() => expect(deleteSeries).toHaveBeenCalledWith('series-1'));
    await waitFor(() => expect(setDeletingSeries).toHaveBeenCalledWith(null));
    expect(mockNavigate).toHaveBeenCalledWith({
      search: expect.any(Function),
    });
    const searchFn = mockNavigate.mock.calls[0][0].search;
    expect(searchFn({ page: 2 })).toEqual({ page: 1 });
  });

  it('does not navigate when deleting from page 1', async () => {
    const { result } = setup({ seriesList: [seriesItem()], currentPage: 1 });

    act(() => {
      result.current.deleteMutation.mutate('series-1');
    });

    await waitFor(() => expect(deleteSeries).toHaveBeenCalledWith('series-1'));
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('toggles featured status via updateSeries without touching the router', async () => {
    const { result } = setup();

    act(() => {
      result.current.handleToggleFeatured(seriesItem({ isFeatured: false }));
    });

    await waitFor(() =>
      expect(updateSeries).toHaveBeenCalledWith('series-1', { isFeatured: true }),
    );
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('optimistically removes the card from cache on the featured tab', async () => {
    const { result, queryClient } = setup({ activeTab: 'featured' });
    let resolveUpdate!: (value: unknown) => void;
    vi.mocked(updateSeries).mockImplementationOnce(
      () =>
        new Promise<unknown>((resolve) => {
          resolveUpdate = resolve;
        }) as Promise<never>,
    );
    queryClient.setQueryData(['series', 'featured'], {
      series: [seriesItem({ isFeatured: true }), seriesItem({ id: 'series-2' })],
      meta: { total: 2, page: 1, limit: 12 },
    });

    act(() => {
      result.current.handleToggleFeatured(
        seriesItem({ isFeatured: true }),
      );
    });

    // While the mutation is still pending, the optimistic write applies.
    await waitFor(() =>
      expect(updateSeries).toHaveBeenCalledWith('series-1', { isFeatured: false }),
    );
    const cached = queryClient.getQueryData<{
      series: SeriesItem[];
      meta: { total: number };
    }>(['series', 'featured']);
    expect(cached?.series.map((s) => s.id)).toEqual(['series-2']);
    expect(cached?.meta.total).toBe(1);

    act(() => {
      resolveUpdate({ id: 'series-1' });
    });
  });

  it('toggles highlight with event suppression via updateSeries', async () => {
    const { result } = setup();
    const preventDefault = vi.fn();
    const stopPropagation = vi.fn();

    act(() => {
      result.current.handleToggleHighlight(
        seriesItem({ isOngoingHighlighted: false }),
        { preventDefault, stopPropagation } as unknown as React.MouseEvent,
      );
    });

    expect(preventDefault).toHaveBeenCalled();
    expect(stopPropagation).toHaveBeenCalled();
    await waitFor(() =>
      expect(updateSeries).toHaveBeenCalledWith('series-1', {
        isOngoingHighlighted: true,
      }),
    );
  });
});
