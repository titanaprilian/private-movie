import { createFileRoute } from '@tanstack/react-router';
import { SeriesGrid, seriesListQueryOptions } from '@/modules/videos';
import { genresQueryOptions } from '@/modules/genres';
import { queryClient } from '@/lib/queryClient';

export type SeriesListSearch = {
  page?: number;
  q?: string;
  genre?: string;
  tab?: 'all' | 'featured' | 'ongoing';
  highlighted?: boolean;
};

export const Route = createFileRoute('/admin/videos/')({
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
    const rawGenre =
      typeof search.genre === 'string' ? search.genre.trim() : undefined;
    const genre = rawGenre && rawGenre.length > 0 ? rawGenre : undefined;
    const rawTab =
      typeof search.tab === 'string' ? search.tab.trim().toLowerCase() : undefined;
    const tab =
      rawTab === 'featured' || rawTab === 'ongoing' || rawTab === 'all'
        ? (rawTab as 'all' | 'featured' | 'ongoing')
        : undefined;
    const rawHighlighted = search.highlighted;
    const highlighted =
      rawHighlighted === true ||
      rawHighlighted === 'true' ||
      rawHighlighted === 1 ||
      rawHighlighted === '1'
        ? true
        : undefined;

    return { page, q, genre, tab, highlighted };
  },
  loaderDeps: ({ search: { page, q, genre, tab, highlighted } }) => ({ page, q, genre, tab, highlighted }),
  loader: ({ deps }: { deps?: SeriesListSearch } = {}) =>
    Promise.all([
      queryClient.ensureQueryData(genresQueryOptions()),
      queryClient.ensureQueryData(seriesListQueryOptions(deps)),
    ]),
  component: VideosIndexPage,
});

export function VideosIndexPage() {
  return <SeriesGrid />;
}
