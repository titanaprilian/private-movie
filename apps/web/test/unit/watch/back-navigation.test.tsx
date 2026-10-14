import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent } from '../../utils';

const navigateMock = vi.fn();
const historyBackMock = vi.fn();
const canGoBackMock = vi.fn(() => true);

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
  useNavigate: () => navigateMock,
  useRouter: () => ({
    history: {
      canGoBack: () => canGoBackMock(),
      back: () => historyBackMock(),
    },
  }),
  useSearch: () => ({}),
  useParams: () => ({ seriesId: 'series-1' }),
}));

import { renderWithProviders } from '../../utils';
import { SeriesWatchView, type WatchSeriesDetails } from '@/modules/watch';

const mockSeries: WatchSeriesDetails = {
  id: 'series-1',
  title: 'Test Series',
  description: 'Series description',
  type: 'tv',
  backdropUrl: null,
  posterUrl: null,
  logoUrl: null,
  isFeatured: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  rating: '8.8',
  genres: [],
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
          description: null,
          thumbnailUrl: null,
          duration: null,
          rating: '8.8',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          videoSources: [
            {
              id: 'src-1',
              episodeId: 'ep-1',
              type: 'embed',
              url: 'https://embed.com/1',
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

describe('SeriesWatchView hoisted sticky top navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    canGoBackMock.mockReturnValue(true);
    localStorage.setItem('adblock_warning_dismissed', 'true');
  });

  afterEach(() => {
    localStorage.removeItem('adblock_warning_dismissed');
  });

  it('renders a sticky top nav with a "Back" button (chevron icon and greenish border) in Overview mode', () => {
    renderWithProviders(<SeriesWatchView series={mockSeries} />);

    const nav = screen.getByTestId('watch-top-nav');
    expect(nav).toBeInTheDocument();
    expect(nav).toHaveClass('sticky', 'top-0');

    const back = screen.getByRole('button', { name: 'Back' });
    expect(back).toBeInTheDocument();
    expect(back).toHaveTextContent('Back');
    expect(back).toHaveClass('rounded-full', 'border-[#58cc02]/60');
    // Chevron icon rendered (lucide svg)
    expect(back.querySelector('svg')).toBeInTheDocument();
  });
  it('renders a sticky top nav with "Back to Overview" in Player mode', () => {
    renderWithProviders(
      <SeriesWatchView series={mockSeries} initialEpisodeId="ep-1" />
    );

    const nav = screen.getByTestId('watch-top-nav');
    expect(nav).toBeInTheDocument();
    expect(nav).toHaveClass('sticky', 'top-0');

    expect(
      screen.getByRole('button', { name: /back to series overview/i })
    ).toHaveTextContent('Back to Overview');
  });

  it('uses router.history.back() when in-app history can go back', () => {
    canGoBackMock.mockReturnValue(true);

    renderWithProviders(<SeriesWatchView series={mockSeries} />);

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(canGoBackMock).toHaveBeenCalledTimes(1);
    expect(historyBackMock).toHaveBeenCalledTimes(1);
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('falls back to / when router history cannot go back (direct visit)', () => {
    canGoBackMock.mockReturnValue(false);

    renderWithProviders(<SeriesWatchView series={mockSeries} />);

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(historyBackMock).not.toHaveBeenCalled();
    expect(navigateMock).toHaveBeenCalledWith({ to: '/' });
  });

  it('navigates to series overview when clicking the series tag pill on the active episode metadata card', () => {
    renderWithProviders(
      <SeriesWatchView series={mockSeries} initialEpisodeId="ep-1" />
    );

    const seriesTag = screen.getByTestId('series-tag-pill');
    expect(seriesTag).toBeInTheDocument();
    expect(seriesTag).toHaveTextContent('Test Series');

    fireEvent.click(seriesTag);

    expect(screen.queryByTestId('active-episode-overview')).not.toBeInTheDocument();
    expect(screen.getByTestId('watch-top-nav')).toHaveTextContent('Back');
  });

  it('uses replace navigation to overview when entering directly into player mode via initialEpisodeId', () => {
    renderWithProviders(
      <SeriesWatchView series={mockSeries} initialEpisodeId="ep-1" />
    );

    fireEvent.click(
      screen.getByRole('button', { name: /back to series overview/i })
    );

    expect(historyBackMock).not.toHaveBeenCalled();
    expect(navigateMock).toHaveBeenCalledWith({
      to: '/watch/$seriesId',
      params: { seriesId: 'series-1' },
      search: {},
      replace: true,
    });
    // Lands in overview mode
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
  });

  it('returns to Home/Catalog via history.back() from overview after direct player entry', () => {
    canGoBackMock.mockReturnValue(true);

    renderWithProviders(
      <SeriesWatchView series={mockSeries} initialEpisodeId="ep-1" />
    );

    // Back to Overview replaces the player entry...
    fireEvent.click(
      screen.getByRole('button', { name: /back to series overview/i })
    );
    expect(navigateMock).toHaveBeenCalledWith({
      to: '/watch/$seriesId',
      params: { seriesId: 'series-1' },
      search: {},
      replace: true,
    });

    // ...so Back from overview pops to Home/Catalog, not the player loop.
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(historyBackMock).toHaveBeenCalledTimes(1);
  });

  it('uses router.history.back() for Back to Overview when entering overview first then playing', () => {
    renderWithProviders(<SeriesWatchView series={mockSeries} />);

    // Overview -> player is a history push (Play first episode).
    fireEvent.click(screen.getByTestId('hero-play'));

    expect(
      screen.getByRole('button', { name: /back to series overview/i })
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: /back to series overview/i })
    );

    expect(historyBackMock).toHaveBeenCalledTimes(1);
    expect(navigateMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ replace: true })
    );
  });
});
