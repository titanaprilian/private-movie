import { createFileRoute } from '@tanstack/react-router';
import { StorageSeriesDetailView } from '@/modules/storage';

type StorageSeriesDetailSearch = {
  seasonId?: string;
  providerId?: string;
};

export const Route = createFileRoute('/admin/storage/$seriesId')({
  validateSearch: (search: Record<string, unknown>): StorageSeriesDetailSearch => ({
    seasonId:
      typeof search.seasonId === 'string' && search.seasonId.length > 0
        ? search.seasonId
        : undefined,
    providerId:
      typeof search.providerId === 'string' && search.providerId.length > 0
        ? search.providerId
        : undefined,
  }),
  component: StorageSeriesDetailPage,
});

export function StorageSeriesDetailPage() {
  const { seriesId } = Route.useParams();
  const search = Route.useSearch();
  return (
    <StorageSeriesDetailView
      seriesId={seriesId}
      initialSeasonId={search?.seasonId}
      initialProviderId={search?.providerId}
    />
  );
}
