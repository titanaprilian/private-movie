import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';

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
  useParams: () => ({ seriesId: 'series-real-1' }),
}));

import { SeriesWatchView, type WatchSeriesDetails } from '@/modules/watch';
import { renderWithProviders } from '../../utils';

const seriesMockMap = new Map<string, unknown>();

vi.mock('@/lib/api', () => ({
  api: {
    series: new Proxy(
      {},
      {
        get: (_target, prop: string) => {
          return (
            seriesMockMap.get(prop) ?? {
              get: () =>
                Promise.resolve({
                  error: {
                    value: { message: 'Failed to fetch series details' },
                  },
                }),
            }
          );
        },
      }
    ),
  },
}));

const mockSeriesPayload: WatchSeriesDetails = {
  id: 'series-real-1',
  title: 'Real DB Series Title',
  description: 'Real DB Series Description',
  type: 'tv',
  posterUrl: 'https://images.unsplash.com/real-poster.jpg',
  backdropUrl: 'https://images.unsplash.com/real-backdrop.jpg',
  logoUrl: null,
  isFeatured: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  rating: '9.0',
  genres: [
    { id: 'g-1', name: 'Action', slug: 'action' },
    { id: 'g-2', name: 'Fantasy', slug: 'fantasy' },
  ],
  seasons: [
    {
      id: 'season-1',
      seriesId: 'series-real-1',
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
          title: 'Database Episode One',
          order: 1,
          seasonId: 'season-1',
          description: 'Database Episode One Description',
          thumbnailUrl: 'https://images.unsplash.com/ep1.jpg',
          duration: '24m',
          rating: '9.0',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          videoSources: [
            {
              id: 'src-1',
              episodeId: 'ep-1',
              type: 'embed',
              url: 'https://mirror-a.com/embed1',
              label: 'Server Alpha',
              quality: '1080p',
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-01T00:00:00.000Z',
            },
            {
              id: 'src-2',
              episodeId: 'ep-1',
              type: 'embed',
              url: 'https://mirror-b.com/embed1',
              label: 'Server Beta',
              quality: '720p',
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-01T00:00:00.000Z',
            },
          ],
        },
        {
          id: 'ep-2',
          title: 'Database Episode Two',
          order: 2,
          seasonId: 'season-1',
          description: 'Database Episode Two Description',
          thumbnailUrl: 'https://images.unsplash.com/ep2.jpg',
          duration: '25m',
          rating: '9.0',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          videoSources: [
            {
              id: 'src-3',
              episodeId: 'ep-2',
              type: 'embed',
              url: 'https://mirror-a.com/embed2',
              label: 'Server Alpha',
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
      seriesId: 'series-real-1',
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
          title: 'Database Episode Three',
          order: 1,
          seasonId: 'season-2',
          description: 'Database Episode Three Description',
          thumbnailUrl: 'https://images.unsplash.com/ep3.jpg',
          duration: '26m',
          rating: '9.0',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          videoSources: [
            {
              id: 'src-4',
              episodeId: 'ep-3',
              type: 'embed',
              url: 'https://mirror-a.com/embed3',
              label: 'Server Alpha',
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

function getPlayer(): HTMLIFrameElement {
  return screen.getByTestId('watch-player') as HTMLIFrameElement;
}

describe('SeriesWatchView Integration (Data Fetching & State Wiring)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    seriesMockMap.clear();
    localStorage.setItem('adblock_warning_dismissed', 'true');
  });

  afterEach(() => {
    localStorage.removeItem('adblock_warning_dismissed');
  });

  it('renders skeleton loading state while fetching series details', () => {
    seriesMockMap.set('series-loading', {
      get: () => new Promise(() => {}), // never resolves
    });

    renderWithProviders(<SeriesWatchView seriesId="series-loading" />);

    expect(screen.getByTestId('watch-skeleton')).toBeInTheDocument();
  });

  it('renders error state when API request fails and retries on click', async () => {
    let mockGetCount = 0;
    const mockGet = vi.fn().mockImplementation(() => {
      mockGetCount++;
      if (mockGetCount === 1) {
        return Promise.resolve({
          error: { value: { message: 'Database Connection Error' } },
        });
      }
      return Promise.resolve({ data: { data: mockSeriesPayload } });
    });

    seriesMockMap.set('series-error-1', { get: mockGet });

    const { user } = renderWithProviders(
      <SeriesWatchView seriesId="series-error-1" />
    );

    await waitFor(() => {
      expect(screen.getByTestId('watch-error')).toBeInTheDocument();
      expect(screen.getByText('Database Connection Error')).toBeInTheDocument();
    });

    const retryBtn = screen.getByRole('button', { name: /retry/i });
    await user.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByTestId('series-hero-banner')).toBeInTheDocument();
    });
  });

  it('fetches real data via seriesId and renders series overview with hero, metadata, and episode cards', async () => {
    const mockGet = vi.fn().mockResolvedValue({
      data: { data: mockSeriesPayload },
    });

    seriesMockMap.set('series-real-1', { get: mockGet });

    renderWithProviders(<SeriesWatchView seriesId="series-real-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('series-hero-banner')).toBeInTheDocument();
    });

    expect(screen.getByRole('img', { name: 'Real DB Series Title' })).toBeInTheDocument();
    expect(screen.getByText('Real DB Series Description')).toBeInTheDocument();
    expect(screen.getByText('★ 9.0')).toBeInTheDocument();
    expect(screen.getByText('Database Episode One')).toBeInTheDocument();
    expect(screen.getByText('Database Episode Two')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Season 1' })).toBeInTheDocument();
  });

  it('transitions to player mode and updates active episode when episode card is clicked', async () => {
    const mockGet = vi.fn().mockResolvedValue({
      data: { data: mockSeriesPayload },
    });

    seriesMockMap.set('series-real-1', { get: mockGet });

    const { user } = renderWithProviders(
      <SeriesWatchView seriesId="series-real-1" />
    );

    await waitFor(() => {
      expect(screen.getByTestId('series-hero-banner')).toBeInTheDocument();
    });

    const ep2Card = screen.getByRole('button', {
      name: /play episode 2: database episode two/i,
    });
    await user.click(ep2Card);

    expect(getPlayer().src).toBe('https://mirror-a.com/embed2');
    expect(
      screen.getAllByText('Database Episode Two Description').length
    ).toBeGreaterThan(0);
  });

  it('switches server mirror source when server button is clicked in player mode', async () => {
    const mockGet = vi.fn().mockResolvedValue({
      data: { data: mockSeriesPayload },
    });

    seriesMockMap.set('series-real-1', { get: mockGet });

    const { user } = renderWithProviders(
      <SeriesWatchView seriesId="series-real-1" initialEpisodeId="ep-1" />
    );

    await waitFor(() => {
      expect(screen.getByText('Real DB Series Title')).toBeInTheDocument();
    });

    expect(getPlayer().src).toBe('https://mirror-a.com/embed1');

    await user.click(screen.getByRole('button', { name: /Server Beta/i }));

    expect(getPlayer().src).toBe('https://mirror-b.com/embed1');
    expect(
      screen.getAllByText('Database Episode One Description').length
    ).toBeGreaterThan(0);
  });

  it('increments active episode tracking state and handles edge bounds via Next/Prev buttons in player mode', async () => {
    const mockGet = vi.fn().mockResolvedValue({
      data: { data: mockSeriesPayload },
    });

    seriesMockMap.set('series-real-1', { get: mockGet });

    const { user } = renderWithProviders(
      <SeriesWatchView seriesId="series-real-1" initialEpisodeId="ep-1" />
    );

    await waitFor(() => {
      expect(screen.getByText('Real DB Series Title')).toBeInTheDocument();
    });

    const nextBtn = screen.getByRole('button', { name: /next/i });
    const prevBtn = screen.getByRole('button', { name: /prev/i });

    expect(prevBtn).toBeDisabled();
    expect(nextBtn).toBeEnabled();

    await user.click(nextBtn);

    expect(getPlayer().src).toBe('https://mirror-a.com/embed2');
    expect(
      screen.getAllByText('Database Episode Two Description').length
    ).toBeGreaterThan(0);

    expect(screen.getByRole('button', { name: /prev/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();
  });

  it('handles navigation lifecycle between series overview, player mode, back buttons, breadcrumbs, and browser history changes', async () => {
    const mockGet = vi.fn().mockResolvedValue({
      data: { data: mockSeriesPayload },
    });
    seriesMockMap.set('series-real-1', { get: mockGet });

    // Step 1: Render in Series Overview mode (no initialEpisodeId)
    const { user, rerender } = renderWithProviders(
      <SeriesWatchView seriesId="series-real-1" />
    );

    await waitFor(() => {
      expect(screen.getByTestId('series-hero-banner')).toBeInTheDocument();
    });

    // Top back button in overview mode navigates to /
    const overviewBackBtn = screen.getByRole('button', { name: /back to home catalogue/i });
    await user.click(overviewBackBtn);

    // Step 2: Transition into player mode via episode card click
    const ep1Card = screen.getByRole('button', {
      name: /play episode 1: database episode one/i,
    });
    await user.click(ep1Card);

    expect(screen.getByTestId('watch-player')).toBeInTheDocument();
    expect(screen.getByTestId('active-episode-overview')).toBeInTheDocument();

    // Step 3: Click series title breadcrumb in player mode to return to overview
    const breadcrumbBtn = screen.getByRole('button', { name: 'Real DB Series Title' });
    await user.click(breadcrumbBtn);

    expect(screen.queryByTestId('watch-player')).not.toBeInTheDocument();
    expect(screen.getByTestId('series-hero-banner')).toBeInTheDocument();

    // Step 4: Re-enter player mode
    const ep2Card = screen.getByRole('button', {
      name: /play episode 2: database episode two/i,
    });
    await user.click(ep2Card);
    expect(screen.getByTestId('watch-player')).toBeInTheDocument();

    // Step 5: Click top "Back to Overview" button in player mode
    const playerBackBtn = screen.getByRole('button', { name: /back to series overview/i });
    await user.click(playerBackBtn);
    expect(screen.queryByTestId('watch-player')).not.toBeInTheDocument();
    expect(screen.getByTestId('series-hero-banner')).toBeInTheDocument();

    // Step 6: Browser history simulation (back / forward via rerendering with updated initialEpisodeId prop)
    // Simulating user clicking Browser Forward (URL gets ?ep=ep-1)
    rerender(<SeriesWatchView seriesId="series-real-1" initialEpisodeId="ep-1" />);
    expect(screen.getByTestId('watch-player')).toBeInTheDocument();
    expect(screen.getByText('EP 1 — Database Episode One')).toBeInTheDocument();

    // Simulating user clicking Browser Back (URL removes ?ep=)
    rerender(<SeriesWatchView seriesId="series-real-1" initialEpisodeId={undefined} />);
    expect(screen.queryByTestId('watch-player')).not.toBeInTheDocument();
    expect(screen.getByTestId('series-hero-banner')).toBeInTheDocument();
  });
});
