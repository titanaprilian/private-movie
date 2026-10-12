import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  createTestQueryClient,
  renderHook,
  act,
  waitFor,
} from '../../utils';
import { useSeriesGridSearch } from '@/modules/videos/internal/catalog/hooks/useSeriesGridSearch';
import { SERIES_PAGE_LIMIT } from '@/modules/videos/internal/api';

const mockNavigate = vi.fn();
let mockSearchState: Record<string, unknown> = { page: 1 };

vi.mock('@tanstack/react-router', () => ({
  useSearch: () => mockSearchState,
  useNavigate: () => mockNavigate,
}));

function setup(searchState: Record<string, unknown> = { page: 1 }) {
  mockSearchState = searchState;
  mockNavigate.mockReset();
  const queryClient = createTestQueryClient();
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { ...renderHook(() => useSeriesGridSearch(), { wrapper }), queryClient };
}

describe('useSeriesGridSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('derives currentPage, defaulting invalid pages to 1', () => {
    const { result } = setup({ page: 3 });
    expect(result.current.currentPage).toBe(3);
    expect(result.current.queryParams.page).toBe(3);
    expect(result.current.queryParams.limit).toBe(SERIES_PAGE_LIMIT);
  });

  it('falls back to page 1 for missing or invalid page params', () => {
    const { result: r1 } = setup({});
    expect(r1.current.currentPage).toBe(1);
    const { result: r2 } = setup({ page: -2 });
    expect(r2.current.currentPage).toBe(1);
  });

  it('derives activeTab, highlightedOnly, and selectedSlugs from search state', () => {
    const { result } = setup({
      page: 1,
      tab: 'featured',
      highlighted: true,
      genre: 'action,sci-fi',
    });
    expect(result.current.activeTab).toBe('featured');
    expect(result.current.highlightedOnly).toBe(true);
    expect(result.current.selectedSlugs).toEqual(['action', 'sci-fi']);
  });

  it('defaults activeTab to all and highlightedOnly to false', () => {
    const { result } = setup({ page: 1 });
    expect(result.current.activeTab).toBe('all');
    expect(result.current.highlightedOnly).toBe(false);
    expect(result.current.selectedSlugs).toEqual([]);
  });

  it('navigates with tab change, resetting page to 1 and clearing tab for all', () => {
    const { result } = setup({ page: 2, q: 'x', tab: 'ongoing' });
    act(() => {
      result.current.handleTabChange('all');
    });
    expect(mockNavigate).toHaveBeenCalledWith({
      search: expect.any(Function),
    });
    const searchFn = mockNavigate.mock.calls[0][0].search;
    expect(searchFn({ page: 2, q: 'x', tab: 'ongoing' })).toEqual({
      page: 1,
      q: 'x',
      tab: undefined,
    });
  });

  it('toggles genre slugs and clears the param when empty', () => {
    const { result } = setup({ page: 2, genre: 'action' });
    act(() => {
      result.current.handleToggleGenre('sci-fi');
    });
    let searchFn = mockNavigate.mock.calls[0][0].search;
    expect(searchFn({})).toEqual({ genre: 'action,sci-fi', page: 1 });

    mockNavigate.mockReset();
    act(() => {
      result.current.handleGenreSelectionChange([]);
    });
    searchFn = mockNavigate.mock.calls[0][0].search;
    expect(searchFn({ genre: 'action', page: 2 })).toEqual({
      genre: undefined,
      page: 1,
    });
  });

  it('toggles highlightedOnly and resets page', () => {
    const { result } = setup({ page: 2 });
    act(() => {
      result.current.handleToggleHighlightedOnly();
    });
    const searchFn = mockNavigate.mock.calls[0][0].search;
    expect(searchFn({ page: 2 })).toEqual({ page: 1, highlighted: true });
  });

  it('debounces search input navigation and syncs external q changes', () => {
    vi.useFakeTimers();
    const { result, rerender } = setup({ page: 1 });
    expect(result.current.inputValue).toBe('');

    act(() => {
      result.current.setInputValue('Solo');
    });
    expect(mockNavigate).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(mockNavigate).toHaveBeenCalledWith({
      search: expect.any(Function),
      replace: true,
    });
    const searchFn = mockNavigate.mock.calls[0][0].search;
    expect(searchFn({})).toEqual({ q: 'Solo', page: 1 });

    // External URL change syncs the input without navigating.
    mockNavigate.mockReset();
    mockSearchState = { page: 1, q: 'Frieren' };
    rerender();
    expect(result.current.inputValue).toBe('Frieren');
    expect(mockNavigate).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('does not overwrite in-flight typing when search.q arrives late', () => {
    vi.useFakeTimers();
    const { result, rerender } = setup({ page: 1 });

    act(() => {
      result.current.setInputValue('Solo');
    });
    act(() => {
      vi.advanceTimersByTime(250);
    });
    act(() => {
      result.current.setInputValue('Solo Leveling');
    });

    mockSearchState = { page: 1, q: 'Solo' };
    rerender();
    expect(result.current.inputValue).toBe('Solo Leveling');

    vi.useRealTimers();
  });

  it('clamps out-of-bounds pages once bounds are synced', async () => {
    const { result } = setup({ page: 5 });
    act(() => {
      result.current.syncPageBounds(2, SERIES_PAGE_LIMIT);
    });
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({
        search: expect.any(Function),
        replace: true,
      });
    });
    const searchFn = mockNavigate.mock.calls[0][0].search;
    expect(searchFn({ page: 5 })).toEqual({ page: 1 });
  });

  it('does not clamp when within bounds', () => {
    const { result } = setup({ page: 1 });
    act(() => {
      result.current.syncPageBounds(25, SERIES_PAGE_LIMIT);
    });
    expect(result.current.totalPages).toBe(3);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('goToPage navigates and scrolls to the grid top', () => {
    const scrollIntoViewMock = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;
    const { result } = setup({ page: 3 });

    // Attach the ref to a real element via the hook result.
    const div = document.createElement('div');
    Object.defineProperty(result.current.gridTopRef, 'current', {
      value: div,
      writable: true,
    });

    act(() => {
      result.current.goToPage(2);
    });
    const searchFn = mockNavigate.mock.calls[0][0].search;
    expect(searchFn({ page: 3 })).toEqual({ page: 2 });
    expect(scrollIntoViewMock).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'start',
    });
  });
});
