import { createFileRoute } from '@tanstack/react-router';
import { SeriesDetailView, seriesDetailQueryOptions } from '@/modules/videos';
import { queryClient } from '@/lib/queryClient';

type SeriesDetailSearch = {
  order?: number;
};

export const Route = createFileRoute('/videos/$seriesId')({
  validateSearch: (search: Record<string, unknown>): SeriesDetailSearch => ({
    order:
      typeof search.order === 'number'
        ? search.order
        : search.order
          ? Number(search.order)
          : undefined,
  }),
  loader: ({ params }) =>
    queryClient.ensureQueryData(seriesDetailQueryOptions(params.seriesId)),
  component: SeriesDetailPage,
});

function SeriesDetailPage() {
  const { seriesId } = Route.useParams();
  const search = Route.useSearch ? Route.useSearch() : undefined;
  return <SeriesDetailView seriesId={seriesId} initialOrder={search?.order} />;
}
