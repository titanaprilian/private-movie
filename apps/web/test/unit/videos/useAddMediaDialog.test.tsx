import { createTestQueryClient, renderHook, renderWithProviders, screen, waitFor, act } from '../../utils';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useAddMediaDialog } from '@/modules/videos/internal/catalog/dialogs/useAddMediaDialog';
import { AddMediaDialog } from '@/modules/videos/internal/catalog/dialogs/AddMediaDialog';
import { useScrapeWorkerStore } from '@/modules/videos/internal/store/useScrapeWorkerStore';
import * as apiModule from '@/modules/videos/internal/api';
import { toast } from 'sonner';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('@/modules/videos/internal/api', async () => {
  const actual = await vi.importActual<typeof import('@/modules/videos/internal/api')>(
    '@/modules/videos/internal/api'
  );
  return {
    ...actual,
    importTmdb: vi.fn(),
    fetchSeriesTmdbPreview: vi.fn(),
  };
});

function renderDialogHook() {
  const queryClient = createTestQueryClient();
  return renderHook(() => useAddMediaDialog(), {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <TestWrapper queryClient={queryClient}>{children}</TestWrapper>
    ),
  });
}

import { QueryClientProvider } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
function TestWrapper({ children, queryClient }: { children: React.ReactNode; queryClient: QueryClient }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('useAddMediaDialog hook', () => {
  beforeEach(() => {
    useScrapeWorkerStore.getState().reset();
    useScrapeWorkerStore.setState({ isOpen: false });
    vi.clearAllMocks();
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

  it('import mutation invalidates queries, toasts, and closes on success', async () => {
    const mockImported = {
      id: 'series-1',
      sourceUrl: 'https://themoviedb.org/tv/1399',
      source: 'tmdb',
      title: 'GOT',
      description: 'desc',
      posterUrl: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      episodes: [],
    };
    vi.mocked(apiModule.importTmdb).mockResolvedValueOnce(mockImported as never);
    useScrapeWorkerStore.getState().openDialog();
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useAddMediaDialog(), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    });

    await act(async () => {
      result.current.importTmdbMutation.mutate({ type: 'tv', tmdbId: 1399, includeSpecials: false });
    });

    await waitFor(() => {
      expect(apiModule.importTmdb).toHaveBeenCalledWith({
        type: 'tv',
        tmdbId: 1399,
        includeSpecials: false,
      });
    });
    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['series'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['episodes'] });
      expect(toast.success).toHaveBeenCalledWith('Series imported successfully');
      expect(useScrapeWorkerStore.getState().isOpen).toBe(false);
    });
  });

  it('AddMediaDialog consumes the hook (smoke)', () => {
    useScrapeWorkerStore.getState().openDialog();
    renderWithProviders(<AddMediaDialog />);
    expect(screen.getByText('Add Series')).toBeInTheDocument();
    expect(screen.getByText(/Step 1 of 2/i)).toBeInTheDocument();
  });

  it('surfaces mutation error to the preview step', async () => {
    const preview = { title: 'Fail', overview: 'x', posterUrl: null };
    vi.mocked(apiModule.fetchSeriesTmdbPreview).mockResolvedValueOnce(preview as never);
    vi.mocked(apiModule.importTmdb).mockRejectedValueOnce(new Error('TMDB rate limit exceeded'));
    useScrapeWorkerStore.getState().openDialog();
    const { user } = renderWithProviders(<AddMediaDialog />);
    await user.type(screen.getByLabelText(/TMDB ID/i), '550');
    await user.click(screen.getByRole('button', { name: /^Next$/i }));
    await waitFor(() => {
      expect(screen.getByText('Fail')).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /Import Series/i }));
    expect(await screen.findByText('TMDB rate limit exceeded')).toBeInTheDocument();
  });
});
