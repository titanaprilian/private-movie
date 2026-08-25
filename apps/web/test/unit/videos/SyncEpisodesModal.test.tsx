import { renderWithProviders, screen, waitFor } from '../../utils';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SyncEpisodesModal } from '@/modules/videos/internal/SyncEpisodesModal';
import { getSeasonTmdbPreview, syncSeasonTmdb, type SeasonDetails } from '@/modules/videos/internal/api';
import { toast } from 'sonner';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('@/modules/videos/internal/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/modules/videos/internal/api')>();
  return {
    ...actual,
    getSeasonTmdbPreview: vi.fn(),
    syncSeasonTmdb: vi.fn(),
  };
});

const mockSeason: SeasonDetails = {
  id: 'season-100',
  seriesId: 'series-100',
  sourceUrl: 'https://example.com/s1',
  source: 'otakudesu',
  title: 'Season 1',
  description: 'First season',
  posterUrl: null,
  backdropUrl: null,
  rating: '8.5',
  tmdbId: 12345,
  tmdbSeason: 1,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
  episodes: [],
};

describe('SyncEpisodesModal component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when open is false', () => {
    const { container } = renderWithProviders(
      <SyncEpisodesModal
        open={false}
        onOpenChange={vi.fn()}
        seriesId="series-100"
        season={mockSeason}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders Step 1 form with pre-filled inputs when open', () => {
    renderWithProviders(
      <SyncEpisodesModal
        open={true}
        onOpenChange={vi.fn()}
        seriesId="series-100"
        season={mockSeason}
      />
    );

    expect(screen.getByText('Sync Season Episodes from TMDB')).toBeInTheDocument();
    expect(screen.getByLabelText(/TMDB Series ID/i)).toHaveValue(12345);
    expect(screen.getByLabelText(/TMDB Season Number/i)).toHaveValue(1);
    expect(screen.getByRole('button', { name: /Preview Sync/i })).toBeInTheDocument();
  });

  it('fetches preview and displays Step 2 diff comparison upon clicking Preview Sync', async () => {
    const mockPreviewResult = {
      seasonId: 'season-100',
      tmdbId: 12345,
      tmdbSeason: 1,
      updates: [
        {
          id: 'ep-1',
          order: 1,
          existingTitle: 'Ep 1 Scraped Title',
          newTitle: 'Clean Episode 1 Title',
          existingDescription: null,
          newDescription: 'New desc',
          existingThumbnailUrl: null,
          newThumbnailUrl: null,
          existingRating: null,
          newRating: null,
          existingAirDate: null,
          newAirDate: null,
          existingDuration: null,
          newDuration: null,
          tmdbId: 991,
        },
      ],
      inserts: [
        {
          order: 2,
          title: 'Clean Episode 2 Stub',
          description: null,
          thumbnailUrl: null,
          rating: null,
          airDate: '2025-02-01',
          duration: null,
          tmdbId: 992,
        },
      ],
      unmapped: [
        {
          id: 'ep-99',
          order: 99,
          title: 'Extra Special OVA',
        },
      ],
    };

    vi.mocked(getSeasonTmdbPreview).mockResolvedValueOnce(mockPreviewResult);

    const { user } = renderWithProviders(
      <SyncEpisodesModal
        open={true}
        onOpenChange={vi.fn()}
        seriesId="series-100"
        season={mockSeason}
      />
    );

    const previewBtn = screen.getByRole('button', { name: /Preview Sync/i });
    await user.click(previewBtn);

    expect(getSeasonTmdbPreview).toHaveBeenCalledWith('season-100', {
      tmdbId: 12345,
      tmdbSeason: 1,
    });

    await waitFor(() => {
      expect(screen.getByText('Episodes to Update (1)')).toBeInTheDocument();
    });

    expect(screen.getByText('New Episodes to Insert (1)')).toBeInTheDocument();
    expect(screen.getByText(/Unmapped Local Episodes/)).toBeInTheDocument();
    expect(screen.getByText(/Clean Episode 1 Title/)).toBeInTheDocument();
    expect(screen.getByText('Clean Episode 2 Stub')).toBeInTheDocument();
    expect(screen.getByText(/Extra Special OVA/)).toBeInTheDocument();
  });

  it('allows going back to Step 1 from Step 2', async () => {
    const mockPreviewResult = {
      seasonId: 'season-100',
      tmdbId: 12345,
      tmdbSeason: 1,
      updates: [],
      inserts: [],
      unmapped: [],
    };

    vi.mocked(getSeasonTmdbPreview).mockResolvedValueOnce(mockPreviewResult);

    const { user } = renderWithProviders(
      <SyncEpisodesModal
        open={true}
        onOpenChange={vi.fn()}
        seriesId="series-100"
        season={mockSeason}
      />
    );

    await user.click(screen.getByRole('button', { name: /Preview Sync/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Confirm & Sync/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Back/i }));

    expect(screen.getByRole('button', { name: /Preview Sync/i })).toBeInTheDocument();
  });

  it('executes sync mutation when Confirm & Sync is clicked', async () => {
    const mockPreviewResult = {
      seasonId: 'season-100',
      tmdbId: 12345,
      tmdbSeason: 1,
      updates: [],
      inserts: [],
      unmapped: [],
    };

    const mockSyncResult = {
      success: true as const,
      seasonId: 'season-100',
      updatedCount: 1,
      insertedCount: 1,
      unmappedCount: 0,
    };

    vi.mocked(getSeasonTmdbPreview).mockResolvedValueOnce(mockPreviewResult);
    vi.mocked(syncSeasonTmdb).mockResolvedValueOnce(mockSyncResult);

    const onOpenChange = vi.fn();

    const { user } = renderWithProviders(
      <SyncEpisodesModal
        open={true}
        onOpenChange={onOpenChange}
        seriesId="series-100"
        season={mockSeason}
      />
    );

    await user.click(screen.getByRole('button', { name: /Preview Sync/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Confirm & Sync/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Confirm & Sync/i }));

    expect(syncSeasonTmdb).toHaveBeenCalledWith('season-100', {
      tmdbId: 12345,
      tmdbSeason: 1,
    });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        'Episodes Synced',
        expect.objectContaining({
          description: expect.stringContaining('Successfully updated 1 episodes'),
        })
      );
    });

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('shows error toast when preview fetch fails', async () => {
    vi.mocked(getSeasonTmdbPreview).mockRejectedValueOnce(new Error('TMDB season not found'));

    const { user } = renderWithProviders(
      <SyncEpisodesModal
        open={true}
        onOpenChange={vi.fn()}
        seriesId="series-100"
        season={mockSeason}
      />
    );

    await user.click(screen.getByRole('button', { name: /Preview Sync/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'Sync Preview Error',
        expect.objectContaining({
          description: 'TMDB season not found',
        })
      );
    });
  });
});
