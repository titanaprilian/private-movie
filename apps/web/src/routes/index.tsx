import { createFileRoute } from '@tanstack/react-router';
import { CinematicHome, homeFeedQueryOptions } from '@/modules/home';
import { queryClient } from '@/lib/queryClient';

export const Route = createFileRoute('/')({
  loader: () => queryClient.ensureQueryData(homeFeedQueryOptions()),
  component: IndexPage,
});

export function IndexPage() {
  return <CinematicHome />;
}
