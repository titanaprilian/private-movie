import { createFileRoute } from '@tanstack/react-router';
import { CinematicHome } from '@/modules/home';

export const Route = createFileRoute('/')({
  component: IndexPage,
});

export function IndexPage() {
  return <CinematicHome />;
}
