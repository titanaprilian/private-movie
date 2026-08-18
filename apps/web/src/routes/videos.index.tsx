import { createFileRoute } from '@tanstack/react-router';
import { SeriesGrid, seriesListQueryOptions } from '@/modules/videos';
import { queryClient } from '@/lib/queryClient';

export type SeriesListSearch = {
  page?: number;
  q?: string;
};

export const Route = createFileRoute('/videos/')({
  validateSearch: (search: Record<string, unknown>): SeriesListSearch => {
    const pageNum =
      typeof search.page === 'number'
        ? search.page
        : search.page
          ? Number(search.page)
          : 1;
    const page = Number.isInteger(pageNum) && pageNum > 0 ? pageNum : 1;
    const rawQ = typeof search.q === 'string' ? search.q.trim() : undefined;
    const q = rawQ && rawQ.length > 0 ? rawQ : undefined;

    return { page, q };
  },
  loaderDeps: ({ search: { page, q } }) => ({ page, q }),
  loader: ({ deps }: { deps?: { page?: number; q?: string } } = {}) =>
    queryClient.ensureQueryData(seriesListQueryOptions(deps)),
  component: VideosIndexPage,
});

function VideosIndexPage() {
  return <SeriesGrid />;
}
