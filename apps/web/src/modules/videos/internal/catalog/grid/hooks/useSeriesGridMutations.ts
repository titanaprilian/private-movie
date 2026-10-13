import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import {
  updateSeries,
  deleteSeries,
  type SeriesItem,
} from '../../../api';
import type {
  SeriesListQueryData,
  UseSeriesGridMutationsOptions,
  UseSeriesGridMutationsResult,
} from '../../types';

/**
 * Manages series deletion (with pagination rollback when the last item on
 * page > 1 is deleted) and optimistic cache mutations for `isFeatured` and
 * `isOngoingHighlighted`.
 */
export function useSeriesGridMutations({
  seriesList,
  currentPage,
  activeTab,
  setDeletingSeries,
}: UseSeriesGridMutationsOptions): UseSeriesGridMutationsResult {
  const navigate = useNavigate({ from: '/admin/videos/' });
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSeries(id),
    onSuccess: (_deleted, id) => {
      queryClient.invalidateQueries({ queryKey: ['series'] });
      toast.success('series.delete', {
        description: 'Successfully deleted series',
      });
      // If the deleted card was the sole item on page > 1, step back.
      const wasLastOnPage =
        seriesList.length === 1 && seriesList.some((item) => item.id === id);
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
              item.id === id ? { ...item, isFeatured: featured } : item,
            ),
          };
        },
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
                : item,
            ),
          };
        },
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

  const handleToggleHighlight = (item: SeriesItem, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    highlightMutation.mutate({
      id: item.id,
      highlighted: !item.isOngoingHighlighted,
    });
  };

  return {
    deleteMutation,
    featuredMutation,
    highlightMutation,
    handleToggleFeatured,
    handleToggleHighlight,
  };
}
