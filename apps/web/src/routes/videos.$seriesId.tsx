import { createFileRoute } from '@tanstack/react-router';
import { SeriesDetailView } from '@/modules/videos';

export const Route = createFileRoute('/videos/$seriesId')({
  component: SeriesDetailPage,
});

function SeriesDetailPage() {
  const { seriesId } = Route.useParams();
  return <SeriesDetailView seriesId={seriesId} />;
}
