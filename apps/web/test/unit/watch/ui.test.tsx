import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { SeriesWatchView, type WatchSeriesDetails } from '@/modules/watch';
import { renderWithProviders } from '../../utils';

const mockSeries: WatchSeriesDetails = {
  id: 'series-1',
  title: 'Test Series',
  description: 'Series description',
  seasons: [
    {
      id: 'season-1',
      seriesId: 'series-1',
      title: 'Season 1',
      episodes: [
        {
          id: 'ep-1',
          title: 'Episode One',
          order: 1,
          seasonId: 'season-1',
          description: 'First episode description',
          videoSources: [
            { id: 'src-1', type: 'embed', url: 'https://embed.com/1', label: 'Server A' },
            { id: 'src-2', type: 'embed', url: 'https://embed.com/2', label: 'Server B' },
          ],
        },
        {
          id: 'ep-2',
          title: 'Episode Two',
          order: 2,
          seasonId: 'season-1',
          description: 'Second episode description',
          videoSources: [
            { id: 'src-3', type: 'embed', url: 'https://embed.com/3', label: 'Server A' },
          ],
        },
      ],
    },
    {
      id: 'season-2',
      seriesId: 'series-1',
      title: 'Season 2',
      episodes: [
        {
          id: 'ep-3',
          title: 'Episode Three',
          order: 1,
          seasonId: 'season-2',
          description: 'Third episode description',
          videoSources: [
            { id: 'src-4', type: 'embed', url: 'https://embed.com/4', label: 'Server A' },
          ],
        },
      ],
    },
  ],
  episodes: [],
};

function getPlayer(): HTMLIFrameElement {
  return screen.getByTestId('watch-player') as HTMLIFrameElement;
}

describe('SeriesWatchView', () => {
  it('mounts the default episode and its default source', () => {
    renderWithProviders(<SeriesWatchView series={mockSeries} />);

    expect(getPlayer().src).toBe('https://embed.com/1');
    expect(screen.getByText('First episode description')).toBeInTheDocument();
    expect(screen.getByText('Test Series')).toBeInTheDocument();
  });

  it('updates the iframe source when selecting an episode card', async () => {
    const { user } = renderWithProviders(<SeriesWatchView series={mockSeries} />);

    await user.click(screen.getByRole('button', { name: /Episode Two/i }));

    expect(getPlayer().src).toBe('https://embed.com/3');
    expect(screen.getByText('Second episode description')).toBeInTheDocument();
  });

  it('switches source without changing the active episode', async () => {
    const { user } = renderWithProviders(<SeriesWatchView series={mockSeries} />);

    await user.click(screen.getByRole('button', { name: /Server B/i }));

    expect(getPlayer().src).toBe('https://embed.com/2');
    expect(screen.getByText('First episode description')).toBeInTheDocument();
  });

  it('changes the episode list when selecting a different season', async () => {
    const { user } = renderWithProviders(<SeriesWatchView series={mockSeries} />);

    await user.selectOptions(screen.getByLabelText(/season/i), 'season-2');

    expect(getPlayer().src).toBe('https://embed.com/4');
    expect(screen.getByText('Episode Three')).toBeInTheDocument();
  });

  it('disables navigation buttons at the bounds of the episode list', async () => {
    const { user } = renderWithProviders(<SeriesWatchView series={mockSeries} />);

    const prevButton = screen.getByRole('button', { name: /prev/i });
    const nextButton = screen.getByRole('button', { name: /next/i });

    expect(prevButton).toBeDisabled();
    expect(nextButton).toBeEnabled();

    await user.click(nextButton);

    expect(screen.getByRole('button', { name: /prev/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();
  });
});