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

  it('renders modal title, description, seasons list, checkboxes, and drag handles when open', () => {
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
    expect(screen.getByTestId('season-checkbox-season-part-1')).toBeChecked();
    expect(screen.getByTestId('season-checkbox-season-part-2')).toBeChecked();
    expect(screen.getByLabelText('Reorder Attack on Titan Part 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Reorder Attack on Titan Part 2')).toBeInTheDocument();
  });

  it('disables Confirm Merge button unless at least 2 seasons are checked', async () => {
    const { user } = renderWithProviders(
      <MergeSeasonsModal
        seriesId="series-123"
        seasons={mockSeasons}
        open={true}
        onOpenChange={vi.fn()}
      />
    );

    const confirmBtn = screen.getByRole('button', { name: /Confirm Merge/i });
    expect(confirmBtn).not.toBeDisabled();

    // Uncheck Part 1 (only 1 checked season remaining)
    const checkboxPart1 = screen.getByTestId('season-checkbox-season-part-1');
    await user.click(checkboxPart1);

    expect(confirmBtn).toBeDisabled();

    // Check Part 1 back (2 checked seasons)
    await user.click(checkboxPart1);
    expect(confirmBtn).not.toBeDisabled();
  });

  it('dynamically designates first selected season as Primary Season when top season is unchecked', async () => {
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

    // Uncheck Part 1
    const checkboxPart1 = screen.getByTestId('season-checkbox-season-part-1');
    await user.click(checkboxPart1);

    expect(part1Row).not.toHaveTextContent('Primary Season');
    expect(part2Row).toHaveTextContent('Primary Season');
  });

  it('submits only checked season IDs to backend API and excludes unchecked items from payload', async () => {
    const threeSeasons: SeasonDetails[] = [
      ...mockSeasons,
      {
        id: 'season-part-3',
        seriesId: 'series-123',
        sourceUrl: 'https://otakudesu.cloud/anime/aot-part-3',
        source: 'otakudesu',
        title: 'Attack on Titan Part 3',
        description: 'Part 3',
        tmdbSeason: 1,
        createdAt: '2026-08-10',
        updatedAt: '2026-08-10',
        episodes: [],
      },
    ];

    const mockMergeResponse = {
      data: {
        data: {
          primarySeasonId: 'season-part-1',
          episodesReordered: 3,
        },
      },
    };

    vi.mocked((api.series as any)['series-123'].seasons.merge.post).mockResolvedValueOnce(mockMergeResponse);

    const onOpenChange = vi.fn();
    const { user, queryClient } = renderWithProviders(
      <MergeSeasonsModal
        seriesId="series-123"
        seasons={threeSeasons}
        open={true}
        onOpenChange={onOpenChange}
      />
    );

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    // Uncheck Part 2 (middle season)
    const checkboxPart2 = screen.getByTestId('season-checkbox-season-part-2');
    await user.click(checkboxPart2);

    // Confirm Merge
    const confirmBtn = screen.getByRole('button', { name: /Confirm Merge/i });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect((api.series as any)['series-123'].seasons.merge.post).toHaveBeenCalledWith({
        orderedSeasonIds: ['season-part-1', 'season-part-3'],
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
