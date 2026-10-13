import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { SERIES_PAGE_LIMIT } from '../../../api';
import type {
  SeriesGridQueryParams,
  SeriesGridTab,
  SeriesSearch,
  UseSeriesGridSearchResult,
} from '../../types';

export const SERIES_GRID_SEARCH_DEBOUNCE_MS = 250;

function toCurrentPage(search: SeriesSearch): number {
  return Number.isInteger(search.page) && (search.page as number) > 0
    ? (search.page as number)
    : 1;
}

export function buildSeriesGridQueryParams(
  search: SeriesSearch,
  currentPage: number,
): SeriesGridQueryParams {
  return {
    page: currentPage,
    q: search.q,
    genre: search.genre,
    tab: search.tab,
    highlighted: search.highlighted,
    limit: SERIES_PAGE_LIMIT,
  };
}

function toSelectedSlugs(search: SeriesSearch): string[] {
  return search.genre
    ? search.genre
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
}

/**
 * Manages TanStack Router search params, debounced text search, tab changes,
 * genre selection, page clamping, and pagination navigation for SeriesGrid.
 */
export function useSeriesGridSearch(): UseSeriesGridSearchResult {
  const search = useSearch({ from: '/admin/videos/' }) as SeriesSearch;
  const navigate = useNavigate({ from: '/admin/videos/' });

  const currentPage = toCurrentPage(search);
  const activeTab: SeriesGridTab =
    search.tab === 'featured' || search.tab === 'ongoing' ? search.tab : 'all';
  const highlightedOnly = search.highlighted === true;
  const selectedSlugs = toSelectedSlugs(search);
  const queryParams = buildSeriesGridQueryParams(search, currentPage);

  const searchQ = search.q ?? '';
  const [inputValue, setInputValue] = useState(searchQ);
  const lastSyncedQRef = useRef(searchQ);

  const [pageBounds, setPageBounds] = useState({ total: 0, limit: SERIES_PAGE_LIMIT });
  const syncPageBounds = (total: number, limit: number) => {
    setPageBounds((prev) =>
      prev.total === total && prev.limit === limit ? prev : { total, limit },
    );
  };

  const limit = pageBounds.limit || SERIES_PAGE_LIMIT;
  const totalPages = Math.max(1, Math.ceil(pageBounds.total / limit));

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
    }, SERIES_GRID_SEARCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(handler);
    };
  }, [inputValue, navigate]);

  // Clamp out-of-bounds page params to valid ranges.
  useEffect(() => {
    if (pageBounds.total > 0 && currentPage > totalPages) {
      navigate({
        search: (old: Record<string, unknown>) => ({
          ...old,
          page: totalPages,
        }),
        replace: true,
      });
    }
  }, [currentPage, totalPages, pageBounds.total, navigate]);

  const gridTopRef = useRef<HTMLDivElement>(null);

  const goToPage = (page: number) => {
    navigate({
      search: (old: Record<string, unknown>) => ({ ...old, page }),
    });
    gridTopRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  };

  return {
    currentPage,
    activeTab,
    highlightedOnly,
    selectedSlugs,
    inputValue,
    setInputValue,
    queryParams,
    totalPages,
    syncPageBounds,
    handleToggleHighlightedOnly,
    handleTabChange,
    handleGenreSelectionChange,
    handleToggleGenre,
    gridTopRef,
    goToPage,
  };
}
