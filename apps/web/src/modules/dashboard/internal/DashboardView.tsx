import { Link } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { ChunkyButton } from '@/components/ui/chunky-button';
import {
  adminDashboardQueryOptions,
  runSchedulerScrapeAll,
  scrapeOngoingSeason,
  updateSchedulerConfig,
} from './api';
import { ActivityFeed } from './ActivityFeed';
import { OngoingSeriesGrid } from './OngoingSeriesGrid';
import { StatsRow } from './StatsRow';
import { SchedulerPanel } from './SchedulerPanel';

export function DashboardView() {
  const queryClient = useQueryClient();
  const dashboardQuery = useQuery(adminDashboardQueryOptions());
  const catalog = dashboardQuery.data?.catalog;
  const storage = dashboardQuery.data?.storage;
  const scheduler = dashboardQuery.data?.scheduler;
  const ongoingSeasons = dashboardQuery.data?.ongoingSeasons ?? [];
  const recentSeries = dashboardQuery.data?.recentSeries ?? [];

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
  };

  const scrapeMutation = useMutation({
    mutationFn: (seasonId: string) => scrapeOngoingSeason(seasonId),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
      if (result.sourcesSaved > 0) {
        toast.success(
          `Scrape completed: ${result.sourcesSaved} source${result.sourcesSaved === 1 ? '' : 's'} saved across ${result.episodesScraped} episode${result.episodesScraped === 1 ? '' : 's'}`
        );
      } else {
        toast.success('Scrape completed: no new sources found');
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to scrape ongoing season');
    },
  });

  const scrapeAllMutation = useMutation({
    mutationFn: () => runSchedulerScrapeAll(),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
      if (result.result) {
        toast.success(
          `Global scrape finished: ${result.result.successCount} succeeded, ${result.result.failureCount} failed across ${result.result.totalProcessed} seasons`
        );
      } else {
        toast.success('Global scrape started');
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to trigger global scrape');
    },
  });

  const configMutation = useMutation({
    mutationFn: (dto: { intervalMinutes?: number; isEnabled?: boolean }) =>
      updateSchedulerConfig(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
      toast.success('Scheduler configuration updated');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update scheduler configuration');
    },
  });

  const isScrapeAllRunning = scrapeAllMutation.isPending || scheduler?.isExecuting === true;
  const scrapingSeasonId = scrapeMutation.isPending
    ? (scrapeMutation.variables as string | undefined) ?? null
    : null;
  const ongoingFailureCount = ongoingSeasons.filter((s) => Boolean(s.lastScrapeError)).length;

  return (
    <div className="space-y-6 w-full" data-testid="dashboard-container">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-[var(--ink)]">
            Dashboard
          </h1>
          <p className="font-sans text-sm font-semibold text-[var(--muted)] mt-1">
            Catalog overview and quick actions for your library.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <ChunkyButton
            variant="outline"
            onClick={handleRefresh}
            aria-label="Refresh dashboard"
            disabled={dashboardQuery.isFetching}
          >
            <RefreshCw
              aria-hidden="true"
              className={dashboardQuery.isFetching ? 'animate-spin' : ''}
            />
            Refresh
          </ChunkyButton>
          <Link to="/admin/videos" aria-label="Add Series">
            <ChunkyButton variant="primary">
              <Plus aria-hidden="true" />
              Add Series
            </ChunkyButton>
          </Link>
        </div>
      </div>

      {dashboardQuery.isError && (
        <div
          role="alert"
          className="rounded-2xl border-2 border-b-4 border-[var(--border)] bg-[var(--surface)] p-5 font-sans text-sm font-semibold text-[var(--ink)]"
        >
          Failed to load dashboard metrics.
          <button
            type="button"
            onClick={handleRefresh}
            className="ml-2 underline cursor-pointer"
          >
            Try again
          </button>
        </div>
      )}

      <StatsRow catalog={catalog} storage={storage} />

      <SchedulerPanel
        scheduler={scheduler}
        ongoingFailureCount={ongoingFailureCount}
        isScrapeAllRunning={isScrapeAllRunning}
        configPending={configMutation.isPending}
        onScrapeAll={() => scrapeAllMutation.mutate()}
        onIntervalChange={(minutes) => configMutation.mutate({ intervalMinutes: minutes })}
        onToggle={() => configMutation.mutate({ isEnabled: !(scheduler?.isEnabled === true) })}
      />

      <section aria-labelledby="ongoing-series-heading" data-testid="ongoing-series-section">
        <h2
          id="ongoing-series-heading"
          className="font-display text-xl font-extrabold tracking-tight text-[var(--ink)]"
        >
          Active Ongoing Series
        </h2>
        <p className="font-sans text-sm font-semibold text-[var(--muted)] mt-1">
          Airing seasons monitored by the auto-scraper.
        </p>
        <OngoingSeriesGrid
          seasons={ongoingSeasons}
          scrapingSeasonId={scrapingSeasonId}
          onScrape={(seasonId) => scrapeMutation.mutate(seasonId)}
        />
      </section>

      <section aria-labelledby="recent-series-heading" data-testid="recent-series-section">
        <h2
          id="recent-series-heading"
          className="font-display text-xl font-extrabold tracking-tight text-[var(--ink)]"
        >
          Recent Series Activity
        </h2>
        <p className="font-sans text-sm font-semibold text-[var(--muted)] mt-1">
          The 5 most recently updated series.
        </p>
        <ActivityFeed ongoingSeasons={ongoingSeasons} recentSeries={recentSeries} />
      </section>
    </div>
  );
}
