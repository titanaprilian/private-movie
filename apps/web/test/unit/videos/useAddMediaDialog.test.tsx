import {
  createTestQueryClient,
  renderHook,
  renderWithProviders,
  screen,
  waitFor,
  act,
} from '../../utils';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { useAddMediaDialog } from '@/modules/videos/internal/catalog/dialogs/hooks/useAddMediaDialog';
import { AddMediaDialog } from '@/modules/videos/internal/catalog/dialogs/AddMediaDialog';
import { useAddMediaStore as useScrapeWorkerStore } from '@/modules/videos/internal/catalog';
import type {
  TmdbPreviewResult,
  SeriesDetails,
} from '@/modules/videos/internal/api';
import { toast } from 'sonner';
import { QueryClientProvider } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

function getRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

const mockTmdbPreview: TmdbPreviewResult = {
  title: 'Game of Thrones',
  overview:
    'Seven noble families fight for control of the mythical land of Westeros.',
  posterUrl: 'https://image.tmdb.org/t/p/w500/got.jpg',
  releaseDate: '2011-04-17',
  genres: ['Sci-Fi & Fantasy', 'Drama'],
  status: 'Ended',
  totalSeasons: 2,
  totalEpisodes: 18,
  seasons: [
    { seasonNumber: 1, name: 'Season 1', episodeCount: 10, posterUrl: null },
    { seasonNumber: 2, name: 'Season 2', episodeCount: 8, posterUrl: null },
  ],
};

const mockImportedSeries: SeriesDetails = {
  id: 'series-1',
  sourceUrl: 'https://themoviedb.org/tv/1399',
  source: 'tmdb',
  title: 'Game of Thrones',
  description:
    'Seven noble families fight for control of the mythical land of Westeros.',
  posterUrl: 'https://image.tmdb.org/t/p/w500/got.jpg',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  episodes: [],
};

function renderDialogHook() {
  const queryClient = createTestQueryClient();
  return renderHook(() => useAddMediaDialog(), {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
    ),
  });
}

