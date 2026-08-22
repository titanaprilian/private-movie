import { renderWithProviders, screen, waitFor } from '../../utils';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { TmdbMatchModal } from '@/modules/videos/internal/TmdbMatchModal';
import { api } from '@/lib/api';
import { toast } from 'sonner';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('@/lib/api', () => ({
  api: {
    series: {
      'series-123': {
        'tmdb-preview': {
          get: vi.fn(),
        },
        'tmdb-match': {
          post: vi.fn(),
        },
      },
    },
  },
}));

describe('TmdbMatchModal component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when closed', () => {
    const { container } = renderWithProviders(
      <TmdbMatchModal seriesId="series-123" open={false} onOpenChange={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders modal title and form controls when open', () => {
    renderWithProviders(
      <TmdbMatchModal seriesId="series-123" open={true} onOpenChange={vi.fn()} />
    );

    expect(screen.getByText('Match TMDB')).toBeInTheDocument();
    expect(screen.getByLabelText('Type')).toBeInTheDocument();
    expect(screen.getByLabelText('TMDB ID')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Season Number/i)).not.toBeInTheDocument();
  });

  it('shows Season Number field when type is set to TV Show', async () => {
    const { user } = renderWithProviders(
      <TmdbMatchModal seriesId="series-123" open={true} onOpenChange={vi.fn()} />
    );

    const typeSelect = screen.getByLabelText('Type');
    await user.selectOptions(typeSelect, 'tv');

    expect(screen.getByLabelText(/Season Number/i)).toBeInTheDocument();
  });

  it('fetches preview data when Preview button is clicked', async () => {
    const mockPreviewResponse = {
      data: {
        data: {
          title: 'The Matrix',
          posterUrl: 'https://image.tmdb.org/t/p/w500/poster.jpg',
          overview: 'A computer hacker learns about the true nature of reality.',
        },
      },
    };

    vi.mocked(api.series['series-123']['tmdb-preview'].get).mockResolvedValueOnce(mockPreviewResponse as any);

    const { user } = renderWithProviders(
      <TmdbMatchModal seriesId="series-123" open={true} onOpenChange={vi.fn()} />
    );

    const tmdbIdInput = screen.getByLabelText('TMDB ID');
    await user.type(tmdbIdInput, '603');

    const previewBtn = screen.getByRole('button', { name: /^Preview$/i });
    await user.click(previewBtn);

    await waitFor(() => {
      expect(api.series['series-123']['tmdb-preview'].get).toHaveBeenCalledWith({
        $query: { type: 'movie', tmdbId: 603 },
      });
    });

    expect(await screen.findByText('The Matrix')).toBeInTheDocument();
    expect(screen.getByText('A computer hacker learns about the true nature of reality.')).toBeInTheDocument();
  });

  it('submits manual match mutation on Save click and invalidates query cache', async () => {
    const mockPreviewResponse = {
      data: {
        data: {
          title: 'The Matrix',
          posterUrl: 'https://image.tmdb.org/t/p/w500/poster.jpg',
          overview: 'A computer hacker learns about the true nature of reality.',
        },
      },
    };

    const mockMatchResponse = {
      data: {
        data: {
          id: 'series-123',
          title: 'The Matrix',
          tmdbSyncStatus: 'SYNCED',
        },
      },
    };

    vi.mocked(api.series['series-123']['tmdb-preview'].get).mockResolvedValueOnce(mockPreviewResponse as any);
    vi.mocked(api.series['series-123']['tmdb-match'].post).mockResolvedValueOnce(mockMatchResponse as any);

    const onOpenChange = vi.fn();
    const { user, queryClient } = renderWithProviders(
      <TmdbMatchModal seriesId="series-123" open={true} onOpenChange={onOpenChange} />
    );

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    // Enter ID and preview
    await user.type(screen.getByLabelText('TMDB ID'), '603');
    await user.click(screen.getByRole('button', { name: /^Preview$/i }));

    expect(await screen.findByText('The Matrix')).toBeInTheDocument();

    // Click Save Match
    const saveBtn = screen.getByRole('button', { name: /Save Match/i });
    expect(saveBtn).not.toBeDisabled();
    await user.click(saveBtn);

    await waitFor(() => {
      expect(api.series['series-123']['tmdb-match'].post).toHaveBeenCalledWith({
        type: 'movie',
        tmdbId: 603,
      });
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['series', 'series-123'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['series'] });
      expect(toast.success).toHaveBeenCalledWith('Successfully matched with TMDB');
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('shows error toast when save match request fails', async () => {
    const mockPreviewResponse = {
      data: {
        data: {
          title: 'The Matrix',
          posterUrl: null,
          overview: 'Overview',
        },
      },
    };

    const mockMatchErrorResponse = {
      error: {
        value: {
          message: 'Failed to update database',
        },
      },
    };

    vi.mocked(api.series['series-123']['tmdb-preview'].get).mockResolvedValueOnce(mockPreviewResponse as any);
    vi.mocked(api.series['series-123']['tmdb-match'].post).mockResolvedValueOnce(mockMatchErrorResponse as any);

    const { user } = renderWithProviders(
      <TmdbMatchModal seriesId="series-123" open={true} onOpenChange={vi.fn()} />
    );

    await user.type(screen.getByLabelText('TMDB ID'), '603');
    await user.click(screen.getByRole('button', { name: /^Preview$/i }));

    expect(await screen.findByText('The Matrix')).toBeInTheDocument();

    const saveBtn = screen.getByRole('button', { name: /Save Match/i });
    await user.click(saveBtn);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to update database');
    });
  });
});
