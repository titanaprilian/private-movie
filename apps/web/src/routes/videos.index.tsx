import { createFileRoute } from '@tanstack/react-router';
import { VideoList, episodesQueryOptions } from '@/modules/videos';
import { queryClient } from '@/lib/queryClient';

export const Route = createFileRoute('/videos/')({
  loader: () => queryClient.ensureQueryData(episodesQueryOptions()),
  component: VideosIndexPage,
});

function VideosIndexPage() {
  return <VideoList />;
}
