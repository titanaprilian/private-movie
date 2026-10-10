import { renderWithProviders, screen } from '../../utils';
import { describe, expect, it, vi } from 'vitest';
import { ActivityFeed, OngoingSeriesGrid } from '@/modules/dashboard';

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

const seasons = [
  {
    seasonId: 's-healthy',
    seriesId: 'series-a',
    seriesTitle: 'Healthy Show With A Very Long Title That Should Clamp To Two Lines Gracefully',
    seasonTitle: 'Season 2',
    seasonNumber: 2,
    posterUrl: 'https://img.example/a.jpg',
    episodeCount: 8,
    lastScrapedAt: new Date(Date.now() - 60_000).toISOString(),
    lastScrapeError: null,
  },
  {
    seasonId: 's-failed',
    seriesId: 'series-b',
    seriesTitle: 'Broken Show',
    seasonTitle: 'Season 1',
    seasonNumber: 1,
    posterUrl: null,
    episodeCount: 3,
    lastScrapedAt: new Date(Date.now() - 120_000).toISOString(),
    lastScrapeError: 'Failed to fetch provider HTML: timeout',
  },
];

describe('OngoingSeriesGrid', () => {
  it('sorts failed seasons first', () => {
    renderWithProviders(
      <OngoingSeriesGrid seasons={seasons} scrapingSeasonId={null} onScrape={() => {}} />
    );
    const cards = screen.getAllByTestId(/^ongoing-card-/);
    expect(cards[0]).toHaveAttribute('data-testid', 'ongoing-card-s-failed');
    expect(cards[1]).toHaveAttribute('data-testid', 'ongoing-card-s-healthy');
  });

  it('renders meta line, clamped title tooltip, status dot text and icon scrape button', () => {
    renderWithProviders(
      <OngoingSeriesGrid seasons={seasons} scrapingSeasonId={null} onScrape={() => {}} />
    );
    expect(screen.getByTestId('ongoing-meta-s-healthy')).toHaveTextContent('Season 2 · 8 eps');
    const title = screen.getByTitle(
      'Healthy Show With A Very Long Title That Should Clamp To Two Lines Gracefully'
    );
    expect(title).toBeInTheDocument();
    expect(screen.getByTestId('ongoing-scraped-s-healthy')).toHaveTextContent(/Synced ·/);
    const scrapeBtn = screen.getByRole('button', { name: 'Scrape Healthy Show With A Very Long Title That Should Clamp To Two Lines Gracefully' });
    expect(scrapeBtn).toBeInTheDocument();
    expect(scrapeBtn).toHaveAttribute('data-testid', 'ongoing-scrape-s-healthy');
  });

  it('renders failed card with red styling, friendly error, retry and raw snippet', async () => {
    const onScrape = vi.fn();
    const { user } = renderWithProviders(
      <OngoingSeriesGrid seasons={seasons} scrapingSeasonId={null} onScrape={onScrape} />
    );
    const card = screen.getByTestId('ongoing-card-s-failed');
    expect(card.className).toMatch(/red/);
    expect(screen.getByTestId('ongoing-error-s-failed')).toHaveTextContent(
      'Failed to fetch provider HTML: timeout'
    );
    expect(screen.getByTestId('ongoing-error-raw-s-failed')).toBeInTheDocument();
    expect(screen.getByTestId('ongoing-error-copy-s-failed')).toBeInTheDocument();
    const retry = screen.getByTestId('ongoing-retry-s-failed');
    await user.click(retry);
    expect(onScrape).toHaveBeenCalledWith('s-failed');
    const iconBtn = screen.getByTestId('ongoing-scrape-s-failed');
    await user.click(iconBtn);
    expect(onScrape).toHaveBeenCalledWith('s-failed');
  });

  it('maps "Season <id> not found" errors to a friendly message with ID snippet', () => {
    const notFound = [
      { ...seasons[1], seasonId: 's-nf', lastScrapeError: 'Season abc123 not found' },
    ];
    renderWithProviders(
      <OngoingSeriesGrid seasons={notFound} scrapingSeasonId={null} onScrape={() => {}} />
    );
    expect(screen.getByTestId('ongoing-error-s-nf')).toHaveTextContent(
      'Season not found on the source site'
    );
    expect(screen.getByTestId('ongoing-error-raw-s-nf')).toHaveTextContent('abc123');
  });

  it('shows a spinner state while a season scrape is pending', () => {
    renderWithProviders(
      <OngoingSeriesGrid seasons={seasons} scrapingSeasonId="s-healthy" onScrape={() => {}} />
    );
    const btn = screen.getByTestId('ongoing-scrape-s-healthy');
    expect(btn).toBeDisabled();
    expect(btn).toHaveTextContent(/scraping/i);
    expect(screen.getByTestId('ongoing-retry-s-failed')).not.toBeDisabled();
  });

  it('hides pagination when all seasons fit on one page', () => {
    renderWithProviders(
      <OngoingSeriesGrid seasons={seasons} scrapingSeasonId={null} onScrape={() => {}} />
    );
    expect(screen.getAllByTestId(/^ongoing-card-/)).toHaveLength(2);
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).not.toBeInTheDocument();
  });

  it('paginates at 9 per page and navigates between pages', async () => {
    const many = Array.from({ length: 10 }, (_, i) => ({
      ...seasons[0],
      seasonId: `s-page-${i}`,
      seriesId: `series-page-${i}`,
      seriesTitle: `Paged Show ${i}`,
    }));
    const { user } = renderWithProviders(
      <OngoingSeriesGrid seasons={many} scrapingSeasonId={null} onScrape={() => {}} />
    );
    expect(screen.getAllByTestId(/^ongoing-card-/)).toHaveLength(9);
    expect(screen.queryByTestId('ongoing-card-s-page-9')).not.toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Pagination' });
    expect(nav).toHaveTextContent('Page 1 of 2');
    await user.click(screen.getByRole('button', { name: 'Next page' }));
    expect(screen.getAllByTestId(/^ongoing-card-/)).toHaveLength(1);
    expect(screen.getByTestId('ongoing-card-s-page-9')).toBeInTheDocument();
    expect(nav).toHaveTextContent('Page 2 of 2');
  });
});

describe('ActivityFeed', () => {
  const recent = [
    {
      id: 'series-1',
      title: 'Recent One',
      posterUrl: null,
      episodeCount: 12,
      updatedAt: new Date(Date.now() - 3600_000).toISOString(),
    },
  ];

  it('renders Failed rows for scrape errors and Updated rows with episode labels', () => {
    renderWithProviders(<ActivityFeed ongoingSeasons={seasons} recentSeries={recent} />);
    const feed = screen.getByTestId('activity-feed');
    expect(feed.tagName).toBe('UL');
    expect(screen.getByTestId('activity-tag-failed-s-failed')).toHaveTextContent('Failed');
    expect(screen.getByTestId('activity-tag-updated-series-1')).toHaveTextContent('Updated');
    expect(screen.getByTestId('recent-series-episodes-series-1')).toHaveTextContent('12 episodes total');
  });

  it('shows an empty state when there is no activity', () => {
    renderWithProviders(<ActivityFeed ongoingSeasons={[]} recentSeries={[]} />);
    expect(screen.getByTestId('recent-series-empty')).toBeInTheDocument();
  });
});
