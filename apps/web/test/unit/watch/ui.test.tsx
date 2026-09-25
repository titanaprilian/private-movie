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
  type: 'tv',
  backdropUrl: 'https://images.unsplash.com/photo-1?auto=format&fit=crop',
  posterUrl: 'https://images.unsplash.com/poster-1?auto=format&fit=crop',
  logoUrl: null,
  isFeatured: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  rating: '8.8',
  genres: [
    { id: 'g-1', name: 'Action', slug: 'action' },
    { id: 'g-2', name: 'Fantasy', slug: 'fantasy' },
  ],
  seasons: [
    {
      id: 'season-1',
      seriesId: 'series-1',
      title: 'Season 1',
      description: null,
      posterUrl: null,
      seasonNumber: 1,
      status: 'completed',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      episodes: [
        {
          id: 'ep-1',
          title: 'Episode One',
          order: 1,
          seasonId: 'season-1',
          description: 'First episode description',
          thumbnailUrl: 'https://images.unsplash.com/thumb-1',
          duration: '24m',
          rating: '8.8',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          videoSources: [
            {
              id: 'src-1',
              episodeId: 'ep-1',
              type: 'embed',
              url: 'https://odvidhide.com/v/sample1',
              label: 'Server A',
              quality: '1080p',
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-01T00:00:00.000Z',
            },
            {
              id: 'src-2',
              episodeId: 'ep-1',
              type: 'embed',
              url: 'https://filedon.co/embed/sample2',
              label: 'Server B',
              quality: '720p',
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-01T00:00:00.000Z',
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
          rating: '8.8',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          videoSources: [
            {
              id: 'src-3',
              episodeId: 'ep-2',
              type: 'embed',
              url: 'https://embed.com/3',
              label: 'Server A',
              quality: '1080p',
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-01T00:00:00.000Z',
            },
          ],
        },
      ],
    },
    {
      id: 'season-2',
      seriesId: 'series-1',
      title: 'Season 2',
      description: null,
      posterUrl: null,
      seasonNumber: 2,
      status: 'completed',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      episodes: [
        {
          id: 'ep-3',
          title: 'Episode Three',
          order: 1,
          seasonId: 'season-2',
          description: 'Third episode description',
          thumbnailUrl: null,
          duration: '01:10:00',
          rating: '8.8',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          videoSources: [
            {
              id: 'src-4',
              episodeId: 'ep-3',
              type: 'embed',
              url: 'https://embed.com/4',
              label: 'Server A',
              quality: '1080p',
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-01T00:00:00.000Z',
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
      // Mobile poster img + Desktop backdrop img + Logo img present
      const images = screen.getAllByRole('img', { name: 'Test Series' });
      expect(images).toHaveLength(3);
      expect(screen.getByTestId('hero-bg-mobile')).toHaveAttribute(
        'src',
        mockSeries.posterUrl
      );
      expect(screen.getByTestId('hero-bg-desktop')).toHaveAttribute(
        'src',
        mockSeries.backdropUrl
      );
      const logoImg = images.find((img) => img.getAttribute('src') === 'https://images.unsplash.com/logo-1.png');
      expect(logoImg).toBeInTheDocument();
      expect(logoImg).toHaveAttribute('data-testid', 'hero-logo');
      expect(logoImg).toHaveClass('drop-shadow-md');
      expect(logoImg).toHaveClass('max-w-[220px]');
      expect(logoImg).toHaveClass('sm:max-w-[320px]');
      expect(logoImg).toHaveClass('md:max-w-[400px]');
      expect(logoImg).toHaveClass('max-h-[80px]');
      expect(logoImg).toHaveClass('sm:max-h-[120px]');
      expect(logoImg).toHaveClass('md:max-h-[150px]');

      // When logo is present, text title heading is omitted
      expect(screen.queryByRole('heading', { level: 1, name: 'Test Series' })).not.toBeInTheDocument();

      expect(screen.getByTestId('hero-rating')).toHaveTextContent('8.8');
      expect(screen.getByTestId('hero-meta')).toHaveTextContent('2026');
      expect(screen.getByText('Action')).toBeInTheDocument();
      expect(screen.getByText('Fantasy')).toBeInTheDocument();
      expect(screen.getByText('Series description')).toBeInTheDocument();

      const playBtn = screen.getByRole('button', { name: /^play episode 1$/i });
      expect(playBtn).toBeInTheDocument();
    });

    it('gracefully renders text series title as fallback when logoUrl is absent', () => {
      renderWithProviders(<SeriesWatchView series={mockSeries} />);

      expect(screen.getByTestId('series-hero-banner')).toBeInTheDocument();
      // Mobile + desktop artwork present, logo img absent, title heading fallback rendered
      expect(screen.getByRole('heading', { level: 1, name: 'Test Series' })).toBeInTheDocument();
      const images = screen.getAllByRole('img', { name: 'Test Series' });
      expect(images).toHaveLength(2);
      expect(screen.getByTestId('hero-bg-mobile')).toHaveAttribute(
        'src',
        mockSeries.posterUrl
      );
      expect(screen.getByTestId('hero-bg-desktop')).toHaveAttribute(
        'src',
        mockSeries.backdropUrl
      );
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
      const remaining = screen.getAllByRole('img', { name: 'Test Series' });
      expect(remaining).toHaveLength(2);
      expect(screen.getByTestId('hero-bg-mobile')).toHaveAttribute(
        'src',
        mockSeries.posterUrl
      );
      expect(screen.getByTestId('hero-bg-desktop')).toHaveAttribute(
        'src',
        mockSeries.backdropUrl
      );
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
          description: null,
          posterUrl: null,
          seasonNumber: i + 1,
          status: 'completed',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          episodes: [
            {
              id: `ep-s${i + 1}-1`,
              title: `S${i + 1} Episode 1`,
              order: 1,
              seasonId: `season-${i + 1}`,
              description: null,
              thumbnailUrl: null,
              rating: '8.8',
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-01T00:00:00.000Z',
              videoSources: [
                {
                  id: `src-s${i + 1}-1`,
                  episodeId: `ep-s${i + 1}-1`,
                  type: 'embed',
                  url: `https://embed.com/s${i + 1}`,
                  label: 'Server 1',
                  quality: '1080p',
                  createdAt: '2026-01-01T00:00:00.000Z',
                  updatedAt: '2026-01-01T00:00:00.000Z',
                },
              ],
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
        ...mockSeries,
        id: 'series-fallback',
        title: 'Fallback Series',
        description: null,
        type: 'tv',
        backdropUrl: 'https://fallback-backdrop.jpg',
        posterUrl: 'https://fallback-poster.jpg',
        logoUrl: null,
        rating: '8.8',
        isFeatured: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        genres: [],
        seasons: [
          {
            id: 'season-fb',
            seriesId: 'series-fallback',
            title: 'Season 1',
            description: null,
            posterUrl: null,
            seasonNumber: 1,
            status: 'completed',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
            episodes: [
              {
                id: 'ep-no-thumb',
                title: 'No Thumb Episode',
                order: 1,
                seasonId: 'season-fb',
                description: null,
                thumbnailUrl: null,
                rating: '8.8',
                createdAt: '2026-01-01T00:00:00.000Z',
                updatedAt: '2026-01-01T00:00:00.000Z',
                duration: null,
                videoSources: [
                  {
                    id: 'src-fb-1',
                    episodeId: 'ep-no-thumb',
                    type: 'embed',
                    url: 'https://embed.com/fb1',
                    label: 'Server 1',
                    quality: '1080p',
                    createdAt: '2026-01-01T00:00:00.000Z',
                    updatedAt: '2026-01-01T00:00:00.000Z',
                  },
                ],
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

    it('switches video sources via Radix server dropdown', async () => {
      const { user } = renderWithProviders(
        <SeriesWatchView series={mockSeries} initialEpisodeId="ep-1" />
      );

      const iframe = screen.getByTestId('watch-player') as HTMLIFrameElement;
      expect(iframe).toHaveAttribute('src', '/api/media/proxy/odvidhide.com/v/sample1');

      // Toolbar stays on a clean non-wrapping single row
      const controls = screen.getByTestId('watch-controls');
      expect(controls.className).toMatch('flex-nowrap');
      expect(controls.className).not.toMatch('flex-wrap');

      // Trigger shows server icon, "Server:" label, current source and count
      const trigger = screen.getByRole('combobox', { name: /server selector/i });
      expect(trigger).toBeInTheDocument();
      expect(trigger).toHaveTextContent('Server:');
      expect(trigger).toHaveTextContent('Server A');
      expect(trigger).toHaveTextContent('(2 available)');
      expect(trigger.querySelector('svg')).toBeInTheDocument();

      await user.click(trigger);
      const option = await screen.findByRole('option', { name: /server b/i });
      expect(option).toHaveTextContent('Server B');
      await user.click(option);

      expect(iframe).toHaveAttribute('src', '/api/media/proxy/filedon.co/embed/sample2');
      expect(screen.getByRole('combobox', { name: /server selector/i })).toHaveTextContent('Server B');
    });

    it('displays single source cleanly without count badge', () => {
      renderWithProviders(
        <SeriesWatchView series={mockSeries} initialEpisodeId="ep-2" />
      );

      const trigger = screen.getByRole('combobox', { name: /server selector/i });
      expect(trigger).toHaveTextContent('Server:');
      expect(trigger).toHaveTextContent('Server A');
      expect(trigger).not.toHaveTextContent('available');
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

    it('falls back to Series Overview mode when direct link references an unplayable episode (0 video sources)', () => {
      const seriesWithUnplayable: WatchSeriesDetails = {
        ...mockSeries,
        seasons: [
          {
            id: 'season-1',
            seriesId: 'series-1',
            title: 'Season 1',
            description: null,
            posterUrl: null,
            seasonNumber: 1,
            status: 'completed',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
            episodes: [
              {
                id: 'ep-playable',
                title: 'Playable Ep',
                order: 1,
                seasonId: 'season-1',
                description: null,
                thumbnailUrl: null,
                rating: '8.8',
                createdAt: '2026-01-01T00:00:00.000Z',
                updatedAt: '2026-01-01T00:00:00.000Z',
                videoSources: [
                  {
                    id: 'src-1',
                    episodeId: 'ep-playable',
                    type: 'embed',
                    url: 'https://embed.com/1',
                    label: 'Server 1',
                    quality: '1080p',
                    createdAt: '2026-01-01T00:00:00.000Z',
                    updatedAt: '2026-01-01T00:00:00.000Z',
                  },
                ],
              },
              {
                id: 'ep-unplayable',
                title: 'Unplayable Ep',
                order: 2,
                seasonId: 'season-1',
                description: null,
                thumbnailUrl: null,
                rating: '8.8',
                createdAt: '2026-01-01T00:00:00.000Z',
                updatedAt: '2026-01-01T00:00:00.000Z',
                videoSources: [],
              },
            ],
          },
        ],
      };

      renderWithProviders(
        <SeriesWatchView series={seriesWithUnplayable} initialEpisodeId="ep-unplayable" />
      );

      // Should fall back to overview mode instead of player mode
      expect(screen.queryByTestId('watch-player')).not.toBeInTheDocument();
      expect(screen.getByTestId('series-hero-banner')).toBeInTheDocument();
      expect(screen.getByText('Playable Ep')).toBeInTheDocument();
      expect(screen.queryByText('Unplayable Ep')).not.toBeInTheDocument();
    });

    it('disables "Play Episode 1" CTA button and shows empty state when zero playable episodes exist across series', () => {
      const seriesWithoutPlayable: WatchSeriesDetails = {
        ...mockSeries,
        seasons: [
          {
            id: 'season-1',
            seriesId: 'series-1',
            title: 'Season 1',
            description: null,
            posterUrl: null,
            seasonNumber: 1,
            status: 'completed',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
            episodes: [
              {
                id: 'ep-no-source-1',
                title: 'No Source 1',
                order: 1,
                seasonId: 'season-1',
                description: null,
                thumbnailUrl: null,
                rating: '8.8',
                createdAt: '2026-01-01T00:00:00.000Z',
                updatedAt: '2026-01-01T00:00:00.000Z',
                videoSources: [],
              },
            ],
          },
        ],
      };

      renderWithProviders(<SeriesWatchView series={seriesWithoutPlayable} />);

      const playBtn = screen.getByRole('button', { name: /^play episode 1$/i });
      expect(playBtn).toBeDisabled();
      expect(screen.getByText('No episodes available for this season.')).toBeInTheDocument();
      expect(screen.getByText('0 Episodes')).toBeInTheDocument();
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
