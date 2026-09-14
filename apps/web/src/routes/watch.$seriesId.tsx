import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { SeriesWatchView, getSeriesWithEpisodesQueryOptions } from '@/modules/watch';
import { queryClient } from '@/lib/queryClient';

const searchSchema = z.object({
  ep: z.string().optional(),
});

export type WatchRouteSearch = z.infer<typeof searchSchema>;

export const Route = createFileRoute('/watch/$seriesId')({
  validateSearch: (search: Record<string, unknown>): WatchRouteSearch => {
    return searchSchema.parse(search);
  },
  loader: ({ params }) =>
    queryClient.ensureQueryData(getSeriesWithEpisodesQueryOptions(params.seriesId)),
  component: WatchSeriesPage,
});

export function WatchSeriesPage() {
  const params = Route.useParams();
  const search = Route.useSearch();
  const series = Route.useLoaderData();
  return (
    <SeriesWatchView
      seriesId={params.seriesId}
      series={series}
      initialEpisodeId={search.ep}
    />
  );
}
