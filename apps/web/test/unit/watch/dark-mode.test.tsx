import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
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
  useNavigate: () => vi.fn(),
  useSearch: () => ({}),
  useParams: () => ({ seriesId: 'series-1' }),
}));

import {
  SeriesWatchView,
  WatchViewErrorState,
  WatchViewSkeleton,
  type WatchSeriesDetails,
} from '@/modules/watch';

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
          description: 'First episode',
          thumbnailUrl: null,
          duration: '24m',
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

function mockLightColorScheme() {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: query.includes('light'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
  );
}

describe('watch cinematic dark mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('adblock_warning_dismissed', 'true');
    mockLightColorScheme();
    document.documentElement.classList.remove('dark');
  });

  afterEach(() => {
    localStorage.removeItem('adblock_warning_dismissed');
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('renders the series watch view in dark mode even when device prefers light scheme', () => {
    renderWithProviders(<SeriesWatchView series={mockSeries} />);

    const view = screen.getByTestId('watch-view');
    expect(view).toHaveClass('dark');
    expect(view).toHaveClass('bg-black');
    expect(view).toHaveStyle({ colorScheme: 'dark' });
  });

  it('keeps player mode rooted in the dark container under light scheme preference', () => {
    renderWithProviders(
      <SeriesWatchView series={mockSeries} initialEpisodeId="ep-1" />
    );

    const view = screen.getByTestId('watch-view');
    expect(view).toHaveClass('dark');
    expect(view).toHaveClass('bg-black');

    const playerContainer = screen.getByTestId('watch-player-container');
    expect(playerContainer).toHaveClass('bg-black');
    expect(screen.getByTestId('watch-controls')).toBeInTheDocument();
    expect(screen.getByTestId('episode-explorer')).toBeInTheDocument();
  });

  it('retains the dark palette on loading skeletons', () => {
    renderWithProviders(<WatchViewSkeleton />);

    const skeleton = screen.getByTestId('watch-skeleton');
    expect(skeleton).toHaveClass('dark');
    expect(skeleton).toHaveClass('bg-black');
    expect(skeleton).toHaveStyle({ colorScheme: 'dark' });
  });

  it('retains the dark palette on error screens', () => {
    renderWithProviders(<WatchViewErrorState message="boom" />);

    const error = screen.getByTestId('watch-error');
    expect(error).toHaveClass('dark');
    expect(error).toHaveClass('bg-black');
    expect(error).toHaveStyle({ colorScheme: 'dark' });
  });
});
