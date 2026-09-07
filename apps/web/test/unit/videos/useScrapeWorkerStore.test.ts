import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useScrapeWorkerStore } from '@/modules/videos/internal/store/useScrapeWorkerStore';
import * as apiModule from '@/modules/videos/internal/api';

vi.mock('@/modules/videos/internal/api', async () => {
  const actual = await vi.importActual<typeof import('@/modules/videos/internal/api')>(
    '@/modules/videos/internal/api'
  );
  return {
    ...actual,
    fetchSeriesTmdbPreview: vi.fn(),
  };
});

describe('useScrapeWorkerStore', () => {
  beforeEach(() => {
    useScrapeWorkerStore.getState().reset();
    useScrapeWorkerStore.setState({ isOpen: false });
    vi.clearAllMocks();
  });

  it('has correct initial state', () => {
    const state = useScrapeWorkerStore.getState();
    expect(state.isOpen).toBe(false);
    expect(state.step).toBe(1);
    expect(state.tmdbType).toBe('tv');
    expect(state.tmdbId).toBe('');
    expect(state.includeSpecials).toBe(false);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.tmdbPreviewData).toBeNull();
  });

  it('opens and closes dialog', () => {
    useScrapeWorkerStore.getState().openDialog();
    expect(useScrapeWorkerStore.getState().isOpen).toBe(true);

    useScrapeWorkerStore.getState().closeDialog();
    expect(useScrapeWorkerStore.getState().isOpen).toBe(false);
  });

  it('updates form state fields', () => {
    useScrapeWorkerStore.getState().setTmdbType('movie');
    useScrapeWorkerStore.getState().setTmdbId('550');
    useScrapeWorkerStore.getState().setIncludeSpecials(true);

    expect(useScrapeWorkerStore.getState().tmdbType).toBe('movie');
    expect(useScrapeWorkerStore.getState().tmdbId).toBe('550');
    expect(useScrapeWorkerStore.getState().includeSpecials).toBe(true);
  });

  it('submits TMDB preview successfully and transitions to step 2', async () => {
    const mockTmdbPreview: apiModule.TmdbPreviewResult = {
      title: 'Fight Club',
      overview: 'An insomniac office worker...',
      posterUrl: 'https://image.tmdb.org/t/p/w500/fc.jpg',
    };

    vi.mocked(apiModule.fetchSeriesTmdbPreview).mockResolvedValueOnce(mockTmdbPreview);

    useScrapeWorkerStore.getState().setTmdbType('movie');
    useScrapeWorkerStore.getState().setTmdbId('550');

    const success = await useScrapeWorkerStore.getState().submitPreview();

    expect(success).toBe(true);
    expect(apiModule.fetchSeriesTmdbPreview).toHaveBeenCalledWith('movie', 550);
    expect(useScrapeWorkerStore.getState().isLoading).toBe(false);
    expect(useScrapeWorkerStore.getState().step).toBe(2);
    expect(useScrapeWorkerStore.getState().tmdbPreviewData).toEqual(mockTmdbPreview);
    expect(useScrapeWorkerStore.getState().error).toBeNull();
  });

  it('returns false and sets error if tmdbId is missing or invalid on submitPreview', async () => {
    useScrapeWorkerStore.getState().setTmdbId('');

    let success = await useScrapeWorkerStore.getState().submitPreview();
    expect(success).toBe(false);
    expect(useScrapeWorkerStore.getState().error).toBe('TMDB ID is required.');
    expect(useScrapeWorkerStore.getState().step).toBe(1);

    useScrapeWorkerStore.getState().setTmdbId('abc');
    success = await useScrapeWorkerStore.getState().submitPreview();
    expect(success).toBe(false);
    expect(useScrapeWorkerStore.getState().error).toBe('TMDB ID must be a valid positive number.');
    expect(useScrapeWorkerStore.getState().step).toBe(1);

    useScrapeWorkerStore.getState().setTmdbId('-5');
    success = await useScrapeWorkerStore.getState().submitPreview();
    expect(success).toBe(false);
    expect(useScrapeWorkerStore.getState().error).toBe('TMDB ID must be a valid positive number.');
    expect(useScrapeWorkerStore.getState().step).toBe(1);
  });

  it('handles preview fetch error and stays on step 1', async () => {
    vi.mocked(apiModule.fetchSeriesTmdbPreview).mockRejectedValueOnce(
      new Error('TMDB media not found')
    );

    useScrapeWorkerStore.getState().setTmdbId('999999');

    const success = await useScrapeWorkerStore.getState().submitPreview();

    expect(success).toBe(false);
    expect(useScrapeWorkerStore.getState().isLoading).toBe(false);
    expect(useScrapeWorkerStore.getState().step).toBe(1);
    expect(useScrapeWorkerStore.getState().tmdbPreviewData).toBeNull();
    expect(useScrapeWorkerStore.getState().error).toBe('TMDB media not found');
  });

  it('allows navigating back to step 1 from step 2', () => {
    useScrapeWorkerStore.getState().setStep(2);
    expect(useScrapeWorkerStore.getState().step).toBe(2);

    useScrapeWorkerStore.getState().backToStep1();
    expect(useScrapeWorkerStore.getState().step).toBe(1);
  });
});
