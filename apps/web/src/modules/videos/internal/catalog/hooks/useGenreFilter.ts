import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { genresQueryOptions } from '@/modules/genres';

import type { UseGenreFilterOptions, UseGenreFilterReturn } from '../types';
export type { UseGenreFilterOptions, UseGenreFilterReturn } from '../types';

/**
 * Sentinel command value that matches no genre row. cmdk auto-highlights the
 * first row whenever its internal value is falsy (on mount and on list
 * changes), so holding a truthy non-matching value keeps the panel free of
 * pre-highlight until the user hovers or uses arrow keys intentionally.
 */
export const GENRE_FILTER_NO_HIGHLIGHT = '__genre-filter-no-highlight__';

export function formatGenreTriggerLabel(
  selectedSlugs: string[],
  namesBySlug: Map<string, string>,
): string {
  if (selectedSlugs.length === 0) return 'Filter by genre';
  if (selectedSlugs.length === 1) {
    return namesBySlug.get(selectedSlugs[0]) ?? selectedSlugs[0];
  }
  return `${selectedSlugs.length} genres`;
}

export function useGenreFilter({
  selectedSlugs,
  onSelectionChange,
}: UseGenreFilterOptions): UseGenreFilterReturn {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlight, setHighlight] = useState<string>(GENRE_FILTER_NO_HIGHLIGHT);
  // While true, highlight updates coming from cmdk are side effects of the
  // search filter changing (unmount-driven auto-select), not user intent.
  const searchChangedRef = useRef(false);

  const { data: genres = [], isLoading, isError, refetch } = useQuery(genresQueryOptions());

  // Reset the suppression flag after commit: cmdk's filter-driven auto-select
  // runs in layout effects, so passive effects observe it as still suppressed.
  useEffect(() => {
    searchChangedRef.current = false;
  });

  const namesBySlug = new Map(genres.map((g) => [g.slug, g.name]));
  const normalizedSearch = search.trim().toLowerCase();
  const visibleGenres =
    normalizedSearch.length === 0
      ? genres
      : genres.filter(
          (g) =>
            g.name.toLowerCase().includes(normalizedSearch) ||
            g.slug.toLowerCase().includes(normalizedSearch),
        );

  const toggleGenre = (slug: string) => {
    if (selectedSlugs.includes(slug)) {
      onSelectionChange(selectedSlugs.filter((s) => s !== slug));
    } else {
      onSelectionChange([...selectedSlugs, slug]);
    }
  };

  const handleSearchChange = (value: string) => {
    searchChangedRef.current = true;
    setSearch(value);
    // Clear any existing highlight when the result set changes.
    setHighlight(GENRE_FILTER_NO_HIGHLIGHT);
  };

  const handleHighlightChange = (value: string) => {
    if (searchChangedRef.current) return;
    setHighlight(value || GENRE_FILTER_NO_HIGHLIGHT);
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setSearch('');
      setHighlight(GENRE_FILTER_NO_HIGHLIGHT);
    }
  };

  const handleClear = () => {
    onSelectionChange([]);
  };

  const handleDone = () => {
    setOpen(false);
  };

  const isActive = selectedSlugs.length > 0;

  return {
    open,
    search,
    highlight,
    genres,
    isLoading,
    isError,
    namesBySlug,
    visibleGenres,
    isActive,
    triggerLabel: formatGenreTriggerLabel(selectedSlugs, namesBySlug),
    refetch: () => {
      void refetch();
    },
    toggleGenre,
    handleSearchChange,
    handleHighlightChange,
    handleOpenChange,
    handleClear,
    handleDone,
  };
}
