import { createTestQueryClient, renderHook, waitFor, act } from '../../utils';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { useAddSeasonForm } from '@/modules/videos/internal/seasons/useAddSeasonForm';
import { setAccessToken } from '@/lib/api';
import { toast } from 'sonner';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

function setup(
  seasons: { seasonNumber?: number | null }[] = [{ seasonNumber: 1 }],
  open = true
) {
  const queryClient = createTestQueryClient();
  const onOpenChange = vi.fn();
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const utils = renderHook(
    (p: { open: boolean }) =>
      useAddSeasonForm({
        open: p.open,
        seriesId: 'series-1',
        seasons: seasons as never,
        onOpenChange,
      }),
    { wrapper, initialProps: { open } }
  );
  return { ...utils, queryClient, onOpenChange };
}

describe('useAddSeasonForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAccessToken('test-token');
  });

  it('defaults number and title from next season number', () => {
    const { result } = setup([{ seasonNumber: 2 }]);
    expect(result.current.seasonNumber).toBe(3);
    expect(result.current.title).toBe('Season 3');
    expect(result.current.isValid).toBe(true);
  });

  it('resets form state on open', () => {
    const { result, rerender } = setup();
    act(() => {
      result.current.setDescription('dirty');
      result.current.setScraperUrl('https://otakudesu.cloud/x');
    });
    rerender({ open: false });
    rerender({ open: true });
    expect(result.current.description).toBe('');
    expect(result.current.scraperUrl).toBe('');
    expect(result.current.source).toBe('none');
  });

  it('auto-syncs title with season number until manually touched', () => {
    const { result } = setup();
    act(() => {
      result.current.handleSeasonNumberChange(5);
    });
    expect(result.current.title).toBe('Season 5');
    act(() => {
      result.current.handleTitleChange('Custom');
    });
    act(() => {
      result.current.handleSeasonNumberChange(7);
    });
    expect(result.current.title).toBe('Custom');
  });

  it('detects provider from scraper url', () => {
    const { result } = setup();
    act(() => {
      result.current.handleScraperUrlChange('https://dramula.com/watch/abc');
    });
    expect(result.current.source).toBe('dramula');
    act(() => {
      result.current.handleScraperUrlChange('https://example.com/other');
    });
    // unknown urls leave the detected source untouched
    expect(result.current.source).toBe('dramula');
  });

  it('submits create mutation with mapped payload, invalidates, toasts, closes', async () => {
    let postedBody: Record<string, unknown> | null = null;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => {
      postedBody = JSON.parse(init?.body as string);
      return new Response(
        JSON.stringify({ data: { id: 's-9', title: 'Season 2', ...(postedBody as object) } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });
    const { result, queryClient, onOpenChange } = setup([{ seasonNumber: 1 }]);
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    act(() => {
      result.current.handleTitleChange('Season 2');
      result.current.handleScraperUrlChange('https://otakudesu.cloud/anime/x');
    });
    act(() => {
      result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as React.FormEvent);
    });
    await waitFor(() => {
      expect(postedBody).toEqual(
        expect.objectContaining({
          title: 'Season 2',
          seasonNumber: 2,
          source: 'otakudesu',
        })
      );
    });
    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['series', 'series-1'] });
      expect(toast.success).toHaveBeenCalledWith(
        'Season created successfully',
        expect.objectContaining({ description: 'Season 2' })
      );
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('blocks submit when title is blank or season number invalid', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return new Response(JSON.stringify({ data: {} }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    const { result } = setup();
    act(() => {
      result.current.handleTitleChange('   ');
    });
    expect(result.current.isValid).toBe(false);
    act(() => {
      result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as React.FormEvent);
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
