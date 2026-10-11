import { createTestQueryClient, renderHook, waitFor, act } from '../../utils';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { useEditSeriesForm } from '@/modules/videos/internal/catalog/hooks/useEditSeriesForm';
import type { SeriesItem } from '@/modules/videos/internal/api';
import { setAccessToken } from '@/lib/api';
import { toast } from 'sonner';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

const mockSeries: SeriesItem = {
  id: 'series-1',
  sourceUrl: 'https://otakudesu.cloud/anime/series-1',
  source: 'otakudesu',
  title: 'Test Series',
  description: 'A test series.',
  posterUrl: 'https://example.com/poster.png',
  logoUrl: 'https://example.com/logo.png',
  isFeatured: true,
  isOngoingHighlighted: true,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
} as SeriesItem;

const genresPayload = {
  data: [
    { id: 'g-1', name: 'Action', slug: 'action' },
    { id: 'g-2', name: 'Sci-Fi', slug: 'sci-fi' },
  ],
};

function mockGenresFetch() {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : (input as Request).url;

    if (url.includes('/genres')) {
      return new Response(JSON.stringify(genresPayload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: { code: 'NOT_FOUND' } }), {
      status: 404,
    });
  });
}

function setup(
  props: Partial<Parameters<typeof useEditSeriesForm>[0]> = {},
  series: SeriesItem = mockSeries
) {
  const queryClient = createTestQueryClient();
  const onOpenChange = vi.fn();
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const utils = renderHook(
    (p: { open: boolean }) =>
      useEditSeriesForm({ open: p.open, series, onOpenChange, ...props }),
    { wrapper, initialProps: { open: true } }
  );
  return { ...utils, queryClient, onOpenChange };
}

describe('useEditSeriesForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAccessToken('test-token');
    mockGenresFetch();
  });

  it('initializes form state from the series on open', async () => {
    const { result } = setup();

    await waitFor(() => {
      expect(result.current.editTitle).toBe('Test Series');
    });
    expect(result.current.editDescription).toBe('A test series.');
    expect(result.current.editPosterUrl).toBe('https://example.com/poster.png');
    expect(result.current.editLogoUrl).toBe('https://example.com/logo.png');
    expect(result.current.editIsFeatured).toBe(true);
    expect(result.current.editIsOngoingHighlighted).toBe(true);
    expect(result.current.logoPreviewError).toBe(false);
  });

  it('uses genreIds directly when present on the series', async () => {
    const { result } = setup({}, { ...mockSeries, genreIds: ['g-1'] } as SeriesItem);

    await waitFor(() => {
      expect(result.current.selectedGenreIds).toEqual(['g-1']);
    });
  });

  it('maps string genres to ids via slug and name lookup', async () => {
    const { result } = setup(
      {},
      { ...mockSeries, genres: ['action', 'Sci-Fi'] } as unknown as SeriesItem
    );

    await waitFor(() => {
      expect(result.current.selectedGenreIds).toEqual(['g-1', 'g-2']);
    });
  });

  it('toggles genre selection without touching other state', async () => {
    const { result } = setup();

    await waitFor(() => {
      expect(result.current.genres).toHaveLength(2);
    });

    act(() => {
      result.current.toggleGenre('g-1');
    });
    expect(result.current.selectedGenreIds).toEqual(['g-1']);
    expect(result.current.editTitle).toBe('Test Series');

    act(() => {
      result.current.toggleGenre('g-2');
    });
    expect(result.current.selectedGenreIds).toEqual(['g-1', 'g-2']);

    act(() => {
      result.current.toggleGenre('g-1');
    });
    expect(result.current.selectedGenreIds).toEqual(['g-2']);
  });

  it('resets user edits on the closed → open transition', async () => {
    const { result, rerender } = setup();

    await waitFor(() => {
      expect(result.current.editTitle).toBe('Test Series');
    });

    act(() => {
      result.current.setEditTitle('User edited title');
    });
    expect(result.current.editTitle).toBe('User edited title');

    rerender({ open: false });
    rerender({ open: true });

    await waitFor(() => {
      expect(result.current.editTitle).toBe('Test Series');
    });
  });

  it('submits the mapped payload via PATCH, invalidates, toasts, and closes', async () => {
    let patchedBody: Record<string, unknown> | null = null;
    let patchedUrl = '';
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : (input as Request).url;
      const method = init?.method?.toUpperCase() ?? 'GET';

      if (url.includes('/genres')) {
        return new Response(JSON.stringify(genresPayload), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.includes('/series/series-1') && method === 'PATCH') {
        patchedUrl = url;
        patchedBody = JSON.parse(init?.body as string);
        return new Response(
          JSON.stringify({ data: { ...mockSeries, ...patchedBody } }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(JSON.stringify({ error: { code: 'NOT_FOUND' } }), {
        status: 404,
      });
    });

    const { result, queryClient, onOpenChange } = setup();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await waitFor(() => {
      expect(result.current.editTitle).toBe('Test Series');
    });
    // Wait for the genres query: the open-transition sync effect recomputes
    // genre selection whenever genres resolve, so toggle only after load.
    await waitFor(() => {
      expect(result.current.genres).toHaveLength(2);
    });

    act(() => {
      result.current.setEditTitle('Renamed Series');
      result.current.toggleGenre('g-2');
    });

    act(() => {
      result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as React.FormEvent);
    });

    await waitFor(() => {
      expect(patchedBody).toEqual(
        expect.objectContaining({
          title: 'Renamed Series',
          description: 'A test series.',
          posterUrl: 'https://example.com/poster.png',
          logoUrl: 'https://example.com/logo.png',
          isFeatured: true,
          isOngoingHighlighted: true,
          genreIds: ['g-2'],
        })
      );
    });
    expect(patchedUrl).toContain('/series/series-1');
    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['series'] });
      expect(toast.success).toHaveBeenCalledWith(
        'series.update',
        expect.objectContaining({
          description: expect.stringContaining('Renamed Series'),
        })
      );
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('sends logoUrl null when the logo field is cleared', async () => {
    let patchedBody: Record<string, unknown> | null = null;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : (input as Request).url;
      const method = init?.method?.toUpperCase() ?? 'GET';

      if (url.includes('/genres')) {
        return new Response(JSON.stringify(genresPayload), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.includes('/series/series-1') && method === 'PATCH') {
        patchedBody = JSON.parse(init?.body as string);
        return new Response(
          JSON.stringify({ data: { ...mockSeries, ...patchedBody } }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(JSON.stringify({ error: { code: 'NOT_FOUND' } }), {
        status: 404,
      });
    });

    const { result } = setup();

    await waitFor(() => {
      expect(result.current.editLogoUrl).toBe('https://example.com/logo.png');
    });

    act(() => {
      result.current.handleLogoUrlChange('   ');
    });

    act(() => {
      result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as React.FormEvent);
    });

    await waitFor(() => {
      expect(patchedBody).toEqual(expect.objectContaining({ logoUrl: null }));
    });
  });
});
