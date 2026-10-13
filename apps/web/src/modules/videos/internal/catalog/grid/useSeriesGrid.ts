import { useEffect, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { SERIES_PAGE_LIMIT, seriesListQueryOptions, type SeriesItem } from '../../api';
import { genresQueryOptions } from '@/modules/genres';
import { useScrapeWorkerStore } from '../../store/useScrapeWorkerStore';
import { useSeriesGridSearch } from './useSeriesGridSearch';
import { useSeriesGridMutations } from './useSeriesGridMutations';
import type { SeriesCardItem, UseSeriesGridResult } from '../types';

/**
 * Orchestrates the SeriesGrid sub-hooks, fetches series list and genre
 * aggregation data, and manages local dialog state.
 */
export function useSeriesGrid(): UseSeriesGridResult {
  const search = useSeriesGridSearch();
  const openDialog = useScrapeWorkerStore((state) => state.openDialog);

  const { data } = useQuery({
    ...seriesListQueryOptions(search.queryParams),
    placeholderData: keepPreviousData,
  });

  const { data: genres = [] } = useQuery(genresQueryOptions());

  const bigGenres = genres.filter((genre) => Boolean(genre.isBigGenre));

  const highlightedCountsQuery = useQuery({
    ...seriesListQueryOptions({ filter: 'ongoing', highlighted: true, limit: 100 }),
    enabled: search.activeTab === 'ongoing',
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
          (highlightedCountByGenreSlug.get(slug) ?? 0) + 1,
        );
      }
    }
  }

  const [editingSeries, setEditingSeries] = useState<SeriesItem | null>(null);
  const [deletingSeries, setDeletingSeries] = useState<SeriesItem | null>(null);

  const seriesList = (data?.series ?? []) as SeriesCardItem[];
  const meta = data?.meta ?? {
    total: seriesList.length,
    page: search.currentPage,
    limit: SERIES_PAGE_LIMIT,
  };

  useEffect(() => {
    search.syncPageBounds(meta.total, meta.limit || SERIES_PAGE_LIMIT);
  }, [meta.total, meta.limit]); // eslint-disable-line react-hooks/exhaustive-deps

  const mutations = useSeriesGridMutations({
    seriesList,
    currentPage: search.currentPage,
    activeTab: search.activeTab,
    setDeletingSeries,
  });

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

  return {
    ...search,
    seriesList,
    meta,
    bigGenres,
    highlightedCountByGenreSlug,
    editingSeries,
    setEditingSeries,
    deletingSeries,
    setDeletingSeries,
    openDialog,
    deleteMutation: mutations.deleteMutation,
    handleToggleFeatured: mutations.handleToggleFeatured,
    handleToggleHighlight: mutations.handleToggleHighlight,
    handleOpenEdit,
    handleOpenDelete,
  };
}
