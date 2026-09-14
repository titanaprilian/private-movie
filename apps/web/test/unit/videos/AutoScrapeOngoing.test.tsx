import { renderWithProviders, screen } from '../../utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SeriesDetailView } from '@/modules/videos/internal/SeriesDetailView';
import type { SeriesDetails } from '@/modules/videos/internal/api';
import { Toaster } from '@/components/ui/sonner';
import { setAccessToken } from '@/lib/api';

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    params,
    className,
  }: {
    children: React.ReactNode;
    to: string;
    params?: Record<string, string>;
    className?: string;
  }) => {
    const href = params ? to.replace('$seriesId', params.seriesId) : to;
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  },
  useSearch: () => ({}),
  useNavigate: () => vi.fn(),
}));

const ongoingSeasonWithScraper = {
  id: 'season-ongoing-id',
  seriesId: 'ongoing-series-id',
  sourceUrl: 'https://otakudesu.cloud/season-ongoing',
  source: 'otakudesu',
  title: 'Ongoing Season',
  description: null,
  posterUrl: null,
  status: 'ongoing',
  scraperUrl: 'https://otakudesu.cloud/anime/ongoing-show',
  episodeOffset: 0,
  createdAt: '2026-08-10',
  updatedAt: '2026-08-10',
  episodes: [
    {
      id: 'ep-1',
      seasonId: 'season-ongoing-id',
      sourceUrl: 'https://otakudesu.cloud/ep-1',
      source: 'otakudesu',
      title: 'Episode 1',
      order: 1,
      videoSources: [],
      createdAt: '2026-08-10',
      updatedAt: '2026-08-10',
    },
  ],
};

const completedSeasonWithScraper = {
  id: 'season-completed-id',
  seriesId: 'ongoing-series-id',
  sourceUrl: 'https://otakudesu.cloud/season-completed',
  source: 'otakudesu',
  title: 'Completed Season',
  description: null,
  posterUrl: null,
  status: 'completed',
  scraperUrl: 'https://otakudesu.cloud/anime/completed-show',
  episodeOffset: 0,
  createdAt: '2026-08-10',
  updatedAt: '2026-08-10',
  episodes: [],
};

const ongoingSeasonWithoutScraper = {
  id: 'season-no-scraper-id',
  seriesId: 'ongoing-series-id',
  sourceUrl: null,
  source: null,
  title: 'No Scraper Season',
  description: null,
  posterUrl: null,
  status: 'ongoing',
  scraperUrl: null,
  episodeOffset: 0,
  createdAt: '2026-08-10',
  updatedAt: '2026-08-10',
  episodes: [],
};

const mockSeries: SeriesDetails = {
  id: 'ongoing-series-id',
  sourceUrl: 'https://otakudesu.cloud/anime/ongoing-series',
  source: 'otakudesu',
  title: 'Ongoing Anime Series',
  description: 'Series description',
  posterUrl: null,
  createdAt: '2026-08-10',
  updatedAt: '2026-08-10',
  seasons: [ongoingSeasonWithScraper, completedSeasonWithScraper, ongoingSeasonWithoutScraper],
  episodes: ongoingSeasonWithScraper.episodes,
};

