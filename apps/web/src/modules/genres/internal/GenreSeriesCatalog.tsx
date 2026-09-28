import { useCallback, useEffect, useRef, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { fetchSeries, SeriesPosterCard, type SeriesItem } from '@/modules/videos';
import { PublicNavbar } from '@/modules/navigation';
import { genresQueryOptions } from './api';

export type GenreCatalogFilter = 'all' | 'ongoing';

export interface GenreSeriesCatalogProps {
  slug: string;
  filter: GenreCatalogFilter;
  onFilterChange: (filter: GenreCatalogFilter) => void;
}

export const GENRE_CATALOG_PAGE_LIMIT = 20;

type CatalogSeriesItem = SeriesItem & { rating?: string | null };

function formatSlugFallback(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function GenreSeriesCatalog({ slug, filter, onFilterChange }: GenreSeriesCatalogProps) {
  const navigate = useNavigate();
  const { data: genres = [] } = useQuery(genresQueryOptions());
  const genreName =
    genres.find((genre) => genre.slug === slug)?.name ?? formatSlugFallback(slug);

  const {
    data,
    isPending,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['series', 'infinite', { genre: slug, filter }],
    queryFn: ({ pageParam = 1 }) =>
      fetchSeries({ genre: slug, filter, page: pageParam, limit: GENRE_CATALOG_PAGE_LIMIT }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.meta.page * lastPage.meta.limit < lastPage.meta.total
        ? lastPage.meta.page + 1
        : undefined,
  });

  // NOTE: TanStack Query v5 types `isFetchNextPageError` as literal `false`
  // on every infinite-query result variant, so it cannot be used for
  // narrowing. Track incremental page failures in local state instead.
  const [isNextPageError, setIsNextPageError] = useState(false);

  useEffect(() => {
    setIsNextPageError(false);
  }, [slug, filter]);

  const handleFetchNextPage = useCallback(() => {
    setIsNextPageError(false);
    // `fetchNextPage()` resolves (rather than rejects) with the latest
    // observer result unless `throwOnError` is set, so inspect the resolved
    // result for the failure and handle rejection as a fallback.
    void fetchNextPage().then(
      (result) => {
        if (result.isError) {
          setIsNextPageError(true);
        }
      },
      () => {
        setIsNextPageError(true);
      }
    );
  }, [fetchNextPage]);

  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasNextPage || isFetchingNextPage || isNextPageError) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          handleFetchNextPage();
        }
      },
      { rootMargin: '400px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, isNextPageError, handleFetchNextPage]);

  const pages = data?.pages ?? [];
  const items = pages.flatMap((page) => page.series as CatalogSeriesItem[]);
  const total = pages[0]?.meta.total ?? 0;
  const hasLoadedPages = items.length > 0;

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <PublicNavbar />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 pt-24">
        <h1 className="text-2xl md:text-3xl font-bold">{genreName}</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {filter === 'ongoing'
            ? 'Currently airing series in this genre.'
            : 'Browse every series in this genre.'}
        </p>

        <div role="tablist" aria-label="Filter series by status" className="mt-5 inline-flex rounded-full border border-[var(--border)] bg-[var(--surface)] p-1">
          {(
            [
              { value: 'all', label: 'All Series' },
              { value: 'ongoing', label: 'Ongoing' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={filter === tab.value}
              onClick={() => {
                if (filter !== tab.value) {
                  onFilterChange(tab.value);
                }
              }}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
                filter === tab.value
                  ? 'bg-[var(--ink)] text-[var(--bg)]'
                  : 'text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {isPending ? (
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
            {Array.from({ length: 12 }).map((_, index) => (
              <div
                key={index}
                data-testid="series-card-skeleton"
                className="overflow-hidden rounded-md border border-[var(--border)] bg-[var(--surface)]"
              >
                <div className="aspect-[2/3] w-full animate-pulse bg-[var(--surface-raised)]" />
                <div className="space-y-2 p-3">
                  <div className="h-4 w-3/4 animate-pulse rounded bg-zinc-800" />
                  <div className="h-3 w-1/2 animate-pulse rounded bg-zinc-800" />
                </div>
              </div>
            ))}
          </div>
        ) : isError && !hasLoadedPages ? (
          <div className="mt-6 rounded-md border border-[var(--border)] bg-[var(--surface)] p-8 text-center">
            <p className="text-sm text-[var(--muted)]">Failed to load series. Please try again.</p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="mt-4 rounded-full bg-[var(--ink)] px-4 py-1.5 text-sm font-medium text-[var(--bg)] cursor-pointer hover:brightness-110 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : total === 0 ? (
          <div className="mt-6 rounded-md border border-[var(--border)] bg-[var(--surface)] p-8 text-center">
            <p className="text-sm text-[var(--muted)]">
              {filter === 'ongoing'
                ? `No ongoing series found in ${genreName}.`
                : `No series found in ${genreName}.`}
            </p>
            {filter === 'ongoing' && (
              <button
                type="button"
                onClick={() => onFilterChange('all')}
                className="mt-4 rounded-full bg-[var(--ink)] px-4 py-1.5 text-sm font-medium text-[var(--bg)] cursor-pointer hover:brightness-110 transition-colors"
              >
                Show All Series
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
              {items.map((item) => (
                <SeriesPosterCard
                  key={item.id}
                  seriesId={item.id}
                  title={item.title}
                  posterUrl={
                    item.posterUrl ||
                    'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?q=80&w=800&auto=format&fit=crop'
                  }
                  type={item.type ?? 'tv'}
                  seasonsCount={
                    typeof (item as { seasonsCount?: number | null }).seasonsCount === 'number'
                      ? (item as { seasonsCount?: number | null }).seasonsCount
                      : undefined
                  }
                  rating={item.rating ?? undefined}
                  onSelect={(seriesId) =>
                    navigate({ to: '/watch/$seriesId', params: { seriesId } })
                  }
                />
              ))}
            </div>

            <div ref={sentinelRef} data-testid="infinite-sentinel" className="h-4 w-full" />

            {isFetchingNextPage && (
              <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div
                    key={index}
                    data-testid="series-card-skeleton"
                    className="overflow-hidden rounded-md border border-[var(--border)] bg-[var(--surface)]"
                  >
                    <div className="aspect-[2/3] w-full animate-pulse bg-[var(--surface-raised)]" />
                    <div className="p-3">
                      <div className="h-4 w-3/4 animate-pulse rounded bg-zinc-800" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {isNextPageError && (
              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={handleFetchNextPage}
                  className="rounded-full border border-[var(--border-strong)] px-4 py-1.5 text-sm font-medium text-[var(--ink)] cursor-pointer hover:border-[var(--muted)] transition-colors"
                >
                  Retry
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
