import { createFileRoute } from '@tanstack/react-router';
import { GenreManager } from '@/modules/genres';

export const Route = createFileRoute('/genres')({
  component: GenresPage,
});

export function GenresPage() {
  return <GenreManager />;
}
