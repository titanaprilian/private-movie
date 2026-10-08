import { useEffect, useRef, useState } from 'react';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { toast } from 'sonner';
import { SERIES_PAGE_LIMIT } from '../api';
import { genresQueryOptions } from '@/modules/genres';
import {
  seriesListQueryOptions,
  updateSeries,
  deleteSeries,
  type SeriesItem,
} from '../api';
import { AddMediaDialog } from './AddMediaDialog';
import { EditSeriesDialog } from './EditSeriesDialog';
import { SeriesCard } from './SeriesCard';
import { GenreFilter } from './GenreFilter';
import { useScrapeWorkerStore } from '../store/useScrapeWorkerStore';
import { ChunkyConfirmDialog } from '@/components/ui/chunky-confirm-dialog';
import { ChunkyTooltip } from '@/components/ui/chunky-tooltip';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ChunkyButton } from '@/components/ui/chunky-button';
import { ChunkyChip } from '@/components/ui/chunky-chip';
import {
  ChunkyTabs,
  ChunkyTabsList,
  ChunkyTabsTrigger,
} from '@/components/ui/chunky-tabs';

const SEARCH_DEBOUNCE_MS = 250;

type SeriesSearch = {
  page?: number;
  q?: string;
  genre?: string;
  tab?: 'all' | 'featured' | 'ongoing';
  highlighted?: boolean;
};

