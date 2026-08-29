import { describe, expect, it, vi, beforeEach } from 'vitest';
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
                  error: { value: { message: 'Failed to fetch series details' } },
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
  seasons: [
    {
      id: 'season-1',
      seriesId: 'series-real-1',
      title: 'Season 1',
      episodes: [
        {
          id: 'ep-1',
          title: 'Database Episode One',
          order: 1,
          seasonId: 'season-1',
          description: 'Database Episode One Description',
          videoSources: [
            { id: 'src-1', type: 'embed', url: 'https://mirror-a.com/embed1', label: 'Server Alpha' },
            { id: 'src-2', type: 'embed', url: 'https://mirror-b.com/embed1', label: 'Server Beta' },
          ],
        },
        {
          id: 'ep-2',
          title: 'Database Episode Two',
          order: 2,
          seasonId: 'season-1',
          description: 'Database Episode Two Description',
          videoSources: [
            { id: 'src-3', type: 'embed', url: 'https://mirror-a.com/embed2', label: 'Server Alpha' },
          ],
        },
      ],
    },
    {
      id: 'season-2',
      seriesId: 'series-real-1',
      title: 'Season 2',
      episodes: [
        {
          id: 'ep-3',
          title: 'Database Episode Three',
          order: 1,
          seasonId: 'season-2',
          description: 'Database Episode Three Description',
          videoSources: [
            { id: 'src-4', type: 'embed', url: 'https://mirror-a.com/embed3', label: 'Server Alpha' },
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
        return Promise.resolve({ error: { value: { message: 'Database Connection Error' } } });
      }
      return Promise.resolve({ data: { data: mockSeriesPayload } });
    });

    seriesMockMap.set('series-error-1', { get: mockGet });

    const { user } = renderWithProviders(<SeriesWatchView seriesId="series-error-1" />);

    await waitFor(() => {
      expect(screen.getByTestId('watch-error')).toBeInTheDocument();
      expect(screen.getByText('Database Connection Error')).toBeInTheDocument();
    });

    const retryBtn = screen.getByRole('button', { name: /retry/i });
    await user.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByText('Real DB Series Title')).toBeInTheDocument();
    });
  });

  it('fetches real data via seriesId, populates player, metadata, dropdown, and sidebar', async () => {
    const mockGet = vi.fn().mockResolvedValue({
      data: { data: mockSeriesPayload },
    });

    seriesMockMap.set('series-real-1', { get: mockGet });

    renderWithProviders(<SeriesWatchView seriesId="series-real-1" />);

    await waitFor(() => {
      expect(screen.getByText('Real DB Series Title')).toBeInTheDocument();
    });

    expect(getPlayer().src).toBe('https://mirror-a.com/embed1');
    expect(screen.getByText('Database Episode One Description')).toBeInTheDocument();
    expect(screen.getByText('Database Episode One')).toBeInTheDocument();
    expect(screen.getByText('Database Episode Two')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /season/i })).toBeInTheDocument();
  });

  it('updates activeEpisodeId, iframe src, and description when sidebar episode card is clicked', async () => {
    const mockGet = vi.fn().mockResolvedValue({
      data: { data: mockSeriesPayload },
    });

    seriesMockMap.set('series-real-1', { get: mockGet });

    const { user } = renderWithProviders(<SeriesWatchView seriesId="series-real-1" />);

    await waitFor(() => {
      expect(screen.getByText('Real DB Series Title')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Database Episode Two/i }));

    expect(getPlayer().src).toBe('https://mirror-a.com/embed2');
    expect(screen.getByText('Database Episode Two Description')).toBeInTheDocument();
  });

  it('switches server mirror source when server button is clicked', async () => {
    const mockGet = vi.fn().mockResolvedValue({
      data: { data: mockSeriesPayload },
    });

    seriesMockMap.set('series-real-1', { get: mockGet });

    const { user } = renderWithProviders(<SeriesWatchView seriesId="series-real-1" />);

    await waitFor(() => {
      expect(screen.getByText('Real DB Series Title')).toBeInTheDocument();
    });

    expect(getPlayer().src).toBe('https://mirror-a.com/embed1');

    await user.click(screen.getByRole('button', { name: /Server Beta/i }));

    expect(getPlayer().src).toBe('https://mirror-b.com/embed1');
    expect(screen.getByText('Database Episode One Description')).toBeInTheDocument();
  });

  it('increments active episode tracking state and handles edge bounds via Next/Prev buttons', async () => {
    const mockGet = vi.fn().mockResolvedValue({
      data: { data: mockSeriesPayload },
    });

    seriesMockMap.set('series-real-1', { get: mockGet });

    const { user } = renderWithProviders(<SeriesWatchView seriesId="series-real-1" />);

    await waitFor(() => {
      expect(screen.getByText('Real DB Series Title')).toBeInTheDocument();
    });

    const nextBtn = screen.getByRole('button', { name: /next/i });
    const prevBtn = screen.getByRole('button', { name: /prev/i });

    expect(prevBtn).toBeDisabled();
    expect(nextBtn).toBeEnabled();

    await user.click(nextBtn);

    expect(getPlayer().src).toBe('https://mirror-a.com/embed2');
    expect(screen.getByText('Database Episode Two Description')).toBeInTheDocument();

    expect(screen.getByRole('button', { name: /prev/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();
  });
});
