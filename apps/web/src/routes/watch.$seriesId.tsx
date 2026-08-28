import { createFileRoute } from '@tanstack/react-router';
import { SeriesWatchView, getSeriesWithEpisodesQueryOptions } from '@/modules/watch';
import { queryClient } from '@/lib/queryClient';

export const Route = createFileRoute('/watch/$seriesId')({
  loader: ({ params }) =>
    queryClient.ensureQueryData(getSeriesWithEpisodesQueryOptions(params.seriesId)),
  component: WatchSeriesPage,
});

export function WatchSeriesPage() {
  const params = Route.useParams();
  const series = Route.useLoaderData();
  return <SeriesWatchView seriesId={params.seriesId} series={series} />;
}