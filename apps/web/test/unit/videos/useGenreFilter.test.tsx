import { queryOptions } from '@tanstack/react-query';
import { createTestQueryClient, renderHook, screen, act, waitFor } from '../../utils';
import { renderWithProviders } from '../../utils';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import {
  formatGenreTriggerLabel,
  GENRE_FILTER_NO_HIGHLIGHT,
  useGenreFilter,
} from '@/modules/videos/internal/catalog/grid/hooks/useGenreFilter';
import { GenreFilter } from '@/modules/videos/internal/catalog/grid/components/GenreFilter';
import type { Genre } from '@/modules/genres';
import { useState } from 'react';

const { mockedFetchGenres } = vi.hoisted(() => ({
  mockedFetchGenres: vi.fn<() => Promise<Genre[]>>(),
}));

vi.mock('@/modules/genres', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/modules/genres')>();
  return {
    ...mod,
    genresQueryOptions: () =>
      queryOptions({ queryKey: ['genres'], queryFn: () => mockedFetchGenres() }),
  };
});

const mockGenres: Genre[] = [
  { id: 'g-1', name: 'Action', slug: 'action', isBigGenre: true, displayOrder: 0 },
  { id: 'g-2', name: 'Comedy', slug: 'comedy', isBigGenre: false, displayOrder: 1 },
  { id: 'g-3', name: 'Drama', slug: 'drama', isBigGenre: false, displayOrder: 2 },
];

function renderFilterHook(selectedSlugs: string[] = [], onSelectionChange = vi.fn()) {
  mockedFetchGenres.mockResolvedValue(mockGenres);
  const queryClient = createTestQueryClient();
  const result = renderHook(() => useGenreFilter({ selectedSlugs, onSelectionChange }), {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });
  return { ...result, queryClient };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('formatGenreTriggerLabel', () => {
  it('returns default, single, and multi labels', () => {
    const names = new Map([['action', 'Action']]);
    expect(formatGenreTriggerLabel([], names)).toBe('Filter by genre');
    expect(formatGenreTriggerLabel(['action'], names)).toBe('Action');
    expect(formatGenreTriggerLabel(['unknown'], names)).toBe('unknown');
    expect(formatGenreTriggerLabel(['a', 'b'], names)).toBe('2 genres');
  });
});

describe('useGenreFilter hook', () => {
  it('exposes default closed state with sentinel highlight', async () => {
    const { result } = renderFilterHook();
    await waitFor(() => {
      expect(result.current.genres).toHaveLength(3);
    });
    expect(result.current.open).toBe(false);
    expect(result.current.search).toBe('');
    expect(result.current.highlight).toBe(GENRE_FILTER_NO_HIGHLIGHT);
    expect(result.current.isActive).toBe(false);
    expect(result.current.triggerLabel).toBe('Filter by genre');
  });

  it('toggles selection add/remove via callback', async () => {
    const onChange = vi.fn();
    const { result } = renderFilterHook([], onChange);
    await waitFor(() => {
      expect(result.current.genres).toHaveLength(3);
    });
    act(() => {
      result.current.toggleGenre('action');
    });
    expect(onChange).toHaveBeenCalledWith(['action']);

    const onChange2 = vi.fn();
    const { result: r2 } = renderFilterHook(['action'], onChange2);
    await waitFor(() => {
      expect(r2.current.genres).toHaveLength(3);
    });
    act(() => {
      r2.current.toggleGenre('action');
    });
    expect(onChange2).toHaveBeenCalledWith([]);
  });

  it('filters visibleGenres by search text', async () => {
    const { result } = renderFilterHook();
    await waitFor(() => {
      expect(result.current.genres).toHaveLength(3);
    });
    act(() => {
      result.current.handleSearchChange('com');
    });
    expect(result.current.visibleGenres.map((g) => g.slug)).toEqual(['comedy']);
  });

  it('resets search/highlight on open and closes on done', async () => {
    const { result } = renderFilterHook();
    await waitFor(() => {
      expect(result.current.genres).toHaveLength(3);
    });
    act(() => {
      result.current.handleSearchChange('com');
      result.current.handleHighlightChange('comedy');
    });
    act(() => {
      result.current.handleOpenChange(true);
    });
    expect(result.current.open).toBe(true);
    expect(result.current.search).toBe('');
    expect(result.current.highlight).toBe(GENRE_FILTER_NO_HIGHLIGHT);
    act(() => {
      result.current.handleDone();
    });
    expect(result.current.open).toBe(false);
  });

  it('clears all via handleClear', async () => {
    const onChange = vi.fn();
    const { result } = renderFilterHook(['action', 'comedy'], onChange);
    await waitFor(() => {
      expect(result.current.genres).toHaveLength(3);
    });
    expect(result.current.isActive).toBe(true);
    expect(result.current.triggerLabel).toBe('2 genres');
    act(() => {
      result.current.handleClear();
    });
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('GenreFilter consumes the hook (smoke)', async () => {
    function Harness() {
      const [slugs, setSlugs] = useState<string[]>([]);
      return <GenreFilter selectedSlugs={slugs} onSelectionChange={setSlugs} />;
    }
    mockedFetchGenres.mockResolvedValue(mockGenres);
    const queryClient = createTestQueryClient();
    const { user } = renderWithProviders(<Harness />, { queryClient });
    const trigger = await screen.findByRole('combobox', { name: 'Filter by genre' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await user.click(trigger);
    expect(await screen.findByPlaceholderText('Search genres...')).toBeInTheDocument();
  });
});