function TestWrapper({
  children,
  queryClient,
}: {
  children: React.ReactNode;
  queryClient: QueryClient;
}) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useAddMediaDialog hook and AddMediaDialog integration', () => {
  beforeEach(() => {
    useScrapeWorkerStore.getState().reset();
    useScrapeWorkerStore.setState({ isOpen: false });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exposes store state and setters', () => {
    useScrapeWorkerStore.getState().openDialog();
    const { result } = renderDialogHook();
    expect(result.current.isOpen).toBe(true);
    expect(result.current.step).toBe(1);
    expect(result.current.tmdbId).toBe('');
    expect(typeof result.current.setTmdbType).toBe('function');
    expect(typeof result.current.setTmdbId).toBe('function');
    expect(typeof result.current.setIncludeSpecials).toBe('function');
    expect(typeof result.current.submitPreview).toBe('function');
    expect(typeof result.current.backToStep1).toBe('function');
    expect(typeof result.current.closeDialog).toBe('function');
  });

  it('closeDialog resets the store', () => {
    useScrapeWorkerStore.getState().openDialog();
    useScrapeWorkerStore.setState({ tmdbId: '1399' });
    const { result } = renderDialogHook();
    act(() => {
      result.current.closeDialog();
    });
    expect(useScrapeWorkerStore.getState().isOpen).toBe(false);
    expect(useScrapeWorkerStore.getState().tmdbId).toBe('');
  });

  it('import mutation invalidates queries, toasts, and closes on success through real API client', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (input) => {
        const url = getRequestUrl(input);
        if (url.includes('/api/series/tmdb-import')) {
          return new Response(JSON.stringify({ data: mockImportedSeries }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response(
          JSON.stringify({ error: { message: 'Not found' } }),
          { status: 404 }
        );
      });

    useScrapeWorkerStore.getState().openDialog();
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useAddMediaDialog(), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      ),
    });

    await act(async () => {
      result.current.importTmdbMutation.mutate({
        type: 'tv',
        tmdbId: 1399,
        includeSpecials: false,
      });
    });

    await waitFor(() => {
      const importCall = fetchSpy.mock.calls.find(([input]) =>
        getRequestUrl(input).includes('/api/series/tmdb-import')
      );
      expect(importCall).toBeDefined();
      const [, init] = importCall!;
      expect(init?.method).toBe('POST');
      expect(JSON.parse(init?.body as string)).toEqual({
        type: 'tv',
        tmdbId: 1399,
        includeSpecials: false,
      });
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['series'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['episodes'] });
      expect(toast.success).toHaveBeenCalledWith(
        'Series imported successfully'
      );
      expect(useScrapeWorkerStore.getState().isOpen).toBe(false);
    });
  });

  it('AddMediaDialog consumes the hook (smoke)', () => {
    useScrapeWorkerStore.getState().openDialog();
    renderWithProviders(<AddMediaDialog />);
    expect(screen.getByText('Add Series')).toBeInTheDocument();
    expect(screen.getByText(/Step 1 of 2/i)).toBeInTheDocument();
  });

  it('exercises full AddMediaDialog preview and import flow through real API client', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (input) => {
        const url = getRequestUrl(input);
        if (url.includes('/api/series/tmdb-preview')) {
          return new Response(JSON.stringify({ data: mockTmdbPreview }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (url.includes('/api/series/tmdb-import')) {
          return new Response(JSON.stringify({ data: mockImportedSeries }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response(
          JSON.stringify({ error: { message: 'Not found' } }),
          { status: 404 }
        );
      });

    useScrapeWorkerStore.getState().openDialog();
    const { user, queryClient } = renderWithProviders(<AddMediaDialog />);
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    // Step 1: Fill form
    await user.type(screen.getByLabelText(/TMDB ID/i), '1399');
    await user.click(screen.getByLabelText(/Include Specials/i));

    // Submit step 1
    await user.click(screen.getByRole('button', { name: /^Next$/i }));

    // Verify preview request at fetch boundary
    await waitFor(() => {
      const previewCall = fetchSpy.mock.calls.find(([input]) =>
        getRequestUrl(input).includes('/api/series/tmdb-preview')
      );
      expect(previewCall).toBeDefined();
      const [input] = previewCall!;
      const urlObj = new URL(getRequestUrl(input));
      expect(urlObj.searchParams.get('type')).toBe('tv');
      expect(urlObj.searchParams.get('tmdbId')).toBe('1399');
      expect(urlObj.searchParams.get('includeSpecials')).toBe('true');
    });

    // Verify Step 2 preview is rendered
    await waitFor(() => {
      expect(screen.getByText('Game of Thrones')).toBeInTheDocument();
      expect(screen.getByText(/Step 2 of 2/i)).toBeInTheDocument();
      expect(screen.getByText('10 eps')).toBeInTheDocument();
    });

    // Step 2: Trigger import
    await user.click(screen.getByRole('button', { name: /Import Series/i }));

    // Verify import request at fetch boundary
    await waitFor(() => {
      const importCall = fetchSpy.mock.calls.find(([input]) =>
        getRequestUrl(input).includes('/api/series/tmdb-import')
      );
      expect(importCall).toBeDefined();
      const [, init] = importCall!;
      expect(init?.method).toBe('POST');
      expect(JSON.parse(init?.body as string)).toEqual({
        type: 'tv',
        tmdbId: 1399,
        includeSpecials: true,
      });
    });

    // Verify UI response handling
    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['series'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['episodes'] });
      expect(toast.success).toHaveBeenCalledWith(
        'Series imported successfully'
      );
      expect(useScrapeWorkerStore.getState().isOpen).toBe(false);
    });
  });

  it('surfaces mutation error to the preview step through real API client error response', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = getRequestUrl(input);
      if (url.includes('/api/series/tmdb-preview')) {
        return new Response(
          JSON.stringify({
            data: {
              title: 'Fail Movie',
              overview: 'Preview ok',
              posterUrl: null,
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (url.includes('/api/series/tmdb-import')) {
        return new Response(
          JSON.stringify({
            message: 'TMDB rate limit exceeded',
          }),
          { status: 429, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify({ error: { message: 'Not found' } }), {
        status: 404,
      });
    });

    useScrapeWorkerStore.getState().openDialog();
    const { user } = renderWithProviders(<AddMediaDialog />);

    await user.type(screen.getByLabelText(/TMDB ID/i), '550');
    await user.click(screen.getByRole('button', { name: /^Next$/i }));

    await waitFor(() => {
      expect(screen.getByText('Fail Movie')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Import Series/i }));

    expect(
      await screen.findByText('TMDB rate limit exceeded')
    ).toBeInTheDocument();
  });
});
