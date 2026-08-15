import { renderWithProviders, screen, userEvent } from '../../utils';
import { describe, expect, it } from 'vitest';
import { SeriesDetailView } from '@/modules/videos/internal/SeriesDetailView';
import { MOCK_SERIES } from '@/modules/videos/internal/seriesData';
import { Toaster } from '@/components/ui/sonner';

const firstSeries = MOCK_SERIES[0];
const firstEpisode = firstSeries.episodes[0];

function firstEpisodeHeading() {
  return screen.getByRole('heading', { name: firstEpisode.title });
}

function getSeriesDetailTitle() {
  return screen.getByRole('heading', { level: 1, name: firstSeries.title });
}

describe('SeriesDetailView component', () => {
  it('renders series title and episode count', () => {
    renderWithProviders(<SeriesDetailView seriesId={firstSeries.id} />);

    expect(getSeriesDetailTitle()).toBeInTheDocument();
    expect(
      screen.getByText(`${firstSeries.episodes.length} episodes`)
    ).toBeInTheDocument();
  });

  it('renders a scrollable list of episodes in the left pane', () => {
    renderWithProviders(<SeriesDetailView seriesId={firstSeries.id} />);

    for (const episode of firstSeries.episodes) {
      expect(screen.getAllByText(episode.title).length).toBeGreaterThan(0);
    }
  });

  it('renders details pane on the right for the default selected episode', () => {
    renderWithProviders(<SeriesDetailView seriesId={firstSeries.id} />);

    expect(firstEpisodeHeading()).toBeInTheDocument();
    expect(
      screen.getAllByRole('button', { name: /play/i }).length
    ).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
  });

  it('updates the selected episode details when an item in the left pane is clicked', async () => {
    const { user } = renderWithProviders(
      <SeriesDetailView seriesId={firstSeries.id} />
    );

    const secondEpisode = firstSeries.episodes[1];
    const secondItem = screen.getByText(secondEpisode.title);
    await user.click(secondItem);

    expect(
      screen.getByRole('heading', { name: secondEpisode.title })
    ).toBeInTheDocument();
    expect(screen.getByText(secondEpisode.description)).toBeInTheDocument();
  });

  it('filters episode list based on filter input', async () => {
    const { user } = renderWithProviders(
      <SeriesDetailView seriesId={firstSeries.id} />
    );

    const searchInput = screen.getByPlaceholderText(/filter episodes/i);
    await user.type(searchInput, 'TanStack');

    expect(
      screen.getAllByText('TanStack Router Setup').length
    ).toBeGreaterThan(0);
    expect(screen.queryByText('Intro to Deep Modules')).not.toBeInTheDocument();
  });

  it('renders not found state for an unknown series', () => {
    renderWithProviders(<SeriesDetailView seriesId="unknown-series" />);

    expect(screen.getByText('Series not found')).toBeInTheDocument();
    expect(screen.getByText(/unknown-series/)).toBeInTheDocument();
  });

  it('triggers toast notifications when mock actions are clicked', async () => {
    renderWithProviders(
      <>
        <SeriesDetailView seriesId={firstSeries.id} />
        <Toaster />
      </>
    );

    const user = userEvent.setup();

    const addButton = screen.getByRole('button', { name: /\+ add episode/i });
    await user.click(addButton);
    expect(await screen.findByText(/video.create/i)).toBeInTheDocument();

    const playButtons = screen.getAllByRole('button', { name: /play/i });
    await user.click(playButtons[0]);
    expect(await screen.findByText(/video.play/i)).toBeInTheDocument();

    const editButton = screen.getByRole('button', { name: /edit/i });
    await user.click(editButton);
    expect(await screen.findByText(/video.edit/i)).toBeInTheDocument();

    const deleteButton = screen.getByRole('button', { name: /delete/i });
    await user.click(deleteButton);
    expect(await screen.findByText(/video.delete/i)).toBeInTheDocument();
  });
});