describe('Run Auto-Scrape Now in SeriesDetailView', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setAccessToken('mock-token');
  });

  it('renders "Run Auto-Scrape Now" when active season is ongoing and has scraperUrl', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes('/series/ongoing-series-id')) {
        return new Response(JSON.stringify({ data: mockSeries }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Not found' } }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const { user } = renderWithProviders(
      <>
        <Toaster />
        <SeriesDetailView seriesId="ongoing-series-id" initialSeasonId="season-ongoing-id" />
      </>
    );

    await screen.findByRole('heading', { level: 1, name: 'Ongoing Anime Series' });

    const menuBtn = screen.getByRole('button', { name: /season actions/i });
    expect(menuBtn).toBeInTheDocument();
    await user.click(menuBtn);

    const autoScrapeBtn = screen.getByRole('button', { name: /run auto-scrape now/i });
    expect(autoScrapeBtn).toBeInTheDocument();
  });

  it('does NOT render "Run Auto-Scrape Now" when active season is completed', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes('/series/ongoing-series-id')) {
        return new Response(JSON.stringify({ data: mockSeries }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Not found' } }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const { user } = renderWithProviders(
      <>
        <Toaster />
        <SeriesDetailView seriesId="ongoing-series-id" initialSeasonId="season-completed-id" />
      </>
    );

    await screen.findByRole('heading', { level: 1, name: 'Ongoing Anime Series' });

    const menuBtn = screen.getByRole('button', { name: /season actions/i });
    await user.click(menuBtn);

    expect(screen.queryByRole('button', { name: /run auto-scrape now/i })).not.toBeInTheDocument();
  });

  it('does NOT render "Run Auto-Scrape Now" when active season lacks scraperUrl', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes('/series/ongoing-series-id')) {
        return new Response(JSON.stringify({ data: mockSeries }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Not found' } }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const { user } = renderWithProviders(
      <>
        <Toaster />
        <SeriesDetailView seriesId="ongoing-series-id" initialSeasonId="season-no-scraper-id" />
      </>
    );

    await screen.findByRole('heading', { level: 1, name: 'Ongoing Anime Series' });

    const menuBtn = screen.getByRole('button', { name: /season actions/i });
    await user.click(menuBtn);

    expect(screen.queryByRole('button', { name: /run auto-scrape now/i })).not.toBeInTheDocument();
  });

  it('triggers scrape-ongoing endpoint, disables button while in progress, and displays success toast', async () => {
    let scrapeEndpointCalled = false;

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes('/series/ongoing-series-id')) {
        return new Response(JSON.stringify({ data: mockSeries }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.includes('/seasons/season-ongoing-id/scrape-ongoing')) {
        scrapeEndpointCalled = true;
        expect(init?.method).toBe('POST');
        return new Response(
          JSON.stringify({
            data: {
              seasonId: 'season-ongoing-id',
              seriesId: 'ongoing-series-id',
              success: true,
              tmdbSynced: true,
              episodesScraped: 1,
              sourcesSaved: 2,
              seasonCompleted: false,
            },
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
      return new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Not found' } }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const { user } = renderWithProviders(
      <>
        <Toaster />
        <SeriesDetailView seriesId="ongoing-series-id" initialSeasonId="season-ongoing-id" />
      </>
    );

    await screen.findByRole('heading', { level: 1, name: 'Ongoing Anime Series' });

    const menuBtn = screen.getByRole('button', { name: /season actions/i });
    await user.click(menuBtn);

    const autoScrapeBtn = screen.getByRole('button', { name: /run auto-scrape now/i });
    await user.click(autoScrapeBtn);

    expect(scrapeEndpointCalled).toBe(true);
    expect(await screen.findByText(/Auto-scrape completed: 2 sources saved across 1 episode/i)).toBeInTheDocument();
  });

  it('displays error toast when scrape-ongoing fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes('/series/ongoing-series-id')) {
        return new Response(JSON.stringify({ data: mockSeries }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.includes('/seasons/season-ongoing-id/scrape-ongoing')) {
        return new Response(
          JSON.stringify({
            error: {
              code: 'SCRAPER_FAILED',
              message: 'Failed to fetch provider HTML: Cloudflare challenge',
            },
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
      return new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Not found' } }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const { user } = renderWithProviders(
      <>
        <Toaster />
        <SeriesDetailView seriesId="ongoing-series-id" initialSeasonId="season-ongoing-id" />
      </>
    );

    await screen.findByRole('heading', { level: 1, name: 'Ongoing Anime Series' });

    const menuBtn = screen.getByRole('button', { name: /season actions/i });
    await user.click(menuBtn);

    const autoScrapeBtn = screen.getByRole('button', { name: /run auto-scrape now/i });
    await user.click(autoScrapeBtn);

    expect(await screen.findByText(/Failed to fetch provider HTML: Cloudflare challenge/i)).toBeInTheDocument();
  });
});
