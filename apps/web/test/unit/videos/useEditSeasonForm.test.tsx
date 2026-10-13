import { createTestQueryClient, renderHook, waitFor, act } from '../../utils';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { useEditSeasonForm } from '@/modules/videos/internal/seasons/useEditSeasonForm';
import type { SeasonDetails } from '@/modules/videos/internal/api';
import { setAccessToken } from '@/lib/api';
import { toast } from 'sonner';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const mockSeason = {
  id: 'season-1',
  seriesId: 'series-1',
  title: 'Season 1',
  description: 'Desc',
  status: 'ongoing',
  scraperUrl: 'https://otakudesu.cloud/anime/x',
  source: null,
  episodeOffset: 2,
} as unknown as SeasonDetails;

function setup(season: SeasonDetails = mockSeason, open = true) {
  const queryClient = createTestQueryClient();
  const onOpenChange = vi.fn();
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const utils = renderHook(
    (p: { open: boolean }) => useEditSeasonForm({ open: p.open, season, onOpenChange }),
    { wrapper, initialProps: { open } }
  );
  return { ...utils, queryClient, onOpenChange };
}

describe('useEditSeasonForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAccessToken('test-token');
  });

  it('syncs form state from season on open', () => {
    const { result } = setup();
    expect(result.current.title).toBe('Season 1');
    expect(result.current.description).toBe('Desc');
    expect(result.current.status).toBe('ongoing');
    expect(result.current.scraperUrl).toBe('https://otakudesu.cloud/anime/x');
    // source falls back to provider detection when null
    expect(result.current.source).toBe('otakudesu');
    expect(result.current.episodeOffset).toBe(2);
  });

  it('resets user edits on closed → open transition', () => {
    const { result, rerender } = setup();
    act(() => {
      result.current.setTitle('Edited');
    });
    expect(result.current.title).toBe('Edited');
    rerender({ open: false });
    rerender({ open: true });
    expect(result.current.title).toBe('Season 1');
  });

  it('detects provider from scraper url change', () => {
    const { result } = setup({ ...mockSeason, scraperUrl: null, source: null });
    expect(result.current.source).toBe('none');
    act(() => {
      result.current.handleScraperUrlChange('https://dramula.com/watch/y');
    });
    expect(result.current.source).toBe('dramula');
  });

  it('submits update mutation with mapped payload, invalidates, toasts, closes', async () => {
    let patchedBody: Record<string, unknown> | null = null;
    let patchedUrl = '';
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url =
        typeof input === 'string' ? input : (input as Request).url;
      if (url.includes('/seasons/season-1') && init?.method?.toUpperCase() === 'PATCH') {
        patchedUrl = url;
        patchedBody = JSON.parse(init?.body as string);
        return new Response(
          JSON.stringify({ data: { ...mockSeason, ...(patchedBody as object) } }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify({ error: { code: 'NOT_FOUND' } }), { status: 404 });
    });
    const { result, queryClient, onOpenChange } = setup();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    act(() => {
      result.current.setTitle('Renamed');
    });
    act(() => {
      result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as React.FormEvent);
    });
    await waitFor(() => {
      expect(patchedBody).toEqual(
        expect.objectContaining({ title: 'Renamed', status: 'ongoing', source: 'otakudesu' })
      );
    });
    expect(patchedUrl).toContain('/seasons/season-1');
    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['series', 'series-1'] });
      expect(toast.success).toHaveBeenCalledWith(
        'Season updated successfully',
        expect.objectContaining({ description: 'Renamed' })
      );
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('blocks submit when title is blank', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return new Response(JSON.stringify({ data: {} }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    const { result } = setup();
    act(() => {
      result.current.setTitle('   ');
    });
    act(() => {
      result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as React.FormEvent);
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
