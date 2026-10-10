import { createTestQueryClient, renderWithProviders, screen, waitFor } from '../../utils';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { setAccessToken } from '@/lib/api';
import { DashboardView } from '@/modules/dashboard';

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    params,
    className,
    ...rest
  }: {
    children: React.ReactNode;
    to: string;
    params?: Record<string, string>;
    className?: string;
  }) => {
    let href = to;
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        href = href.replace(`$${key}`, value);
      }
    }
    return (
      <a href={href} className={className} {...rest}>
        {children}
      </a>
    );
  },
  useNavigate: () => vi.fn(),
  useParams: () => ({}),
}));

const dashboardPayload = {
  data: {
    catalog: {
      totalSeries: 12,
      ongoingSeriesCount: 3,
      featuredSeriesCount: 4,
      totalSeasons: 15,
      totalEpisodes: 240,
      totalGenres: 8,
    },
    storage: {
      totalUsedBytes: 10737418240,
      totalLimitBytes: 107374182400,
      percentUsed: 10,
      providerCount: 2,
    },
    scheduler: {
      isEnabled: false,
      isExecuting: false,
      intervalMinutes: 30,
      lastRunAt: null,
      lastRunResult: null,
      nextRunAt: null,
    },
    ongoingSeasons: [
      {
        seasonId: 'season-ongoing-1',
        seriesId: 'series-ongoing-1',
        seriesTitle: 'Airing Show',
        seasonTitle: 'Season 2',
        seasonNumber: 2,
        posterUrl: 'https://img.example/airing.jpg',
        episodeCount: 8,
        lastScrapedAt: new Date(Date.now() - 1800_000).toISOString(),
        lastScrapeError: null,
      },
      {
        seasonId: 'season-ongoing-2',
        seriesId: 'series-ongoing-2',
        seriesTitle: 'Broken Show',
        seasonTitle: 'Season 1',
        seasonNumber: 1,
        posterUrl: null,
        episodeCount: 3,
        lastScrapedAt: null,
        lastScrapeError: 'Failed to fetch provider HTML: timeout',
      },
    ],
    recentSeries: [
      {
        id: 'series-1',
        title: 'Recent One',
        posterUrl: 'https://img.example/p1.jpg',
        episodeCount: 12,
        updatedAt: new Date(Date.now() - 3600_000).toISOString(),
      },
      {
        id: 'series-2',
        title: 'Recent Two',
        posterUrl: null,
        episodeCount: 1,
        updatedAt: new Date(Date.now() - 7200_000).toISOString(),
      },
    ],
  },
};

