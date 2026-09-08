import { renderWithProviders, screen, waitFor } from '../../utils';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SyncTmdbModal } from '@/modules/videos/internal/SyncTmdbModal';
import { computeSyncDiff } from '@/modules/videos/internal/computeSyncDiff';
import type {
  SeriesDetails,
  TmdbPreviewResult,
} from '@/modules/videos/internal/api';
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
    syncSeriesTmdb: vi.fn(),
    fetchSeriesTmdbPreview: vi.fn(),
    fetchSeriesTmdbSyncPreview: vi.fn(),
  };
});

const mockSeriesTv: SeriesDetails = {
  id: 'series-tv-1',
  sourceUrl: 'https://themoviedb.org/tv/1399',
  source: 'tmdb',
  title: 'Game of Thrones',
  type: 'tv',
  tmdbId: 1399,
  description: 'Seven noble families fight for control of the mythical land of Westeros.',
  posterUrl: 'https://image.tmdb.org/t/p/w500/got.jpg',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  seasons: [
    {
      id: 'season-1',
      seriesId: 'series-tv-1',
      sourceUrl: '',
      source: 'tmdb',
      title: 'Season 1',
      tmdbSeason: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      episodes: [
        {
          id: 'ep-1',
          title: 'Winter Is Coming',
          order: 1,
          videoSources: [],
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
        },
        {
          id: 'ep-2',
          title: 'The Kingsroad',
          order: 2,
          videoSources: [],
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
        },
      ],
    },
    {
      id: 'season-2',
      seriesId: 'series-tv-1',
      sourceUrl: '',
      source: 'tmdb',
      title: 'Season 2',
      tmdbSeason: 2,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      episodes: [
        {
          id: 'ep-201',
          title: 'The North Remembers',
          order: 1,
          videoSources: [],
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
        },
      ],
    },
  ],
  episodes: [
    {
      id: 'ep-1',
      seasonId: 'season-1',
      title: 'Winter Is Coming',
      order: 1,
      videoSources: [],
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
    {
      id: 'ep-2',
      seasonId: 'season-1',
      title: 'The Kingsroad',
      order: 2,
      videoSources: [],
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
    {
      id: 'ep-201',
      seasonId: 'season-2',
      title: 'The North Remembers',
      order: 1,
      videoSources: [],
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
  ],
};

const mockTmdbPreview: TmdbPreviewResult = {
  title: 'Game of Thrones',
  overview: 'Seven noble families fight for control of the mythical land of Westeros.',
  posterUrl: 'https://image.tmdb.org/t/p/w500/got.jpg',
  releaseDate: '2011-04-17',
  genres: ['Sci-Fi & Fantasy', 'Drama'],
  status: 'Ended',
  totalSeasons: 3,
  totalEpisodes: 15,
  seasons: [
    {
      seasonNumber: 1,
      name: 'Season 1',
      episodeCount: 2, // Matches local count (2 eps) -> Existing
      posterUrl: null,
    },
    {
      seasonNumber: 2,
      name: 'Season 2',
      episodeCount: 10, // Local has 1 ep -> +9 new eps (1 -> 10)
      posterUrl: null,
    },
    {
      seasonNumber: 3,
      name: 'Season 3',
      episodeCount: 3, // Local does not have Season 3 -> New Season (3 eps)
      posterUrl: null,
    },
  ],
};

describe('computeSyncDiff', () => {
  it('computes correct diff when seasons are existing, updated, and new', () => {
    const diff = computeSyncDiff(mockSeriesTv, mockTmdbPreview);

    expect(diff.totalNewEpisodes).toBe(12); // 0 + 9 + 3 = 12
    expect(diff.totalNewSeasons).toBe(1); // Season 3 is new
    expect(diff.seasonDiffs).toHaveLength(3);

    expect(diff.seasonDiffs[0]).toEqual({
      seasonNumber: 1,
      name: 'Season 1',
      incomingEpisodeCount: 2,
      localEpisodeCount: 2,
      diff: 0,
      isNewSeason: false,
      badgeText: 'Existing (2 eps)',
      badgeType: 'existing',
    });

    expect(diff.seasonDiffs[1]).toEqual({
      seasonNumber: 2,
      name: 'Season 2',
      incomingEpisodeCount: 10,
      localEpisodeCount: 1,
      diff: 9,
      isNewSeason: false,
      badgeText: '+9 new eps (1 → 10)',
      badgeType: 'new-eps',
    });

    expect(diff.seasonDiffs[2]).toEqual({
      seasonNumber: 3,
      name: 'Season 3',
      incomingEpisodeCount: 3,
      localEpisodeCount: 0,
      diff: 3,
      isNewSeason: true,
      badgeText: 'New Season (3 eps)',
      badgeType: 'new-season',
    });
  });

  it('computes diff correctly for movies', () => {
    const mockMovieSeries: SeriesDetails = {
      id: 'movie-1',
      sourceUrl: 'https://themoviedb.org/movie/550',
      source: 'tmdb',
      title: 'Fight Club',
      type: 'movie',
      tmdbId: 550,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
      episodes: [
        {
          id: 'ep-movie-1',
          title: 'Fight Club',
          videoSources: [],
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
        },
      ],
    };

    const mockMoviePreview: TmdbPreviewResult = {
      title: 'Fight Club',
      overview: 'An ticking-time-bomb insomniac...',
      posterUrl: 'https://image.tmdb.org/t/p/w500/fightclub.jpg',
      releaseDate: '1999-10-15',
      genres: ['Drama'],
      runtime: 139,
    };

    const diff = computeSyncDiff(mockMovieSeries, mockMoviePreview);

    expect(diff.totalNewEpisodes).toBe(0);
    expect(diff.totalNewSeasons).toBe(0);
    expect(diff.seasonDiffs[0].badgeText).toBe('Existing (1 eps)');
  });
});

describe('SyncTmdbModal component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiModule.fetchSeriesTmdbSyncPreview).mockRejectedValue(
      new Error('Sync preview endpoint fallback')
    );
  });

  it('renders nothing when closed', () => {
    renderWithProviders(
      <SyncTmdbModal
        open={false}
        onOpenChange={vi.fn()}
        series={mockSeriesTv}
      />
    );

    expect(screen.queryByText('Sync with TMDB')).not.toBeInTheDocument();
  });

  it('fetches TMDB snapshot on open and displays preview and diff summary', async () => {
    vi.mocked(apiModule.fetchSeriesTmdbPreview).mockResolvedValueOnce(
      mockTmdbPreview
    );

    const onOpenChange = vi.fn();
    renderWithProviders(
      <SyncTmdbModal
        open={true}
        onOpenChange={onOpenChange}
        series={mockSeriesTv}
      />
    );

    expect(screen.getByText('Sync with TMDB')).toBeInTheDocument();

    await waitFor(() => {
      expect(apiModule.fetchSeriesTmdbPreview).toHaveBeenCalledWith('tv', 1399, false);
    });

    await waitFor(() => {
      expect(screen.getByText('TMDB Snapshot Overview')).toBeInTheDocument();
    });

    // Overview details
    expect(screen.getByText('Game of Thrones')).toBeInTheDocument();
    expect(
      screen.getByText('Seven noble families fight for control of the mythical land of Westeros.')
    ).toBeInTheDocument();
    expect(screen.getByText('2011-04-17')).toBeInTheDocument();
    expect(screen.getByText('Sci-Fi & Fantasy')).toBeInTheDocument();
    expect(screen.getByText('Drama')).toBeInTheDocument();
    expect(screen.getByText('Ended')).toBeInTheDocument();

    // Diff summary
    expect(screen.getByText('+12 new episodes')).toBeInTheDocument();
    expect(screen.getByText('+1 new season')).toBeInTheDocument();

    // Season badges
    expect(screen.getByText('Existing (2 eps)')).toBeInTheDocument();
    expect(screen.getByText('+9 new eps (1 → 10)')).toBeInTheDocument();
    expect(screen.getByText('New Season (3 eps)')).toBeInTheDocument();
  });

  it('toggling "Include Specials" refetches TMDB preview with includeSpecials=true and updates diff', async () => {
    vi.mocked(apiModule.fetchSeriesTmdbPreview).mockResolvedValueOnce(
      mockTmdbPreview
    );

    const previewWithSpecials: TmdbPreviewResult = {
      ...mockTmdbPreview,
      totalEpisodes: 17,
      seasons: [
        { seasonNumber: 0, name: 'Specials', episodeCount: 2, posterUrl: null },
        ...mockTmdbPreview.seasons!,
      ],
    };
    vi.mocked(apiModule.fetchSeriesTmdbPreview).mockResolvedValueOnce(
      previewWithSpecials
    );

    const { user } = renderWithProviders(
      <SyncTmdbModal
        open={true}
        onOpenChange={vi.fn()}
        series={mockSeriesTv}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('TMDB Snapshot Overview')).toBeInTheDocument();
    });

    const specialsCheckbox = screen.getByLabelText(/Include Specials/i);
    expect(specialsCheckbox).not.toBeChecked();

    await user.click(specialsCheckbox);

    expect(apiModule.fetchSeriesTmdbPreview).toHaveBeenCalledWith('tv', 1399, true);

    await waitFor(() => {
      expect(screen.getByText('Specials')).toBeInTheDocument();
    });
    expect(screen.getByText('+14 new episodes')).toBeInTheDocument(); // 12 + 2 = 14
    expect(screen.getByText('+2 new seasons')).toBeInTheDocument(); // Specials + Season 3
  });

  it('displays warning and disables sync when series has no tmdbId', async () => {
    const seriesWithoutTmdb: SeriesDetails = {
      ...mockSeriesTv,
      tmdbId: null,
    };

    renderWithProviders(
      <SyncTmdbModal
        open={true}
        onOpenChange={vi.fn()}
        series={seriesWithoutTmdb}
      />
    );

    expect(
      screen.getByText(/This series does not have a linked TMDB ID/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Confirm & Sync/i })
    ).toBeDisabled();
  });

  it('displays error message if fetching TMDB preview fails', async () => {
    vi.mocked(apiModule.fetchSeriesTmdbPreview).mockRejectedValueOnce(
      new Error('TMDB service unavailable')
    );

    renderWithProviders(
      <SyncTmdbModal
        open={true}
        onOpenChange={vi.fn()}
        series={mockSeriesTv}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('TMDB service unavailable')).toBeInTheDocument();
    });
    expect(
      screen.getByRole('button', { name: /Confirm & Sync/i })
    ).toBeDisabled();
  });

  it('invokes syncSeriesTmdb on "Confirm & Sync", invalidates cache, shows success toast, and closes modal', async () => {
    vi.mocked(apiModule.fetchSeriesTmdbPreview).mockResolvedValueOnce(
      mockTmdbPreview
    );

    const syncedSeries: SeriesDetails = {
      ...mockSeriesTv,
      title: 'Game of Thrones (Synced)',
    };
    vi.mocked(apiModule.syncSeriesTmdb).mockResolvedValueOnce(syncedSeries);

    const onOpenChange = vi.fn();
    const { user, queryClient } = renderWithProviders(
      <SyncTmdbModal
        open={true}
        onOpenChange={onOpenChange}
        series={mockSeriesTv}
      />
    );
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await waitFor(() => {
      expect(screen.getByText('TMDB Snapshot Overview')).toBeInTheDocument();
    });

    const confirmBtn = screen.getByRole('button', { name: /Confirm & Sync/i });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(apiModule.syncSeriesTmdb).toHaveBeenCalledWith('series-tv-1', {
        type: 'tv',
        tmdbId: 1399,
        includeSpecials: false,
      });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['series', 'series-tv-1'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['series'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['episodes'] });
      expect(toast.success).toHaveBeenCalledWith(
        'Series successfully synced with TMDB (+12 new episodes)'
      );
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('displays error toast when syncSeriesTmdb fails', async () => {
    vi.mocked(apiModule.fetchSeriesTmdbPreview).mockResolvedValueOnce(
      mockTmdbPreview
    );
    vi.mocked(apiModule.syncSeriesTmdb).mockRejectedValueOnce(
      new Error('Sync database transaction failed')
    );

    const { user } = renderWithProviders(
      <SyncTmdbModal
        open={true}
        onOpenChange={vi.fn()}
        series={mockSeriesTv}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('TMDB Snapshot Overview')).toBeInTheDocument();
    });

    const confirmBtn = screen.getByRole('button', { name: /Confirm & Sync/i });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to sync with TMDB', {
        description: 'Sync database transaction failed',
      });
    });
  });

  it('closes modal when clicking Cancel', async () => {
    vi.mocked(apiModule.fetchSeriesTmdbPreview).mockResolvedValueOnce(
      mockTmdbPreview
    );

    const onOpenChange = vi.fn();
    const { user } = renderWithProviders(
      <SyncTmdbModal
        open={true}
        onOpenChange={onOpenChange}
        series={mockSeriesTv}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('TMDB Snapshot Overview')).toBeInTheDocument();
    });

    const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
    await user.click(cancelBtn);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('renders detailed episode changes when fetchSeriesTmdbSyncPreview returns metadata changes', async () => {
    const mockSyncPreviewResult: apiModule.TmdbSyncPreviewResult = {
      seriesId: mockSeriesTv.id,
      seriesUpdated: true,
      series: {
        title: 'Game of Thrones',
        overview: 'Updated show overview',
        posterUrl: 'https://image.tmdb.org/t/p/w500/got.jpg',
        backdropUrl: null,
        rating: '9.0',
        releaseDate: '2011-04-17',
        genres: ['Drama'],
        status: 'Ended',
      },
      totalNewEpisodes: 1,
      totalNewSeasons: 0,
      totalUpdatedEpisodes: 1,
      seasonDiffs: [
        {
          seasonNumber: 1,
          name: 'Season 1',
          incomingEpisodeCount: 3,
          localEpisodeCount: 2,
          diff: 1,
          isNewSeason: false,
          badgeText: '+1 new ep (2 → 3)',
          badgeType: 'new-eps',
        },
      ],
      episodeChanges: [
        {
          seasonNumber: 1,
          episodeNumber: 1,
          oldTitle: 'Winter Is Coming',
          newTitle: 'Winter Is Coming (Remastered)',
          oldOverview: 'Old overview',
          newOverview: 'New overview',
          oldThumbnailUrl: null,
          newThumbnailUrl: 'https://image.tmdb.org/t/p/w500/thumb.jpg',
          oldAirDate: '2011-04-17',
          newAirDate: '2011-04-17',
          titleChanged: true,
          overviewChanged: true,
          thumbnailChanged: true,
          airDateChanged: false,
        },
      ],
    };

    vi.mocked(apiModule.fetchSeriesTmdbSyncPreview).mockResolvedValueOnce(
      mockSyncPreviewResult
    );

    renderWithProviders(
      <SyncTmdbModal
        open={true}
        onOpenChange={vi.fn()}
        series={mockSeriesTv}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Episode Metadata Updates \(1\)/i)).toBeInTheDocument();
    });

    expect(screen.getByText('S1E1')).toBeInTheDocument();
    expect(screen.getByText('Winter Is Coming')).toBeInTheDocument();
    expect(screen.getByText('Winter Is Coming (Remastered)')).toBeInTheDocument();
    expect(screen.getByText('Title')).toBeInTheDocument();
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Thumbnail')).toBeInTheDocument();
    expect(screen.getByText('1 updated episode')).toBeInTheDocument();
  });
});
