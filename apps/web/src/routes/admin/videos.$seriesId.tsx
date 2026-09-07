import { createFileRoute } from '@tanstack/react-router';
import { SeriesDetailView, seriesDetailQueryOptions } from '@/modules/videos';
import { queryClient } from '@/lib/queryClient';

type SeriesDetailSearch = {
  order?: number;
  episodeId?: string;
  seasonId?: string;
};

export const Route = createFileRoute('/admin/videos/$seriesId')({
  validateSearch: (search: Record<string, unknown>): SeriesDetailSearch => ({
    order:
      typeof search.order === 'number'
        ? search.order
        : search.order
          ? Number(search.order)
          : undefined,
    episodeId:
      typeof search.episodeId === 'string' && search.episodeId.length > 0
        ? search.episodeId
        : undefined,
    seasonId:
      typeof search.seasonId === 'string' && search.seasonId.length > 0
        ? search.seasonId
        : undefined,
  }),
  loader: ({ params }) =>
    queryClient.ensureQueryData(seriesDetailQueryOptions(params.seriesId)),
  component: SeriesDetailPage,
});

export function SeriesDetailPage() {
  const { seriesId } = Route.useParams();
  const search = Route.useSearch();
  return (
    <SeriesDetailView
      seriesId={seriesId}
      initialOrder={search?.order}
      initialEpisodeId={search?.episodeId}
      initialSeasonId={search?.seasonId}
    />
  );
}