describe('DashboardView', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setAccessToken('test-access-token');
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return new Response(JSON.stringify(dashboardPayload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setAccessToken(null);
  });

  it('renders the dashboard header with Chunky typography', async () => {
    renderWithProviders(<DashboardView />);
    const heading = await screen.findByRole('heading', { name: 'Dashboard' });
    expect(heading).toBeInTheDocument();
    expect(heading.className).toContain('font-display');
    expect(heading.className).toContain('text-3xl');
  });

  it('displays KPI cards with counts and badges', async () => {
    renderWithProviders(<DashboardView />);
    expect(await screen.findByTestId('kpi-total-series')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId('kpi-total-series-value')).toHaveTextContent('12');
    });
    expect(screen.getByTestId('kpi-ongoing-badge')).toHaveTextContent('3 ongoing');
    expect(screen.getByTestId('kpi-featured-badge')).toHaveTextContent('4 featured');
    expect(screen.getByTestId('kpi-total-episodes-value')).toHaveTextContent('240');
    expect(screen.getByTestId('kpi-total-genres-value')).toHaveTextContent('8');
  });

  it('provides Add Series and Refresh actions', async () => {
    const { user } = renderWithProviders(<DashboardView />);
    await screen.findByTestId('kpi-total-series');

    const addLink = screen.getByRole('link', { name: /add series/i });
    expect(addLink).toHaveAttribute('href', '/admin/videos');

    const refreshBtn = screen.getByRole('button', { name: /refresh dashboard/i });
    expect(refreshBtn).toBeInTheDocument();
    await user.click(refreshBtn);
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalled();
    });
  });

  it('renders the storage KPI card with formatted GB and percentage', async () => {
    renderWithProviders(<DashboardView />);
    expect(await screen.findByTestId('kpi-storage')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId('kpi-storage-value')).toHaveTextContent('10.0 GB');
    });
    expect(screen.getByTestId('kpi-storage-percent')).toHaveTextContent('of 100.0 GB used (10.0%)');
  });

  it('renders recent series activity with links to series management pages', async () => {
    renderWithProviders(<DashboardView />);
    expect(await screen.findByTestId('recent-series-section')).toBeInTheDocument();
    const card = await screen.findByTestId('recent-series-card-series-1');
    expect(card).toHaveAttribute('href', '/admin/videos/series-1');
    expect(screen.getByTestId('recent-series-episodes-series-1')).toHaveTextContent('12 episodes');
    expect(screen.getByTestId('recent-series-episodes-series-2')).toHaveTextContent('1 episode');
    expect(screen.getByTestId('recent-series-updated-series-1')).toHaveTextContent(/ago|just now/);
  });

  it('shows an empty state when there is no recent series activity', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return new Response(
        JSON.stringify({
          data: { ...dashboardPayload.data, ongoingSeasons: [], recentSeries: [] },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });
    renderWithProviders(<DashboardView />);
    expect(await screen.findByTestId('recent-series-empty')).toHaveTextContent(
      'No recent series activity yet.'
    );
  });

  it('renders ongoing series cards with posters, counts, scraped times and links', async () => {
    renderWithProviders(<DashboardView />);
    expect(await screen.findByTestId('ongoing-series-section')).toBeInTheDocument();
    const card = await screen.findByTestId('ongoing-card-season-ongoing-1');
    expect(card).toBeInTheDocument();
    expect(screen.getByTestId('ongoing-episodes-season-ongoing-1')).toHaveTextContent('8 episodes');
    expect(screen.getByTestId('ongoing-scraped-season-ongoing-1')).toHaveTextContent(/Scraped .* ago/);
    expect(screen.getByTestId('ongoing-scraped-season-ongoing-2')).toHaveTextContent('Never scraped');
    const links = card.querySelectorAll('a[href="/admin/videos/series-ongoing-1"]');
    expect(links.length).toBeGreaterThan(0);
  });

  it('displays the scrape error badge with error details', async () => {
    renderWithProviders(<DashboardView />);
    const badge = await screen.findByTestId('ongoing-error-season-ongoing-2');
    expect(badge).toHaveTextContent('Failed to fetch provider HTML: timeout');
    expect(badge).toHaveAttribute('title', 'Failed to fetch provider HTML: timeout');
    expect(screen.queryByTestId('ongoing-error-season-ongoing-1')).not.toBeInTheDocument();
  });

  it('triggers the scrape-ongoing endpoint with loading state and refetches dashboard', async () => {
    let scrapeCalls = 0;
    let resolveScrape!: (value: Response) => void;
    const scrapeGate = new Promise<Response>((resolve) => {
      resolveScrape = resolve;
    });
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      if (url.includes('scrape-ongoing')) {
        scrapeCalls += 1;
        expect(init?.method).toBe('POST');
        return scrapeGate;
      }
      return new Response(JSON.stringify(dashboardPayload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    const { user } = renderWithProviders(<DashboardView />);
    const scrapeBtn = await screen.findByTestId('ongoing-scrape-season-ongoing-1');
    await user.click(scrapeBtn);
    await waitFor(() => {
      expect(scrapeCalls).toBe(1);
    });
    expect(scrapeBtn).toBeDisabled();
    expect(scrapeBtn).toHaveTextContent(/scraping/i);
    resolveScrape(
      new Response(
        JSON.stringify({
          data: {
            seasonId: 'season-ongoing-1',
            seriesId: 'series-ongoing-1',
            success: true,
            tmdbSynced: false,
            episodesScraped: 2,
            sourcesSaved: 2,
            seasonCompleted: false,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );
    await waitFor(() => {
      expect(scrapeBtn).not.toBeDisabled();
    });
  });

  it('renders the dashboard skeleton while loading', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      () =>
        new Promise<Response>(() => {
          // Never resolves: keeps the dashboard query in its loading state.
        })
    );
    renderWithProviders(<DashboardView />);
    const skeleton = await screen.findByTestId('dashboard-skeleton');
    expect(skeleton).toBeInTheDocument();
    expect(skeleton).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByTestId('dashboard-container')).not.toBeInTheDocument();
  });

  it('shows an empty state when no seasons are ongoing', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return new Response(
        JSON.stringify({ data: { ...dashboardPayload.data, ongoingSeasons: [] } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });
    renderWithProviders(<DashboardView />);
    expect(await screen.findByTestId('ongoing-empty')).toHaveTextContent(
      'No seasons are marked as ongoing'
    );
  });

  it("invalidates the ['series'] query when auto-scrape succeeds", async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : (input as Request).url;
      if (url.includes('scrape-ongoing')) {
        return new Response(
          JSON.stringify({
            data: {
              seasonId: 'season-ongoing-1',
              seriesId: 'series-ongoing-1',
              success: true,
              tmdbSynced: false,
              episodesScraped: 2,
              sourcesSaved: 2,
              seasonCompleted: true,
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify(dashboardPayload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const { user } = renderWithProviders(<DashboardView />, { queryClient });
    const scrapeBtn = await screen.findByTestId('ongoing-scrape-season-ongoing-1');
    await user.click(scrapeBtn);
    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['series'] });
    });
  });
});
