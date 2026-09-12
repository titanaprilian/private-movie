import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../utils';

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    className,
    'aria-label': ariaLabel,
  }: {
    children: React.ReactNode;
    to: string;
    className?: string;
    'aria-label'?: string;
  }) => (
    <a href={to} className={className} aria-label={ariaLabel}>
      {children}
    </a>
  ),
}));

import { SeriesWatchView, type WatchSeriesDetails } from '@/modules/watch';

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
            {
              id: 'src-1',
              type: 'embed',
              url: 'https://embed.com/1',
              label: 'Server A',
            },
            {
              id: 'src-2',
              type: 'embed',
              url: 'https://embed.com/2',
              label: 'Server B',
            },
          ],
        },
        {
          id: 'ep-2',
          title: 'Episode Two',
          order: 2,
          seasonId: 'season-1',
          description: 'Second episode description',
          videoSources: [
            {
              id: 'src-3',
              type: 'embed',
              url: 'https://embed.com/3',
              label: 'Server A',
            },
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
            {
              id: 'src-4',
              type: 'embed',
              url: 'https://embed.com/4',
              label: 'Server A',
            },
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
    const { user } = renderWithProviders(
      <SeriesWatchView series={mockSeries} />
    );

    await user.click(screen.getByRole('button', { name: /Episode Two/i }));

    expect(getPlayer().src).toBe('https://embed.com/3');
    expect(screen.getByText('Second episode description')).toBeInTheDocument();
  });

  it('switches source without changing the active episode', async () => {
    const { user } = renderWithProviders(
      <SeriesWatchView series={mockSeries} />
    );

    await user.click(screen.getByRole('button', { name: /Server B/i }));

    expect(getPlayer().src).toBe('https://embed.com/2');
    expect(screen.getByText('First episode description')).toBeInTheDocument();
  });

  it('changes the episode list when selecting a different season', async () => {
    const { user } = renderWithProviders(
      <SeriesWatchView series={mockSeries} />
    );

    const seasonSelect = screen.getByRole('combobox', { name: /season/i });
    await user.click(seasonSelect);

    const season2Option = await screen.findByRole('option', {
      name: 'Season 2',
    });
    await user.click(season2Option);

    expect(getPlayer().src).toBe('https://embed.com/4');
    expect(screen.getByText('Episode Three')).toBeInTheDocument();
  });

  it('hides season dropdown when series has only 1 season', () => {
    const singleSeasonSeries: WatchSeriesDetails = {
      ...mockSeries,
      seasons: mockSeries.seasons ? [mockSeries.seasons[0]!] : [],
    };

    renderWithProviders(<SeriesWatchView series={singleSeasonSeries} />);

    expect(
      screen.queryByRole('combobox', { name: /season/i })
    ).not.toBeInTheDocument();
  });

  it('disables navigation buttons at the bounds of the episode list', async () => {
    const { user } = renderWithProviders(
      <SeriesWatchView series={mockSeries} />
    );

    const prevButton = screen.getByRole('button', { name: /prev/i });
    const nextButton = screen.getByRole('button', { name: /next/i });

    expect(prevButton).toBeDisabled();
    expect(nextButton).toBeEnabled();

    await user.click(nextButton);

    expect(screen.getByRole('button', { name: /prev/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();
  });

  it('renders a top-left back button that links to the home page catalogue', () => {
    renderWithProviders(<SeriesWatchView series={mockSeries} />);

    const backBtns = screen.getAllByRole('link', { name: /back/i });
    expect(backBtns.length).toBeGreaterThanOrEqual(1);
    for (const btn of backBtns) {
      expect(btn).toHaveAttribute('href', '/');
    }
  });

  it('renders sticky edge-to-edge player container and playback controls directly below player', () => {
    renderWithProviders(<SeriesWatchView series={mockSeries} />);

    const playerContainer = screen.getByTestId('watch-player-container');
    expect(playerContainer).toHaveClass(
      'sticky',
      'top-0',
      'z-20',
      '-mx-4',
      'sm:mx-0'
    );

    const controls = screen.getByTestId('watch-controls');
    expect(controls).toBeInTheDocument();
  });

  it('renders player iframe without sandbox and with media allow attributes', () => {
    renderWithProviders(<SeriesWatchView series={mockSeries} />);

    const iframe = getPlayer();
    expect(iframe).not.toHaveAttribute('sandbox');
    expect(iframe).toHaveAttribute(
      'allow',
      'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen'
    );
    expect(iframe.hasAttribute('allowfullscreen')).toBe(true);
  });

  it('renders adblock advisory confirmation modal when adblocker is not detected and not dismissed', async () => {
    localStorage.removeItem('adblock_warning_dismissed');
    vi.spyOn(window, 'fetch').mockResolvedValue(new Response(''));

    renderWithProviders(<SeriesWatchView series={mockSeries} />);

    expect(
      await screen.findByRole('heading', { name: /ad blocker recommended/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /view adblock guide/i })
    ).toHaveAttribute('href', '/guide/adblock');
    expect(
      screen.getByRole('button', { name: /continue anyway/i })
    ).toBeInTheDocument();
  });

  it('dismisses advisory modal and sets localStorage when clicking "Continue anyway"', async () => {
    localStorage.removeItem('adblock_warning_dismissed');
    vi.spyOn(window, 'fetch').mockResolvedValue(new Response(''));

    const { user } = renderWithProviders(
      <SeriesWatchView series={mockSeries} />
    );

    const continueBtn = await screen.findByRole('button', {
      name: /continue anyway/i,
    });
    await user.click(continueBtn);

    expect(localStorage.getItem('adblock_warning_dismissed')).toBe('true');
    expect(
      screen.queryByRole('heading', { name: /ad blocker recommended/i })
    ).not.toBeInTheDocument();
  });

  it('does not render advisory modal when adblock_warning_dismissed is "true" in localStorage', () => {
    localStorage.setItem('adblock_warning_dismissed', 'true');
    vi.spyOn(window, 'fetch').mockResolvedValue(new Response(''));

    renderWithProviders(<SeriesWatchView series={mockSeries} />);

    expect(
      screen.queryByRole('heading', { name: /ad blocker recommended/i })
    ).not.toBeInTheDocument();
  });

  it('does not render advisory modal when adblocker is detected', () => {
    localStorage.removeItem('adblock_warning_dismissed');
    vi.spyOn(window, 'fetch').mockRejectedValue(
      new TypeError('Failed to fetch')
    );

    renderWithProviders(<SeriesWatchView series={mockSeries} />);

    expect(
      screen.queryByRole('heading', { name: /ad blocker recommended/i })
    ).not.toBeInTheDocument();
  });
});
