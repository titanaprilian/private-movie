import { createFileRoute } from '@tanstack/react-router';
import { SeriesDetailView, seriesDetailQueryOptions } from '@/modules/videos';
import { queryClient } from '@/lib/queryClient';

export const Route = createFileRoute('/videos/$seriesId')({
  loader: ({ params }) =>
    queryClient.ensureQueryData(seriesDetailQueryOptions(params.seriesId)),
  component: SeriesDetailPage,
});

function SeriesDetailPage() {
  const { seriesId } = Route.useParams();
  return <SeriesDetailView seriesId={seriesId} />;
}
