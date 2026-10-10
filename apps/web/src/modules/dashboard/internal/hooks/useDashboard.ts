import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  adminDashboardQueryOptions,
  runSchedulerScrapeAll,
  scrapeOngoingSeason,
  updateSchedulerConfig,
} from '../api';
import type { SchedulerConfigUpdate, UseDashboardReturn } from '../types';

export function useDashboard(): UseDashboardReturn {
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
      queryClient.invalidateQueries({ queryKey: ['series'] });
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
    mutationFn: (dto: SchedulerConfigUpdate) => updateSchedulerConfig(dto),
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

  return {
    dashboardQuery,
    catalog,
    storage,
    scheduler,
    ongoingSeasons,
    recentSeries,
    handleRefresh,
    scrapeMutation,
    scrapeAllMutation,
    configMutation,
    isScrapeAllRunning,
    scrapingSeasonId,
    ongoingFailureCount,
  };
}
