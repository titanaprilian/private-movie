import { renderWithProviders, screen, waitFor } from '../../utils';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AddMediaDialog } from '@/modules/videos/internal/AddMediaDialog';
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

describe('AddMediaDialog component', () => {
  beforeEach(() => {
    useScrapeWorkerStore.getState().reset();
    useScrapeWorkerStore.setState({ isOpen: false });
    vi.clearAllMocks();
  });

  it('renders nothing when closed', () => {
    renderWithProviders(<AddMediaDialog />);
    expect(screen.queryByText('Add Series')).not.toBeInTheDocument();
  });

  it('renders Step 1 form fields when open and verifies title & description', () => {
    useScrapeWorkerStore.getState().openDialog();
    renderWithProviders(<AddMediaDialog />);

    expect(screen.getByText('Add Series')).toBeInTheDocument();
    expect(
      screen.getByText('Add a new series to your catalog via TMDB.')
    ).toBeInTheDocument();
    expect(screen.getByText(/Step 1 of 2/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Media Type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/TMDB ID/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Include Specials/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /^Next$/i })
    ).toBeInTheDocument();

    // Ensure legacy provider dropdown and source url inputs are absent
    expect(screen.queryByLabelText(/Source Provider/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Source URL/i)).not.toBeInTheDocument();
  });

  it('validates TMDB ID and displays error when submitting empty or invalid ID', async () => {
    useScrapeWorkerStore.getState().openDialog();
    const { user } = renderWithProviders(<AddMediaDialog />);

    const nextBtn = screen.getByRole('button', { name: /^Next$/i });
    expect(nextBtn).toBeDisabled();

    const tmdbIdInput = screen.getByLabelText(/TMDB ID/i);
    await user.type(tmdbIdInput, 'abc');
    expect(nextBtn).toBeEnabled();

    await user.click(nextBtn);

    expect(
      await screen.findByText('TMDB ID must be a valid positive number.')
    ).toBeInTheDocument();
    expect(useScrapeWorkerStore.getState().step).toBe(1);
  });

  it('fetches TMDB preview and transitions to Step 2 with preview snapshot and TV season breakdown', async () => {
    const mockTmdbPreview: apiModule.TmdbPreviewResult = {
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

    vi.mocked(apiModule.fetchSeriesTmdbPreview).mockResolvedValueOnce(
      mockTmdbPreview
    );

    useScrapeWorkerStore.getState().openDialog();
    const { user } = renderWithProviders(<AddMediaDialog />);

    await user.selectOptions(screen.getByLabelText(/Media Type/i), 'tv');
    await user.type(screen.getByLabelText(/TMDB ID/i), '1399');
    await user.click(screen.getByLabelText(/Include Specials/i));

    const nextBtn = screen.getByRole('button', { name: /^Next$/i });
    await user.click(nextBtn);

    expect(apiModule.fetchSeriesTmdbPreview).toHaveBeenCalledWith('tv', 1399, true);

    await waitFor(() => {
      expect(screen.getByText('TMDB Snapshot Overview')).toBeInTheDocument();
    });

    expect(screen.getByText(/Step 2 of 2/i)).toBeInTheDocument();
    expect(screen.getByText('Game of Thrones')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Seven noble families fight for control of the mythical land of Westeros.'
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Game of Thrones' })).toHaveAttribute(
      'src',
      'https://image.tmdb.org/t/p/w500/got.jpg'
    );
    expect(screen.getByText('2011-04-17')).toBeInTheDocument();
    expect(screen.getByText('Sci-Fi & Fantasy')).toBeInTheDocument();
    expect(screen.getByText('Drama')).toBeInTheDocument();
    expect(screen.getByText('Ended')).toBeInTheDocument();
    expect(screen.getByText(/Season Breakdown/i)).toBeInTheDocument();
    expect(screen.getByText('Season 1')).toBeInTheDocument();
    expect(screen.getByText('Season 2')).toBeInTheDocument();
    expect(screen.getByText('10 eps')).toBeInTheDocument();
    expect(screen.getByText('8 eps')).toBeInTheDocument();

    expect(
      screen.getByRole('button', { name: /← Back to Edit/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Import Series/i })
    ).toBeInTheDocument();
  });

  it('renders movie runtime in Step 2 for movie preview', async () => {
    const mockMoviePreview: apiModule.TmdbPreviewResult = {
      title: 'Inception',
      overview: 'A thief who steals corporate secrets...',
      posterUrl: 'https://image.tmdb.org/t/p/w500/inception.jpg',
      releaseDate: '2010-07-16',
      genres: ['Action', 'Sci-Fi'],
      runtime: 148,
    };

    vi.mocked(apiModule.fetchSeriesTmdbPreview).mockResolvedValueOnce(
      mockMoviePreview
    );

    useScrapeWorkerStore.getState().openDialog();
    const { user } = renderWithProviders(<AddMediaDialog />);

    await user.selectOptions(screen.getByLabelText(/Media Type/i), 'movie');
    await user.type(screen.getByLabelText(/TMDB ID/i), '550');
    await user.click(screen.getByRole('button', { name: /^Next$/i }));

    await waitFor(() => {
      expect(screen.getByText('Inception')).toBeInTheDocument();
    });

    expect(screen.getByText('148 mins')).toBeInTheDocument();
    expect(screen.getByText('2010-07-16')).toBeInTheDocument();
    expect(screen.getByText('Action')).toBeInTheDocument();
    expect(screen.getByText('Sci-Fi')).toBeInTheDocument();
  });

  it('allows navigating back to Step 1 from Step 2 via "← Back to Edit"', async () => {
    const mockTmdbPreview: apiModule.TmdbPreviewResult = {
      title: 'Breaking Bad',
      overview: 'A chemistry teacher diagnosed with inoperable lung cancer...',
      posterUrl: 'https://image.tmdb.org/t/p/w500/bb.jpg',
    };

    vi.mocked(apiModule.fetchSeriesTmdbPreview).mockResolvedValueOnce(
      mockTmdbPreview
    );

    useScrapeWorkerStore.getState().openDialog();
    const { user } = renderWithProviders(<AddMediaDialog />);

    await user.type(screen.getByLabelText(/TMDB ID/i), '1396');
    await user.click(screen.getByRole('button', { name: /^Next$/i }));

    await waitFor(() => {
      expect(screen.getByText('Breaking Bad')).toBeInTheDocument();
    });

    const backBtn = screen.getByRole('button', { name: /← Back to Edit/i });
    await user.click(backBtn);

    expect(screen.getByText(/Step 1 of 2/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/TMDB ID/i)).toHaveValue('1396');
  });

  it('invokes importTmdb mutation when clicking "Import Series", invalidates queries, toasts, and closes dialog on success', async () => {
    const mockTmdbPreview: apiModule.TmdbPreviewResult = {
      title: 'Game of Thrones',
      overview: 'Seven noble families fight for control...',
      posterUrl: 'https://image.tmdb.org/t/p/w500/got.jpg',
    };

    const mockImportedSeries: apiModule.SeriesDetails = {
      id: 'series-got-1',
      sourceUrl: 'https://themoviedb.org/tv/1399',
      source: 'tmdb',
      title: 'Game of Thrones',
      description: 'Seven noble families fight...',
      posterUrl: 'https://image.tmdb.org/t/p/w500/got.jpg',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      episodes: [],
    };

    vi.mocked(apiModule.fetchSeriesTmdbPreview).mockResolvedValueOnce(
      mockTmdbPreview
    );
    vi.mocked(apiModule.importTmdb).mockResolvedValueOnce(mockImportedSeries);

    useScrapeWorkerStore.getState().openDialog();
    const { user, queryClient } = renderWithProviders(<AddMediaDialog />);
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await user.selectOptions(screen.getByLabelText(/Media Type/i), 'tv');
    await user.type(screen.getByLabelText(/TMDB ID/i), '1399');
    await user.click(screen.getByLabelText(/Include Specials/i));

    await user.click(screen.getByRole('button', { name: /^Next$/i }));

    await waitFor(() => {
      expect(screen.getByText('Game of Thrones')).toBeInTheDocument();
    });

    const importBtn = screen.getByRole('button', { name: /Import Series/i });
    await user.click(importBtn);

    await waitFor(() => {
      expect(apiModule.importTmdb).toHaveBeenCalledWith({
        type: 'tv',
        tmdbId: 1399,
        includeSpecials: true,
      });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['series'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['episodes'] });
      expect(toast.success).toHaveBeenCalledWith('Series imported successfully');
      expect(useScrapeWorkerStore.getState().isOpen).toBe(false);
    });
  });

  it('displays error message if importTmdb mutation fails', async () => {
    const mockTmdbPreview: apiModule.TmdbPreviewResult = {
      title: 'Failed Movie',
      overview: 'Something that fails to import...',
      posterUrl: null,
    };

    vi.mocked(apiModule.fetchSeriesTmdbPreview).mockResolvedValueOnce(
      mockTmdbPreview
    );
    vi.mocked(apiModule.importTmdb).mockRejectedValueOnce(
      new Error('TMDB rate limit exceeded')
    );

    useScrapeWorkerStore.getState().openDialog();
    const { user } = renderWithProviders(<AddMediaDialog />);

    await user.selectOptions(screen.getByLabelText(/Media Type/i), 'movie');
    await user.type(screen.getByLabelText(/TMDB ID/i), '550');
    await user.click(screen.getByRole('button', { name: /^Next$/i }));

    await waitFor(() => {
      expect(screen.getByText('Failed Movie')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Import Series/i }));

    expect(
      await screen.findByText('TMDB rate limit exceeded')
    ).toBeInTheDocument();
  });

  it('closes and resets state when clicking the close button or Cancel button', async () => {
    useScrapeWorkerStore.getState().openDialog();
    const { user } = renderWithProviders(<AddMediaDialog />);

    await user.type(screen.getByLabelText(/TMDB ID/i), '12345');

    const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
    await user.click(cancelBtn);

    expect(useScrapeWorkerStore.getState().isOpen).toBe(false);
    expect(useScrapeWorkerStore.getState().tmdbId).toBe('');
  });
});