export function SeriesGrid() {
  const search = useSearch({ from: '/admin/videos/' }) as SeriesSearch;
  const navigate = useNavigate({ from: '/admin/videos/' });
  const openDialog = useScrapeWorkerStore((state) => state.openDialog);
  const queryClient = useQueryClient();

  const currentPage =
    Number.isInteger(search.page) && (search.page as number) > 0
      ? (search.page as number)
      : 1;

  const queryParams = {
    page: currentPage,
    q: search.q,
    genre: search.genre,
    tab: search.tab,
    highlighted: search.highlighted,
    limit: SERIES_PAGE_LIMIT,
  };

  const { data } = useQuery({
    ...seriesListQueryOptions(queryParams),
    placeholderData: keepPreviousData,
  });

  const activeTab =
    search.tab === 'featured' || search.tab === 'ongoing' ? search.tab : 'all';

  const highlightedOnly = search.highlighted === true;

  const { data: genres = [] } = useQuery(genresQueryOptions());

  const bigGenres = genres.filter((genre) => Boolean(genre.isBigGenre));

  const highlightedCountsQuery = useQuery({
    ...seriesListQueryOptions({ filter: 'ongoing', highlighted: true, limit: 100 }),
    enabled: activeTab === 'ongoing',
    staleTime: 30_000,
  });
  const highlightedSeries = highlightedCountsQuery.data?.series ?? [];
  const highlightedCountByGenreSlug = new Map<string, number>();
  for (const item of highlightedSeries) {
    const itemGenres = Array.isArray(item.genres) ? item.genres : [];
    for (const genre of itemGenres) {
      const slug = typeof genre === 'string' ? genre : genre.slug;
      if (slug) {
        highlightedCountByGenreSlug.set(
          slug,
          (highlightedCountByGenreSlug.get(slug) ?? 0) + 1
        );
      }
    }
  }

  const searchQ = search.q ?? '';
  const [inputValue, setInputValue] = useState(searchQ);
  const lastSyncedQRef = useRef(searchQ);
  const [editingSeries, setEditingSeries] = useState<SeriesItem | null>(null);
  const [deletingSeries, setDeletingSeries] = useState<SeriesItem | null>(null);

  const handleToggleHighlightedOnly = () => {
    navigate({
      search: (old: Record<string, unknown>) => ({
        ...old,
        highlighted: highlightedOnly ? undefined : true,
        page: 1,
      }),
    });
  };

  const handleTabChange = (nextTab: string) => {
    navigate({
      search: (old: Record<string, unknown>) => ({
        ...old,
        tab: nextTab === 'all' ? undefined : (nextTab as 'featured' | 'ongoing'),
        page: 1,
      }),
    });
  };

  const selectedSlugs = search.genre
    ? search.genre
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  const handleGenreSelectionChange = (next: string[]) => {
    navigate({
      search: (old: Record<string, unknown>) => ({
        ...old,
        genre: next.length > 0 ? next.join(',') : undefined,
        page: 1,
      }),
    });
  };

  const handleToggleGenre = (slug: string) => {
    const next = selectedSlugs.includes(slug)
      ? selectedSlugs.filter((s) => s !== slug)
      : [...selectedSlugs, slug];
    handleGenreSelectionChange(next);
  };

  useEffect(() => {
    if (searchQ !== lastSyncedQRef.current) {
      lastSyncedQRef.current = searchQ;
      setInputValue(searchQ);
    }
  }, [searchQ]);

  useEffect(() => {
    const trimmed = inputValue.trim();
    if (trimmed === lastSyncedQRef.current) {
      return;
    }

    const handler = setTimeout(() => {
      lastSyncedQRef.current = trimmed;
      navigate({
        search: (old: Record<string, unknown>) => ({
          ...old,
          q: trimmed || undefined,
          page: 1,
        }),
        replace: true,
      });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(handler);
    };
  }, [inputValue, navigate]);

  const seriesList = data?.series ?? [];
  const meta = data?.meta ?? {
    total: seriesList.length,
    page: currentPage,
    limit: SERIES_PAGE_LIMIT,
  };
  const limit = meta.limit || SERIES_PAGE_LIMIT;
  const totalPages = Math.max(1, Math.ceil(meta.total / limit));

  // Clamp out-of-bounds page params to valid ranges.
  useEffect(() => {
    if (meta.total > 0 && currentPage > totalPages) {
      navigate({
        search: (old: Record<string, unknown>) => ({
          ...old,
          page: totalPages,
        }),
        replace: true,
      });
    }
  }, [currentPage, totalPages, meta.total, navigate]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSeries(id),
    onSuccess: (_deleted, id) => {
      queryClient.invalidateQueries({ queryKey: ['series'] });
      toast.success('series.delete', {
        description: 'Successfully deleted series',
      });
      // If the deleted card was the sole item on page > 1, step back.
      const wasLastOnPage =
        seriesList.length === 1 &&
        seriesList.some((item) => item.id === id);
      if (wasLastOnPage && currentPage > 1) {
        navigate({
          search: (old: Record<string, unknown>) => ({
            ...old,
            page: currentPage - 1,
          }),
        });
      }
      setDeletingSeries(null);
    },
    onError: (error: Error) => {
      toast.error('series.delete', {
        description: `Failed to delete series: ${error.message}`,
      });
    },
  });

  type SeriesListQueryData = { series: SeriesItem[]; meta: { total: number; page: number; limit: number } };

  const featuredMutation = useMutation({
    mutationFn: ({ id, featured }: { id: string; featured: boolean }) =>
      updateSeries(id, { isFeatured: featured }),
    onMutate: async ({ id, featured }) => {
      await queryClient.cancelQueries({ queryKey: ['series'] });
      const previous = queryClient.getQueriesData<SeriesListQueryData>({
        queryKey: ['series'],
      });
      queryClient.setQueriesData<SeriesListQueryData>(
        { queryKey: ['series'] },
        (old) => {
          if (!old || !Array.isArray(old.series)) return old;
          if (activeTab === 'featured' && !featured) {
            const nextSeries = old.series.filter((item) => item.id !== id);
            return {
              ...old,
              series: nextSeries,
              meta: {
                ...old.meta,
                total: Math.max(0, (old.meta?.total ?? nextSeries.length) - 1),
              },
            };
          }
          return {
            ...old,
            series: old.series.map((item) =>
              item.id === id ? { ...item, isFeatured: featured } : item
            ),
          };
        }
      );
      return { previous };
    },
    onError: (error: Error, _vars, context) => {
      context?.previous.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
      toast.error('series.featured', {
        description: `Failed to update featured status: ${error.message}`,
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['series'] });
    },
  });

  const handleToggleFeatured = (item: SeriesItem) => {
    featuredMutation.mutate({
      id: item.id,
      featured: !item.isFeatured,
    });
  };

  const handleOpenEdit = (item: SeriesItem, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingSeries(item);
  };

  const handleOpenDelete = (item: SeriesItem, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDeletingSeries(item);
  };

  const highlightMutation = useMutation({
    mutationFn: ({ id, highlighted }: { id: string; highlighted: boolean }) =>
      updateSeries(id, { isOngoingHighlighted: highlighted }),
    onMutate: async ({ id, highlighted }) => {
      await queryClient.cancelQueries({ queryKey: ['series'] });
      const previous = queryClient.getQueriesData<SeriesListQueryData>({
        queryKey: ['series'],
      });
      queryClient.setQueriesData<SeriesListQueryData>(
        { queryKey: ['series'] },
        (old) => {
          if (!old || !Array.isArray(old.series)) return old;
          return {
            ...old,
            series: old.series.map((item) =>
              item.id === id
                ? { ...item, isOngoingHighlighted: highlighted }
                : item
            ),
          };
        }
      );
      return { previous };
    },
    onError: (error: Error, _vars, context) => {
      context?.previous.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
      toast.error('series.highlight', {
        description: `Failed to update highlight: ${error.message}`,
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['series'] });
    },
  });

  const handleToggleHighlight = (
    item: SeriesItem,
    e: React.MouseEvent
  ) => {
    e.preventDefault();
    e.stopPropagation();
    highlightMutation.mutate({
      id: item.id,
      highlighted: !item.isOngoingHighlighted,
    });
  };

  const isFirstPage = currentPage <= 1;
  const isLastPage = currentPage >= totalPages;

  const gridTopRef = useRef<HTMLDivElement>(null);

  const goToPage = (page: number) => {
    navigate({
      search: (old: Record<string, unknown>) => ({ ...old, page }),
    });
    gridTopRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="space-y-4">
      {/* Header section */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-extrabold leading-tight">Series</h1>
          <p className="text-[15px] font-semibold text-[var(--muted)]">
            Manage and browse your series catalog.
          </p>
        </div>
        <ChunkyButton
          type="button"
          variant="primary"
          onClick={openDialog}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add series
        </ChunkyButton>
      </div>

      {/* Chunky Filter Tabs: All, Featured, Ongoing */}
      <ChunkyTabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="w-full sm:w-auto"
      >
        <ChunkyTabsList className="grid grid-cols-3 sm:inline-flex w-full sm:w-auto">
          <ChunkyTabsTrigger value="all">All</ChunkyTabsTrigger>
          <ChunkyTabsTrigger value="featured">Featured</ChunkyTabsTrigger>
          <ChunkyTabsTrigger value="ongoing">Ongoing</ChunkyTabsTrigger>
        </ChunkyTabsList>
      </ChunkyTabs>

      {/* Big Genre quick-filter chips + Highlighted Only toggle (ongoing tab) */}
      {activeTab === 'ongoing' && (
        <div className="bg-[var(--surface)] border-2 border-[var(--border)] rounded-[16px] p-3 space-y-2.5">
          {bigGenres.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap" aria-label="Filter by big genre">
              {bigGenres.map((genre) => {
                const isActive = selectedSlugs.includes(genre.slug);
                const highlightedCount =
                  highlightedCountByGenreSlug.get(genre.slug) ?? 0;
                return (
                  <ChunkyChip
                    key={genre.id}
                    type="button"
                    variant={isActive ? 'active' : 'default'}
                    pressed={isActive}
                    onClick={() => handleToggleGenre(genre.slug)}
                  >
                    <span>{genre.name}</span>
                    <ChunkyTooltip
                      content={`${highlightedCount} highlighted in ${genre.name}`}
                    >
                      <span
                        aria-label={`${highlightedCount} highlighted in ${genre.name}`}
                        className={`inline-flex items-center justify-center min-w-5 h-4 px-1 rounded text-[10px] font-semibold ${
                          isActive
                            ? 'bg-[var(--green-dark)]/20 text-[var(--green)]'
                            : 'bg-[var(--green)]/10 text-[var(--green)]'
                        }`}
                      >
                        {highlightedCount}
                      </span>
                    </ChunkyTooltip>
                  </ChunkyChip>
                );
              })}
            </div>
          )}
          <div className="flex items-center gap-2">
            <ChunkyChip
              type="button"
              variant={highlightedOnly ? 'gold' : 'default'}
              pressed={highlightedOnly}
              role="switch"
              aria-checked={highlightedOnly}
              aria-label="Highlighted Only"
              onClick={handleToggleHighlightedOnly}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill={highlightedOnly ? 'currentColor' : 'none'}
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              <span>★ Highlighted Only</span>
            </ChunkyChip>
          </div>
        </div>
      )}

      {/* Toolbar: debounced search, genre filter, result count */}
      <div className="bg-[var(--surface)] border-2 border-[var(--border)] rounded-[16px] p-3">
        <div className="flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Filter series..."
              aria-label="Search series"
              className="w-[300px] shrink-0 h-11 px-3.5 rounded-[14px] border-2 border-[var(--border)] bg-[var(--bg)] font-bold text-[14px] text-[var(--ink)] placeholder:text-[var(--muted)] outline-none focus:border-[var(--blue)]"
            />
            <GenreFilter
              selectedSlugs={selectedSlugs}
              onSelectionChange={handleGenreSelectionChange}
            />
          </div>
          <span className="ml-auto font-extrabold text-[14px] text-[var(--muted)]" aria-live="polite">
            {meta.total} series
          </span>
        </div>
      </div>

      {/* Grid view */}
      <div ref={gridTopRef} className="scroll-mt-20">
      {seriesList.length === 0 ? (
        <div className="bg-card border border-c rounded p-8 text-center text-xs text-muted mono">
          No series match your filter.
        </div>
      ) : (
        <div
          data-testid="series-grid"
          className="grid gap-4"
          style={{
            gridTemplateColumns:
              'repeat(auto-fill, minmax(max(210px, calc((100% - 60px) / 4)), 1fr))',
          }}
        >
          {seriesList.map((item: SeriesItem & { episodes?: unknown[]; episodeCount?: number }) => (
            <SeriesCard
              key={item.id}
              item={item}
              onToggleFeatured={handleToggleFeatured}
              onEdit={handleOpenEdit}
              onDelete={handleOpenDelete}
              onToggleHighlight={handleToggleHighlight}
            />
          ))}
        </div>
      )}
      </div>

      {/* Pagination Bar */}
      {meta.total > 0 && (
        <nav
          aria-label="Pagination"
          className="mt-7 flex items-center justify-center gap-4"
        >
          <ChunkyChip
            type="button"
            variant="default"
            disabled={isFirstPage}
            onClick={() => goToPage(currentPage - 1)}
            aria-label="Previous page"
            className="disabled:cursor-not-allowed disabled:opacity-40 disabled:active:translate-y-0 disabled:active:border-b-4"
          >
            <ChevronLeft aria-hidden="true" />
            Previous
          </ChunkyChip>
          <span
            aria-live="polite"
            className="font-extrabold text-[14px] text-[var(--muted)] min-w-[120px] text-center"
          >
            Page {Math.min(currentPage, totalPages)} of {totalPages}
          </span>
          <ChunkyChip
            type="button"
            variant="default"
            disabled={isLastPage}
            onClick={() => goToPage(currentPage + 1)}
            aria-label="Next page"
            className="disabled:cursor-not-allowed disabled:opacity-40 disabled:active:translate-y-0 disabled:active:border-b-4"
          >
            Next
            <ChevronRight aria-hidden="true" />
          </ChunkyChip>
        </nav>
      )}

      {/* Edit Series Dialog */}
      {editingSeries && (
        <EditSeriesDialog
          open={!!editingSeries}
          onOpenChange={(open) => !open && setEditingSeries(null)}
          series={editingSeries}
          seriesList={seriesList}
        />
      )}

      {/* Delete Series Confirmation Dialog */}
      <ChunkyConfirmDialog
        open={!!deletingSeries}
        onOpenChange={(open) => !open && setDeletingSeries(null)}
        title="Delete Series"
        description={
          deletingSeries?.title
            ? `Are you sure you want to delete "${deletingSeries.title}"? This action cannot be undone.`
            : 'Are you sure you want to delete this series? This action cannot be undone.'
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        confirmVariant="danger"
        isPending={deleteMutation.isPending}
        onConfirm={() => {
          if (deletingSeries) {
            deleteMutation.mutate(deletingSeries.id);
          }
        }}
      />

      <AddMediaDialog />
    </div>
  );
}
