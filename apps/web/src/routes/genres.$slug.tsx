import { createFileRoute } from '@tanstack/react-router';
import { CinematicHome } from '@/modules/home';

export const Route = createFileRoute('/genres/$slug')({
  component: GenreFeedPage,
});

function GenreFeedPage() {
  const { slug } = Route.useParams();
  return <CinematicHome genreSlug={slug} />;
}
