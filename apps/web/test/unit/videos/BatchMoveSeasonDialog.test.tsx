import { renderWithProviders, screen, userEvent } from '../../utils';
import { describe, expect, it, vi } from 'vitest';
import { BatchMoveSeasonDialog } from '@/modules/videos/internal/BatchMoveSeasonDialog';

const mockSeasons = [
  {
    id: 'season-1',
    seriesId: 'series-1',
    title: 'Season 1',
    description: null,
    posterUrl: null,
    sourceUrl: 'https://example.com/s1',
    source: 'otakudesu',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    tmdbSeason: 1,
    episodes: [],
  },
  {
    id: 'season-2',
    seriesId: 'series-1',
    title: 'Season 2',
    description: null,
    posterUrl: null,
    sourceUrl: 'https://example.com/s2',
    source: 'otakudesu',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    tmdbSeason: 2,
    episodes: [],
  },
  {
    id: 'season-3',
    seriesId: 'series-1',
    title: 'Season 3',
    description: null,
    posterUrl: null,
    sourceUrl: 'https://example.com/s3',
    source: 'otakudesu',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    tmdbSeason: 3,
    episodes: [],
  },
];

describe('BatchMoveSeasonDialog Component', () => {
  it('renders destination season selector using Radix UI Select and allows choosing target season', async () => {
    const user = userEvent.setup();
    const onConfirmMove = vi.fn();
    const onOpenChange = vi.fn();

    renderWithProviders(
      <BatchMoveSeasonDialog
        open={true}
        onOpenChange={onOpenChange}
        selectedEpisodeCount={3}
        seasons={mockSeasons}
        currentSeasonId="season-1"
        onConfirmMove={onConfirmMove}
      />
    );

    expect(screen.getByText('Move Episodes to Season')).toBeInTheDocument();
    expect(screen.getByText(/Select a target season to move 3 episodes/i)).toBeInTheDocument();

    const selectTrigger = screen.getByRole('combobox', { name: /select destination season/i });
    expect(selectTrigger).toBeInTheDocument();
    expect(selectTrigger).toHaveTextContent('Season 2');

    // Open Radix Select and pick Season 3
    await user.click(selectTrigger);
    const season3Option = await screen.findByRole('option', { name: 'Season 3' });
    await user.click(season3Option);

    expect(selectTrigger).toHaveTextContent('Season 3');

    // Confirm move
    const moveBtn = screen.getByRole('button', { name: /move episodes/i });
    await user.click(moveBtn);

    expect(onConfirmMove).toHaveBeenCalledWith('season-3');
  });

  it('handles cancel button click', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    renderWithProviders(
      <BatchMoveSeasonDialog
        open={true}
        onOpenChange={onOpenChange}
        selectedEpisodeCount={1}
        seasons={mockSeasons}
        currentSeasonId="season-1"
        onConfirmMove={vi.fn()}
      />
    );

    const cancelBtn = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelBtn);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
