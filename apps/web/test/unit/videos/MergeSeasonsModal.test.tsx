import { renderWithProviders, screen, waitFor } from '../../utils';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MergeSeasonsModal } from '@/modules/videos/internal/MergeSeasonsModal';
import type { SeasonDetails } from '@/modules/videos/internal/api';
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
        seasons: {
          merge: {
            post: vi.fn(),
          },
        },
      },
    },
  },
}));

const mockSeasons: SeasonDetails[] = [
  {
    id: 'season-part-1',
    seriesId: 'series-123',
    sourceUrl: 'https://otakudesu.cloud/anime/aot-part-1',
    source: 'otakudesu',
    title: 'Attack on Titan Part 1',
    description: 'Part 1',
    tmdbSeason: 1,
    createdAt: '2026-08-10',
    updatedAt: '2026-08-10',
    episodes: [
      {
        id: 'ep-1',
        sourceUrl: 'https://otakudesu.cloud/ep-1',
        source: 'otakudesu',
        title: 'Episode 1',
        videoSources: [],
        createdAt: '2026-08-10',
        updatedAt: '2026-08-10',
      },
    ],
  },
  {
    id: 'season-part-2',
    seriesId: 'series-123',
    sourceUrl: 'https://otakudesu.cloud/anime/aot-part-2',
    source: 'otakudesu',
    title: 'Attack on Titan Part 2',
    description: 'Part 2',
    tmdbSeason: 1,
    createdAt: '2026-08-10',
    updatedAt: '2026-08-10',
    episodes: [
      {
        id: 'ep-2',
        sourceUrl: 'https://otakudesu.cloud/ep-2',
        source: 'otakudesu',
        title: 'Episode 2',
        videoSources: [],
        createdAt: '2026-08-10',
        updatedAt: '2026-08-10',
      },
    ],
  },
];

describe('MergeSeasonsModal component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when closed', () => {
    const { container } = renderWithProviders(
      <MergeSeasonsModal
        seriesId="series-123"
        seasons={mockSeasons}
        open={false}
        onOpenChange={vi.fn()}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders modal title, description, and seasons list when open', () => {
    renderWithProviders(
      <MergeSeasonsModal
        seriesId="series-123"
        seasons={mockSeasons}
        open={true}
        onOpenChange={vi.fn()}
      />
    );

    expect(screen.getByText('Merge Seasons')).toBeInTheDocument();
    expect(screen.getByText('Attack on Titan Part 1')).toBeInTheDocument();
    expect(screen.getByText('Attack on Titan Part 2')).toBeInTheDocument();
    expect(screen.getByText('Primary Season')).toBeInTheDocument();
  });

  it('designates index 0 as Primary Season and updates primary season badge when reordering', async () => {
    const { user } = renderWithProviders(
      <MergeSeasonsModal
        seriesId="series-123"
        seasons={mockSeasons}
        open={true}
        onOpenChange={vi.fn()}
      />
    );

    const part1Row = screen.getByTestId('season-row-season-part-1');
    const part2Row = screen.getByTestId('season-row-season-part-2');

    expect(part1Row).toHaveTextContent('Primary Season');
    expect(part2Row).not.toHaveTextContent('Primary Season');

    // Move Part 2 up to index 0
    const movePart2UpBtn = screen.getByRole('button', { name: 'Move Attack on Titan Part 2 up' });
    await user.click(movePart2UpBtn);

    expect(part2Row).toHaveTextContent('Primary Season');
    expect(part1Row).not.toHaveTextContent('Primary Season');
  });

  it('submits orderedSeasonIds with 0-index primary season to backend API and invalidates query cache', async () => {
    const mockMergeResponse = {
      data: {
        data: {
          primarySeasonId: 'season-part-2',
          episodesReordered: 2,
        },
      },
    };

    vi.mocked((api.series as any)['series-123'].seasons.merge.post).mockResolvedValueOnce(mockMergeResponse);

    const onOpenChange = vi.fn();
    const { user, queryClient } = renderWithProviders(
      <MergeSeasonsModal
        seriesId="series-123"
        seasons={mockSeasons}
        open={true}
        onOpenChange={onOpenChange}
      />
    );

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    // Move Part 2 up to be index 0 (Primary)
    const movePart2UpBtn = screen.getByRole('button', { name: 'Move Attack on Titan Part 2 up' });
    await user.click(movePart2UpBtn);

    // Confirm Merge
    const confirmBtn = screen.getByRole('button', { name: /Confirm Merge/i });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect((api.series as any)['series-123'].seasons.merge.post).toHaveBeenCalledWith({
        orderedSeasonIds: ['season-part-2', 'season-part-1'],
      });
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['series', 'series-123'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['series'] });
      expect(toast.success).toHaveBeenCalledWith('Seasons merged successfully');
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('shows error toast when merge request fails', async () => {
    const mockErrorResponse = {
      error: {
        value: {
          message: 'Failed to execute season merge transaction',
        },
      },
    };

    vi.mocked((api.series as any)['series-123'].seasons.merge.post).mockResolvedValueOnce(mockErrorResponse);

    const { user } = renderWithProviders(
      <MergeSeasonsModal
        seriesId="series-123"
        seasons={mockSeasons}
        open={true}
        onOpenChange={vi.fn()}
      />
    );

    const confirmBtn = screen.getByRole('button', { name: /Confirm Merge/i });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to execute season merge transaction');
    });
  });
});
