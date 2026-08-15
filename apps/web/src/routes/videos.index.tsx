import { createFileRoute } from '@tanstack/react-router';
import { SeriesGrid, seriesListQueryOptions } from '@/modules/videos';
import { queryClient } from '@/lib/queryClient';

export const Route = createFileRoute('/videos/')({
  loader: () => queryClient.ensureQueryData(seriesListQueryOptions()),
  component: VideosIndexPage,
});

function VideosIndexPage() {
  return <SeriesGrid />;
}
