import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent } from '../../utils';

const navigateMock = vi.fn();

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

function mockReferrer(value: string) {
  Object.defineProperty(document, 'referrer', {
    configurable: true,
    get: () => value,
  });
}

describe('SeriesWatchView hoisted sticky top navigation', () => {
  const historyBackSpy = vi
    .spyOn(window.history, 'back')
    .mockImplementation(() => {});
  const originalReferrer = Object.getOwnPropertyDescriptor(
    document,
    'referrer'
  );

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('adblock_warning_dismissed', 'true');
  });

  afterEach(() => {
    localStorage.removeItem('adblock_warning_dismissed');
    if (originalReferrer) {
      Object.defineProperty(document, 'referrer', originalReferrer);
    }
  });

  it('renders a sticky top nav with a "Back" button (arrow icon) in Overview mode', () => {
    mockReferrer('');
    renderWithProviders(<SeriesWatchView series={mockSeries} />);

    const nav = screen.getByTestId('watch-top-nav');
    expect(nav).toBeInTheDocument();
    expect(nav).toHaveClass('sticky', 'top-0');

    const back = screen.getByRole('button', { name: 'Back' });
    expect(back).toBeInTheDocument();
    expect(back).toHaveTextContent('Back');
    // Arrow icon rendered (lucide svg)
    expect(back.querySelector('svg')).toBeInTheDocument();
  });

  it('renders a sticky top nav with "Back to Overview" in Player mode', () => {
    mockReferrer('');
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

  it('uses history.back() when the referrer is internal to the catalogue', () => {
    mockReferrer(`${window.location.origin}/genres/action`);

    renderWithProviders(<SeriesWatchView series={mockSeries} />);

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(historyBackSpy).toHaveBeenCalledTimes(1);
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('falls back to / when the referrer is external', () => {
    mockReferrer('https://external.example.com/some-page');

    renderWithProviders(<SeriesWatchView series={mockSeries} />);

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(historyBackSpy).not.toHaveBeenCalled();
    expect(navigateMock).toHaveBeenCalledWith({ to: '/' });
  });

  it('falls back to / when the referrer is absent (direct visit)', () => {
    mockReferrer('');

    renderWithProviders(<SeriesWatchView series={mockSeries} />);

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(historyBackSpy).not.toHaveBeenCalled();
    expect(navigateMock).toHaveBeenCalledWith({ to: '/' });
  });

  it('sets the mobile hero banner height to 65dvh (min 420px), 85vh on desktop', () => {
    mockReferrer('');
    renderWithProviders(<SeriesWatchView series={mockSeries} />);

    const artwork = screen.getByTestId('hero-artwork');
    expect(artwork).toHaveClass('h-[65dvh]', 'min-h-[420px]');
    expect(artwork).toHaveClass('md:h-[85vh]');
  });
});
