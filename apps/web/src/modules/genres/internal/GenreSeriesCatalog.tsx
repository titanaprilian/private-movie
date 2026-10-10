import { useCallback, useEffect, useRef, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import {
  fetchSeries,
  SeriesPosterCard,
  type SeriesItem,
} from '@/modules/videos';
import { PublicNavbar } from '@/modules/navigation';
import { ChunkyButton } from '@/components/ui/chunky-button';
import { formatSlugFallback } from '@/lib/utils';
import { ChunkyCard } from '@/components/ui/chunky-card';
import { ChunkySkeleton } from '@/components/ui/chunky-skeleton';
import {
  ChunkyTabs,
  ChunkyTabsList,
  ChunkyTabsTrigger,
} from '@/components/ui/chunky-tabs';
import { genresQueryOptions } from './api';
import {
  GENRE_CATALOG_PAGE_LIMIT,
  type GenreCatalogFilter,
  type GenreSeriesCatalogProps,
} from './types';

export { GENRE_CATALOG_PAGE_LIMIT };

type CatalogSeriesItem = SeriesItem & { rating?: string | null };

function formatRating(rating?: string | null): string | undefined {
  if (rating == null || rating === '') return undefined;
  const parsed = Number(rating);
  if (!Number.isFinite(parsed)) return rating;
  return parsed.toFixed(1);
}

export function GenreSeriesCatalog({
  slug,
  filter,
  onFilterChange,
}: GenreSeriesCatalogProps) {
  const navigate = useNavigate();
  const { data: genres = [] } = useQuery(genresQueryOptions());
  const genreName =
    genres.find((genre) => genre.slug === slug)?.name ??
    formatSlugFallback(slug);

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
      fetchSeries({
        genre: slug,
        filter,
        page: pageParam,
        limit: GENRE_CATALOG_PAGE_LIMIT,
      }),
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
      <div className="w-full px-8 md:px-16 py-8 pt-24">
        <h1 className="text-2xl md:text-3xl font-display font-extrabold">
          {genreName}
        </h1>
        <p className="mt-1 text-sm font-sans font-semibold text-[var(--muted)]">
          {filter === 'ongoing'
            ? 'Currently airing series in this genre.'
            : 'Browse every series in this genre.'}
        </p>

        <ChunkyTabs
          value={filter}
          onValueChange={(value) => {
            if (value !== filter) {
              onFilterChange(value as GenreCatalogFilter);
            }
          }}
          className="mt-5"
        >
          <ChunkyTabsList aria-label="Filter series by status">
            <ChunkyTabsTrigger value="all">All Series</ChunkyTabsTrigger>
            <ChunkyTabsTrigger value="ongoing">Ongoing</ChunkyTabsTrigger>
          </ChunkyTabsList>
        </ChunkyTabs>

        {isPending ? (
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4">
            {Array.from({ length: 12 }).map((_, index) => (
              <div
                key={index}
                data-testid="series-card-skeleton"
                className="overflow-hidden rounded-2xl border-2 border-b-4 border-[var(--border)] bg-[var(--surface)]"
              >
                <ChunkySkeleton className="aspect-[2/3] w-full rounded-2xl border-0" />
                <div className="space-y-2 p-3">
                  <ChunkySkeleton className="h-4 w-3/4 rounded-2xl" />
                  <ChunkySkeleton className="h-3 w-1/2 rounded-2xl" />
                </div>
              </div>
            ))}
          </div>
        ) : isError && !hasLoadedPages ? (
          <ChunkyCard className="mt-6 p-8 text-center">
            <p className="text-sm text-[var(--muted)]">
              Failed to load series. Please try again.
            </p>
            <ChunkyButton
              type="button"
              onClick={() => void refetch()}
              className="mt-4"
            >
              Retry
            </ChunkyButton>
          </ChunkyCard>
        ) : total === 0 ? (
          <ChunkyCard className="mt-6 p-8 text-center">
            <p className="text-sm text-[var(--muted)]">
              {filter === 'ongoing'
                ? `No ongoing series found in ${genreName}.`
                : `No series found in ${genreName}.`}
            </p>
            {filter === 'ongoing' && (
              <ChunkyButton
                type="button"
                onClick={() => onFilterChange('all')}
                className="mt-4"
              >
                Show All Series
              </ChunkyButton>
            )}
          </ChunkyCard>
        ) : (
          <>
            <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="min-w-0 [&>[data-testid='series-card']]:w-full"
                >
                  <SeriesPosterCard
                    seriesId={item.id}
                    title={item.title}
                    posterUrl={
                      item.posterUrl ||
                      'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?q=80&w=800&auto=format&fit=crop'
                    }
                    type={item.type ?? 'tv'}
                    seasonsCount={
                      typeof (item as { seasonsCount?: number | null })
                        .seasonsCount === 'number'
                        ? (item as { seasonsCount?: number | null })
                            .seasonsCount
                        : undefined
                    }
                    rating={formatRating(item.rating)}
                    onSelect={(seriesId) =>
                      navigate({ to: '/watch/$seriesId', params: { seriesId } })
                    }
                  />
                </div>
              ))}
            </div>

            <div
              ref={sentinelRef}
              data-testid="infinite-sentinel"
              className="h-4 w-full"
            />

            {isFetchingNextPage && (
              <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div
                    key={index}
                    data-testid="series-card-skeleton"
                    className="overflow-hidden rounded-2xl border-2 border-b-4 border-[var(--border)] bg-[var(--surface)]"
                  >
                    <ChunkySkeleton className="aspect-[2/3] w-full rounded-2xl border-0" />
                    <div className="p-3">
                      <ChunkySkeleton className="h-4 w-3/4 rounded-2xl" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {isNextPageError && (
              <div className="mt-4 text-center">
                <ChunkyButton
                  type="button"
                  variant="outline"
                  onClick={handleFetchNextPage}
                >
                  Retry
                </ChunkyButton>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
