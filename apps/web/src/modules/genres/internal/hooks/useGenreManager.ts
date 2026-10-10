import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  createGenre,
  deleteGenre,
  genresQueryOptions,
  updateGenre,
} from '../api';
import type {
  GenreSortField,
  SortDirection,
  UseGenreManagerReturn,
} from '../types';

export function useGenreManager(): UseGenreManagerReturn {
  const queryClient = useQueryClient();
  const {
    data: genres = [],
    isLoading,
    isError,
    error,
  } = useQuery(genresQueryOptions());

  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<GenreSortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const handleSort = (field: GenreSortField) => {
    if (sortField !== field) {
      setSortField(field);
      setSortDirection('asc');
      return;
    }
    setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  };

  const filteredGenres = useMemo(() => {
    const term = searchTerm.toLowerCase();
    const filtered = genres.filter(
      (g) =>
        g.name.toLowerCase().includes(term) ||
        g.slug.toLowerCase().includes(term)
    );
    if (!sortField) return filtered;
    const direction = sortDirection === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sortField === 'displayOrder') {
        return ((a.displayOrder ?? 0) - (b.displayOrder ?? 0)) * direction;
      }
      if (sortField === 'isBigGenre') {
        return (
          (Number(a.isBigGenre ?? false) - Number(b.isBigGenre ?? false)) *
          direction
        );
      }
      const aValue = a[sortField].toLowerCase();
      const bValue = b[sortField].toLowerCase();
      if (aValue < bValue) return -1 * direction;
      if (aValue > bValue) return 1 * direction;
      return 0;
    });
  }, [genres, searchTerm, sortField, sortDirection]);

  const createMutation = useMutation({
    mutationFn: createGenre,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['genres'] });
      toast.success('Genre created successfully');
    },
    // Submission errors are surfaced by the caller via useGenreDialogs state.
    onError: () => {},
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      name,
      slug,
      isBigGenre,
      displayOrder,
    }: {
      id: string;
      name: string;
      slug: string;
      isBigGenre?: boolean;
      displayOrder?: number;
    }) => updateGenre(id, { name, slug, isBigGenre, displayOrder }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['genres'] });
      toast.success('Genre updated successfully');
    },
    onError: () => {},
  });

  const deleteMutation = useMutation({
    mutationFn: deleteGenre,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['genres'] });
      toast.success('Genre deleted successfully');
    },
    onError: () => {},
  });

  return {
    genres,
    filteredGenres,
    isLoading,
    isError,
    error,
    searchTerm,
    setSearchTerm,
    sortField,
    sortDirection,
    handleSort,
    createMutation,
    updateMutation,
    deleteMutation,
  };
}
