import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
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
  useNavigate: () => vi.fn(),
  useSearch: () => ({}),
  useParams: () => ({ seriesId: 'series-1' }),
}));

import { SeriesWatchView, type WatchSeriesDetails } from '@/modules/watch';

const mockSeries: WatchSeriesDetails = {
  id: 'series-1',
  title: 'Test Series',
  description: 'Series description',
  backdropUrl: 'https://images.unsplash.com/photo-1?auto=format&fit=crop',
  posterUrl: 'https://images.unsplash.com/poster-1?auto=format&fit=crop',
  rating: '8.8',
  genres: ['Action', 'Fantasy'],
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
          thumbnailUrl: 'https://images.unsplash.com/thumb-1',
          duration: '24m',
          videoSources: [
            {
              id: 'src-1',
              type: 'embed',
              url: 'https://odvidhide.com/v/sample1',
              label: 'Server A',
            },
            {
              id: 'src-2',
              type: 'embed',
              url: 'https://filedon.co/embed/sample2',
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
          thumbnailUrl: 'https://images.unsplash.com/thumb-2',
          duration: '22:30',
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
          duration: '01:10:00',
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

describe('SeriesWatchView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('adblock_warning_dismissed', 'true');
  });

  afterEach(() => {
    localStorage.removeItem('adblock_warning_dismissed');
    vi.restoreAllMocks();
  });

  describe('Series Overview Mode (default when ep is not selected)', () => {
    it('renders hero banner with logo image when logoUrl is present, and renders rating, genres, synopsis and Play Episode 1 CTA', () => {
      const seriesWithLogo: WatchSeriesDetails = {
        ...mockSeries,
        logoUrl: 'https://images.unsplash.com/logo-1.png',
      };

      renderWithProviders(<SeriesWatchView series={seriesWithLogo} />);

      expect(screen.getByTestId('series-hero-banner')).toBeInTheDocument();
      // Backdrop img + Logo img present
      const images = screen.getAllByRole('img', { name: 'Test Series' });
      expect(images).toHaveLength(2);
      const logoImg = images.find((img) => img.getAttribute('src') === 'https://images.unsplash.com/logo-1.png');
      expect(logoImg).toBeInTheDocument();
      expect(logoImg).toHaveClass('drop-shadow-lg');
      expect(logoImg).toHaveClass('max-w-[220px]');
      expect(logoImg).toHaveClass('sm:max-w-[320px]');
      expect(logoImg).toHaveClass('md:max-w-[400px]');
      expect(logoImg).toHaveClass('max-h-[80px]');
      expect(logoImg).toHaveClass('sm:max-h-[120px]');
      expect(logoImg).toHaveClass('md:max-h-[150px]');

      // When logo is present, text title heading is omitted
      expect(screen.queryByRole('heading', { level: 1, name: 'Test Series' })).not.toBeInTheDocument();

      expect(screen.getByText('★ 8.8')).toBeInTheDocument();
      expect(screen.getByText('Action')).toBeInTheDocument();
      expect(screen.getByText('Fantasy')).toBeInTheDocument();
      expect(screen.getByText('Series description')).toBeInTheDocument();

      const playBtn = screen.getByRole('button', { name: /^play episode 1$/i });
      expect(playBtn).toBeInTheDocument();
    });

    it('gracefully renders text series title as fallback when logoUrl is absent', () => {
      renderWithProviders(<SeriesWatchView series={mockSeries} />);

      expect(screen.getByTestId('series-hero-banner')).toBeInTheDocument();
      // Backdrop img is present, logo img is absent, title heading fallback is rendered
      expect(screen.getByRole('heading', { level: 1, name: 'Test Series' })).toBeInTheDocument();
      const images = screen.getAllByRole('img', { name: 'Test Series' });
      expect(images).toHaveLength(1);
      expect(images[0]).toHaveAttribute('src', mockSeries.backdropUrl);
    });

    it('gracefully renders text series title as fallback when logo fails to load (onError)', () => {
      const seriesWithLogo: WatchSeriesDetails = {
        ...mockSeries,
        logoUrl: 'https://images.unsplash.com/broken-logo.png',
      };

      renderWithProviders(<SeriesWatchView series={seriesWithLogo} />);

      const images = screen.getAllByRole('img', { name: 'Test Series' });
      const logoImg = images.find((img) => img.getAttribute('src') === 'https://images.unsplash.com/broken-logo.png');
      expect(logoImg).toBeInTheDocument();

      fireEvent.error(logoImg!);

      expect(screen.getByRole('heading', { level: 1, name: 'Test Series' })).toBeInTheDocument();
      expect(screen.queryByRole('img', { name: 'Test Series' })).toHaveAttribute('src', mockSeries.backdropUrl);
    });

    it('gracefully renders text series title as fallback only when hero artwork and logo are missing', () => {
      const seriesWithoutArtwork: WatchSeriesDetails = {
        ...mockSeries,
        backdropUrl: null,
        posterUrl: null,
        logoUrl: null,
      };

      renderWithProviders(<SeriesWatchView series={seriesWithoutArtwork} />);

      expect(screen.getByTestId('series-hero-banner')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1, name: 'Test Series' })).toBeInTheDocument();
      expect(screen.queryByRole('img', { name: 'Test Series' })).not.toBeInTheDocument();
    });

    it('renders episode explorer grid with cards showing 16:9 thumbnail, duration, order, and title', () => {
      renderWithProviders(<SeriesWatchView series={mockSeries} />);

      expect(screen.getByTestId('episode-explorer')).toBeInTheDocument();
      expect(screen.getByTestId('episode-grid')).toBeInTheDocument();

      expect(screen.getByText('Episode One')).toBeInTheDocument();
      expect(screen.getByText('First episode description')).toBeInTheDocument();
      expect(screen.getByText('EP 1')).toBeInTheDocument();
      expect(screen.getByText('24m')).toBeInTheDocument();

      expect(screen.getByText('Episode Two')).toBeInTheDocument();
      expect(screen.getByText('EP 2')).toBeInTheDocument();
      expect(screen.getByText('22m')).toBeInTheDocument();
    });

    it('uses horizontal tabs for series with 2 to 4 seasons and switches episodes', async () => {
      const { user } = renderWithProviders(<SeriesWatchView series={mockSeries} />);

      const season1Tab = screen.getByRole('tab', { name: 'Season 1' });
      const season2Tab = screen.getByRole('tab', { name: 'Season 2' });

      expect(season1Tab).toBeInTheDocument();
      expect(season2Tab).toBeInTheDocument();
      expect(screen.getByText('Episode One')).toBeInTheDocument();

      await user.click(season2Tab);

      expect(screen.getByText('Episode Three')).toBeInTheDocument();
      expect(screen.getByText('1h 10m')).toBeInTheDocument();
    });

    it('uses Radix UI Select dropdown for series with more than 4 seasons', async () => {
      const multiSeasonSeries: WatchSeriesDetails = {
        ...mockSeries,
        seasons: Array.from({ length: 6 }).map((_, i) => ({
          id: `season-${i + 1}`,
          seriesId: 'series-1',
          title: `Season ${i + 1}`,
          episodes: [
            {
              id: `ep-s${i + 1}-1`,
              title: `S${i + 1} Episode 1`,
              order: 1,
              seasonId: `season-${i + 1}`,
              videoSources: [],
            },
          ],
        })),
      };

      const { user } = renderWithProviders(<SeriesWatchView series={multiSeasonSeries} />);

      const seasonSelect = screen.getByRole('combobox', { name: /season selector/i });
      expect(seasonSelect).toBeInTheDocument();

      await user.click(seasonSelect);
      const s5Option = await screen.findByRole('option', { name: 'Season 5' });
      await user.click(s5Option);

      expect(screen.getByText('S5 Episode 1')).toBeInTheDocument();
    });

    it('hides season switcher when series has only 1 season', () => {
      const singleSeasonSeries: WatchSeriesDetails = {
        ...mockSeries,
        seasons: [mockSeries.seasons![0]!],
      };

      renderWithProviders(<SeriesWatchView series={singleSeasonSeries} />);

      expect(screen.queryByRole('tab', { name: /season/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('combobox', { name: /season/i })).not.toBeInTheDocument();
    });

    it('transitions to Player Mode when clicking "Play Episode 1" in hero banner', async () => {
      const { user } = renderWithProviders(<SeriesWatchView series={mockSeries} />);

      expect(screen.queryByTestId('watch-player')).not.toBeInTheDocument();

      const playFirstBtn = screen.getByRole('button', { name: /^play episode 1$/i });
      await user.click(playFirstBtn);

      expect(screen.getByTestId('watch-player')).toBeInTheDocument();
      const iframe = screen.getByTestId('watch-player') as HTMLIFrameElement;
      expect(iframe).toHaveAttribute('src', '/api/media/proxy/odvidhide.com/v/sample1');
      expect(screen.getByTestId('active-episode-overview')).toBeInTheDocument();
    });

    it('transitions to Player Mode when clicking an episode card', async () => {
      const { user } = renderWithProviders(<SeriesWatchView series={mockSeries} />);

      const ep2Card = screen.getByRole('button', { name: /play episode 2: episode two/i });
      await user.click(ep2Card);

      expect(screen.getByTestId('watch-player')).toBeInTheDocument();
      const iframe = screen.getByTestId('watch-player') as HTMLIFrameElement;
      expect(iframe.src).toBe('https://embed.com/3');
      expect(screen.getByTestId('active-episode-overview')).toBeInTheDocument();
      expect(screen.getByText('EP 2 — Episode Two')).toBeInTheDocument();
    });

    it('gracefully falls back episode thumbnail hierarchy and handles missing description', () => {
      const seriesWithFallbacks: WatchSeriesDetails = {
        id: 'series-fallback',
        title: 'Fallback Series',
        backdropUrl: 'https://fallback-backdrop.jpg',
        posterUrl: 'https://fallback-poster.jpg',
        seasons: [
          {
            id: 'season-fb',
            seriesId: 'series-fallback',
            title: 'Season 1',
            episodes: [
              {
                id: 'ep-no-thumb',
                title: 'No Thumb Episode',
                order: 1,
                seasonId: 'season-fb',
                description: null,
                duration: null,
                videoSources: [],
              },
            ],
          },
        ],
        episodes: [],
      };

      renderWithProviders(<SeriesWatchView series={seriesWithFallbacks} />);

      expect(screen.getByText('No Thumb Episode')).toBeInTheDocument();
      expect(screen.getByText('No description available for this episode')).toBeInTheDocument();
      const img = screen.getByRole('img', { name: 'No Thumb Episode' });
      expect(img).toHaveAttribute('src', 'https://fallback-backdrop.jpg');
    });
  });

  describe('Player Mode (when ep is selected)', () => {
    it('mounts the specified episode and renders player, controls, active episode overview, and episode grid', () => {
      renderWithProviders(
        <SeriesWatchView series={mockSeries} initialEpisodeId="ep-2" />
      );

      const iframe = screen.getByTestId('watch-player') as HTMLIFrameElement;
      expect(iframe.src).toBe('https://embed.com/3');
      expect(iframe).not.toHaveAttribute('sandbox');
      expect(iframe).toHaveAttribute(
        'allow',
        'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen'
      );
      expect(iframe).toHaveAttribute('allowFullScreen');

      expect(screen.getByTestId('watch-controls')).toBeInTheDocument();
      expect(screen.getByTestId('active-episode-overview')).toBeInTheDocument();
      expect(screen.getByText('EP 2 — Episode Two')).toBeInTheDocument();
      expect(screen.getByTestId('episode-grid')).toBeInTheDocument();
    });

    it('switches video sources via toolbar buttons', async () => {
      const { user } = renderWithProviders(
        <SeriesWatchView series={mockSeries} initialEpisodeId="ep-1" />
      );

      const iframe = screen.getByTestId('watch-player') as HTMLIFrameElement;
      expect(iframe).toHaveAttribute('src', '/api/media/proxy/odvidhide.com/v/sample1');

      await user.click(screen.getByRole('button', { name: 'Server B' }));
      expect(iframe).toHaveAttribute('src', '/api/media/proxy/filedon.co/embed/sample2');
    });

    it('navigates next and previous episodes with boundary disabling', async () => {
      const { user } = renderWithProviders(
        <SeriesWatchView series={mockSeries} initialEpisodeId="ep-1" />
      );

      const prevButton = screen.getByRole('button', { name: /prev/i });
      const nextButton = screen.getByRole('button', { name: /next/i });

      expect(prevButton).toBeDisabled();
      expect(nextButton).toBeEnabled();

      await user.click(nextButton);

      expect(screen.getByText('EP 2 — Episode Two')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /prev/i })).toBeEnabled();
      expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();

      // Click Prev to return to Episode One
      await user.click(screen.getByRole('button', { name: /prev/i }));
      expect(screen.getByText('EP 1 — Episode One')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /prev/i })).toBeDisabled();
    });

    it('highlights active episode with "Now Playing" badge and sets poster background', () => {
      renderWithProviders(
        <SeriesWatchView series={mockSeries} initialEpisodeId="ep-1" />
      );

      expect(screen.getByText(/now playing/i)).toBeInTheDocument();

      const playerContainer = screen.getByTestId('watch-player-container');
      const playerFrame = playerContainer.firstElementChild;
      expect(playerFrame).toHaveStyle({
        backgroundImage: 'url(https://images.unsplash.com/thumb-1)',
      });
    });

    it('returns to overview when clicking "Back to Overview"', async () => {
      const { user } = renderWithProviders(
        <SeriesWatchView series={mockSeries} initialEpisodeId="ep-1" />
      );

      expect(screen.getByTestId('watch-player')).toBeInTheDocument();

      const backToOverviewBtn = screen.getByRole('button', { name: /back to series overview/i });
      await user.click(backToOverviewBtn);

      expect(screen.queryByTestId('watch-player')).not.toBeInTheDocument();
      expect(screen.getByTestId('series-hero-banner')).toBeInTheDocument();
    });
  });

  describe('Adblock modal', () => {
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
  });
});
