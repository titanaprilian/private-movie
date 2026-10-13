import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  createTestQueryClient,
  renderHook,
  act,
} from '../../utils';
import { useSeriesGrid } from '@/modules/videos/internal/catalog/grid/useSeriesGrid';
import {
  SERIES_PAGE_LIMIT,
  seriesListQueryOptions,
  type SeriesListResponse,
} from '@/modules/videos';
import { genresQueryOptions } from '@/modules/genres';
import { useScrapeWorkerStore } from '@/modules/videos/internal/store/useScrapeWorkerStore';

const mockNavigate = vi.fn();
let mockSearchState: Record<string, unknown> = { page: 1 };

vi.mock('@tanstack/react-router', () => ({
  useSearch: () => mockSearchState,
  useNavigate: () => mockNavigate,
}));

const mockSeriesResponse = {
  series: [
    {
      id: 'series-1',
      title: 'Solo Leveling',
      source: 'otakudesu',
      sourceUrl: 'https://otakudesu.cloud/anime/solo-leveling',
      description: 'Sung Jinwoo ascends.',
      posterUrl: 'https://example.com/solo-leveling.jpg',
      isFeatured: false,
      seasons: [],
      episodes: [{ id: 'ep-1', title: 'Episode 1' }],
      createdAt: '2025-01-12T00:00:00.000Z',
      updatedAt: '2025-01-12T00:00:00.000Z',
    },
  ],
  meta: { total: 1, page: 1, limit: SERIES_PAGE_LIMIT },
};

function setup(searchState: Record<string, unknown> = { page: 1 }) {
  mockSearchState = searchState;
  mockNavigate.mockReset();
  const queryClient = createTestQueryClient();
  queryClient.setDefaultOptions({
    queries: { retry: false, staleTime: Infinity },
  });
  queryClient.setQueryData(
    seriesListQueryOptions({ ...searchState, limit: SERIES_PAGE_LIMIT }).queryKey,
    mockSeriesResponse as unknown as SeriesListResponse,
  );
  queryClient.setQueryData(genresQueryOptions().queryKey, []);
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { ...renderHook(() => useSeriesGrid(), { wrapper }), queryClient };
}

describe('useSeriesGrid', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockReset();
    useScrapeWorkerStore.getState().reset();
    useScrapeWorkerStore.setState({ isOpen: false });
  });

  it('combines search state with fetched series data and meta', () => {
    const { result } = setup({ page: 1, q: 'leveling' });

    expect(result.current.seriesList).toHaveLength(1);
    expect(result.current.seriesList[0].id).toBe('series-1');
    expect(result.current.meta.total).toBe(1);
    expect(result.current.currentPage).toBe(1);
    expect(result.current.queryParams.q).toBe('leveling');
    expect(result.current.selectedSlugs).toEqual([]);
  });

  it('manages editing and deleting dialog state with event suppression', () => {
    const { result } = setup();
    const item = result.current.seriesList[0];
    const event = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as React.MouseEvent;

    expect(result.current.editingSeries).toBeNull();
    act(() => {
      result.current.handleOpenEdit(item, event);
    });
    expect(result.current.editingSeries?.id).toBe('series-1');
    expect(event.preventDefault).toHaveBeenCalled();

    act(() => {
      result.current.handleOpenDelete(item, event);
    });
    expect(result.current.deletingSeries?.id).toBe('series-1');

    act(() => {
      result.current.setDeletingSeries(null);
    });
    expect(result.current.deletingSeries).toBeNull();
  });

  it('exposes search handlers, mutations, and pagination navigation', () => {
    const { result } = setup({ page: 1 });

    expect(typeof result.current.handleTabChange).toBe('function');
    expect(typeof result.current.handleToggleGenre).toBe('function');
    expect(typeof result.current.handleToggleFeatured).toBe('function');
    expect(typeof result.current.handleToggleHighlight).toBe('function');
    expect(typeof result.current.goToPage).toBe('function');
    expect(result.current.deleteMutation.isPending).toBe(false);

    act(() => {
      result.current.goToPage(2);
    });
    const searchFn = mockNavigate.mock.calls[0][0].search;
    expect(searchFn({ page: 1 })).toEqual({ page: 2 });
  });
});
