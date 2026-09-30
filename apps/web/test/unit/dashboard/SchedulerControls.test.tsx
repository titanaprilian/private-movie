import { renderWithProviders, screen, waitFor } from '../../utils';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { setAccessToken } from '@/lib/api';
import { DashboardView } from '@/modules/dashboard';
import {
  resolveDashboardRefetchInterval,
  SCHEDULER_POLLING_ACTIVE_MS,
  SCHEDULER_POLLING_IDLE_MS,
} from '@/modules/dashboard';

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

const basePayload = {
  data: {
    catalog: {
      totalSeries: 5,
      ongoingSeriesCount: 1,
      featuredSeriesCount: 1,
      totalSeasons: 6,
      totalEpisodes: 40,
      totalGenres: 3,
    },
    storage: {
      totalUsedBytes: 0,
      totalLimitBytes: 107374182400,
      percentUsed: 0,
      providerCount: 1,
    },
    scheduler: {
      isEnabled: true,
      isExecuting: false,
      intervalMinutes: 30,
      lastRunAt: new Date(Date.now() - 3600_000).toISOString(),
      lastRunResult: { totalProcessed: 4, successCount: 3, failureCount: 1 },
      nextRunAt: new Date(Date.now() + 1800_000).toISOString(),
    },
    ongoingSeasons: [],
    recentSeries: [],
  },
};

describe('SchedulerControls', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setAccessToken('test-access-token');
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return new Response(JSON.stringify(basePayload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setAccessToken(null);
  });

  it('renders the unified scheduler panel with status text and chips', async () => {
    renderWithProviders(<DashboardView />);
    expect(await screen.findByTestId('scheduler-controls-section')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId('scheduler-status-text')).toHaveTextContent(
        'Auto-scraper is on'
      );
    });
    expect(screen.getByTestId('scheduler-interval-chip')).toHaveTextContent('Every 30 min');
    expect(screen.getByTestId('scheduler-success-chip')).toHaveTextContent('3 succeeded');
    expect(screen.getByTestId('scheduler-failure-chip')).toHaveTextContent('1 failed');
  });

  it('hides the failure chip when failureCount is 0', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return new Response(
        JSON.stringify({
          data: {
            ...basePayload.data,
            scheduler: {
              ...basePayload.data.scheduler,
              lastRunResult: { totalProcessed: 4, successCount: 4, failureCount: 0 },
            },
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });
    renderWithProviders(<DashboardView />);
    await screen.findByTestId('scheduler-controls-section');
    await waitFor(() => {
      expect(screen.getByTestId('scheduler-success-chip')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('scheduler-failure-chip')).not.toBeInTheDocument();
  });

  it('shows failure chip when ongoingSeasons has scrape errors even if scheduler failureCount is 0', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return new Response(
        JSON.stringify({
          data: {
            ...basePayload.data,
            scheduler: {
              ...basePayload.data.scheduler,
              lastRunResult: { totalProcessed: 4, successCount: 4, failureCount: 0 },
            },
            ongoingSeasons: [
              {
                seasonId: 'season-err-1',
                seriesId: 'series-1',
                seriesTitle: 'Show With Error',
                seasonTitle: 'Season 1',
                seasonNumber: 1,
                posterUrl: null,
                episodeCount: 2,
                lastScrapedAt: null,
                lastScrapeError: 'Scrape failed: timeout',
              },
            ],
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });
    renderWithProviders(<DashboardView />);
    await screen.findByTestId('scheduler-controls-section');
    await waitFor(() => {
      expect(screen.getByTestId('scheduler-failure-chip')).toHaveTextContent('1 failed');
    });
  });

  it('renders the scheduler controls panel with countdown and last run summary', async () => {
    renderWithProviders(<DashboardView />);
    expect(await screen.findByTestId('scheduler-controls-section')).toBeInTheDocument();
    expect(screen.getByTestId('scheduler-next-run')).toHaveTextContent(/Next run:/);
    await waitFor(() => {
      expect(screen.getByTestId('scheduler-last-run-summary')).toHaveTextContent(
        'Last run: 4 processed, 3 succeeded, 1 failed'
      );
    });
  });

  it('triggers the global scrape endpoint with a spinning disabled button', async () => {
    const calls: Array<{ url: string; method?: string }> = [];
    let resolveRun!: (value: Response) => void;
    const runGate = new Promise<Response>((resolve) => {
      resolveRun = resolve;
    });
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      if (url.includes('scheduler/run')) {
        calls.push({ url, method: init?.method });
        return runGate;
      }
      return new Response(JSON.stringify(basePayload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    const { user } = renderWithProviders(<DashboardView />);
    const btn = await screen.findByTestId('scheduler-scrape-all');
    await user.click(btn);
    await waitFor(() => {
      expect(calls.length).toBe(1);
    });
    expect(calls[0].method).toBe('POST');
    expect(btn).toBeDisabled();
    expect(btn).toHaveTextContent(/scraping/i);
    resolveRun(
      new Response(
        JSON.stringify({
          data: {
            started: true,
            alreadyExecuting: false,
            isExecuting: false,
            result: { totalProcessed: 4, successCount: 4, failureCount: 0 },
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );
    await waitFor(() => {
      expect(btn).not.toBeDisabled();
    });
  });

  it('sends interval changes to the scheduler config endpoint', async () => {
    const calls: Array<{ url: string; method?: string; body?: string }> = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      if (url.includes('scheduler/config')) {
        calls.push({
          url,
          method: init?.method,
          body: typeof init?.body === 'string' ? init.body : undefined,
        });
        return new Response(JSON.stringify({ data: { intervalMinutes: 60, isEnabled: true } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify(basePayload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    const { user } = renderWithProviders(<DashboardView />);
    const toggle = await screen.findByTestId('scheduler-toggle');
    // Toggle switch flips isEnabled and PATCHes the config endpoint.
    await user.click(toggle);
    await waitFor(() => {
      expect(calls.length).toBe(1);
    });
    expect(calls[0].method).toBe('PATCH');
    expect(calls[0].body).toContain('"isEnabled":false');
  });

  it('uses fast polling while executing and slow polling when idle', () => {
    expect(
      resolveDashboardRefetchInterval({
        ...basePayload.data,
        scheduler: { ...basePayload.data.scheduler, isExecuting: true },
      } as never)
    ).toBe(SCHEDULER_POLLING_ACTIVE_MS);
    expect(
      resolveDashboardRefetchInterval({
        ...basePayload.data,
        scheduler: { ...basePayload.data.scheduler, isExecuting: false },
      } as never)
    ).toBe(SCHEDULER_POLLING_IDLE_MS);
    expect(resolveDashboardRefetchInterval(undefined)).toBe(SCHEDULER_POLLING_IDLE_MS);
  });
});
