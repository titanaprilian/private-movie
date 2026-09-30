import { describe, expect, it } from 'vitest';
import { Route, AdminDashboardPage } from '@/routes/admin/index';
import { renderWithProviders, screen } from '../../utils';
import { vi } from 'vitest';

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>();
  return {
    ...actual,
    createFileRoute: () => (config: unknown) => config,
    Link: ({
      children,
      to,
    }: {
      children: React.ReactNode;
      to: string;
    }) => <a href={to}>{children}</a>,
    useNavigate: () => vi.fn(),
  };
});

vi.mock('@/lib/api', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    api: {
      admin: {
        dashboard: {
          get: vi.fn(async () => ({
            data: {
              data: {
                catalog: {
                  totalSeries: 1,
                  ongoingSeriesCount: 0,
                  featuredSeriesCount: 0,
                  totalSeasons: 1,
                  totalEpisodes: 2,
                  totalGenres: 1,
                },
                storage: {
                  totalUsedBytes: 0,
                  totalLimitBytes: 0,
                  percentUsed: 0,
                  providerCount: 0,
                },
                scheduler: {
                  isEnabled: false,
                  isExecuting: false,
                  intervalMinutes: 30,
                  lastRunAt: null,
                  lastRunResult: null,
                  nextRunAt: null,
                },
                ongoingSeasons: [],
                recentSeries: [],
              },
            },
            error: null,
          })),
        },
      },
    },
  };
});

describe('/admin/ dashboard route', () => {
  it('exports a Route without redirect and renders DashboardView', async () => {
    expect(Route).toBeDefined();
    const routeObj = Route as unknown as { beforeLoad?: unknown };
    expect(routeObj.beforeLoad).toBeUndefined();

    renderWithProviders(<AdminDashboardPage />);
    expect(
      await screen.findByRole('heading', { name: 'Dashboard' })
    ).toBeInTheDocument();
    expect(await screen.findByTestId('kpi-total-series')).toBeInTheDocument();
  });
});
