import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { SeriesCatalog } from '@/modules/video-grid';

export const Route = createFileRoute('/videos/')({
  component: VideosIndexPage,
});

function VideosIndexPage() {
  const navigate = useNavigate();
  return (
    <SeriesCatalog
      onNavigate={(seriesId) => navigate({ to: '/videos/$seriesId', params: { seriesId } })}
    />
  );
}