import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  seriesDetailQueryOptions,
  type SeasonDetails,
  updateEpisode,
  deleteEpisode,
  deleteSeason,
  scrapeOngoingSeason,
} from '../../api';

import type { UseSeriesDetailOptions } from '../types';
export type { SeriesDetailEpisode, UseSeriesDetailOptions } from '../types';

export function useSeriesDetail({ seriesId, initialSeasonId }: UseSeriesDetailOptions) {
  const { data: series, isLoading } = useQuery(seriesDetailQueryOptions(seriesId));

  const queryClient = useQueryClient();

  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(
    initialSeasonId ?? null
  );
  const [isEditSeasonOpen, setIsEditSeasonOpen] = useState(false);
  const [isAddSeasonOpen, setIsAddSeasonOpen] = useState(false);
  const [isDeleteSeasonOpen, setIsDeleteSeasonOpen] = useState(false);

  useEffect(() => {
    if (series?.seasons && series.seasons.length > 0) {
      if (!selectedSeasonId || !series.seasons.some((s) => s.id === selectedSeasonId)) {
        setSelectedSeasonId(series.seasons[0].id);
      }
    }
  }, [series?.seasons, selectedSeasonId]);

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateEpisode>[1] }) =>
      updateEpisode(id, data),
    onSuccess: (updatedEpisode) => {
      queryClient.invalidateQueries({ queryKey: ['series', seriesId] });
      toast.success('video.edit', {
        description: `Successfully updated ${updatedEpisode.title}`,
      });
    },
    onError: (error) => {
      toast.error('video.edit', {
        description: `Failed to update: ${error.message}`,
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: deleteEpisode,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['series', seriesId] });
      // variables is { id, seriesId }
      toast.success('video.delete', {
        description: `Successfully deleted episode`,
      });
    },
    onError: (error) => {
      toast.error('video.delete', {
        description: `Failed to delete: ${error.message}`,
      });
    }
  });

  const deleteSeasonMutation = useMutation({
    mutationFn: deleteSeason,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['series', seriesId] });
      toast.success('Season deleted successfully');
      setIsDeleteSeasonOpen(false);
    },
    onError: (error) => {
      const err = error as Error & { code?: string };
      if (err.code === 'SEASON_NOT_EMPTY') {
        toast.error('Cannot delete season', {
          description:
            err.message ||
            'This season still contains episodes. Move or delete them first.',
        });
      } else {
        toast.error('Failed to delete season', {
          description: error.message,
        });
      }
      setIsDeleteSeasonOpen(false);
    },
  });

  const scrapeOngoingMutation = useMutation({
    mutationFn: (seasonId: string) => scrapeOngoingSeason(seasonId),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['series', seriesId] });
      queryClient.invalidateQueries({ queryKey: ['series'] });
      queryClient.invalidateQueries({ queryKey: ['episodes'] });
      if (result.sourcesSaved > 0) {
        toast.success(
          `Auto-scrape completed: ${result.sourcesSaved} source${result.sourcesSaved === 1 ? '' : 's'} saved across ${result.episodesScraped} episode${result.episodesScraped === 1 ? '' : 's'}`
        );
      } else {
        toast.success('Auto-scrape completed: no new sources found');
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to auto-scrape ongoing season');
    },
  });

  const activeSeason: SeasonDetails | null =
    series?.seasons && series.seasons.length > 0
      ? (selectedSeasonId ? series.seasons.find((s) => s.id === selectedSeasonId) : series.seasons[0]) ?? series.seasons[0]
      : null;

  const invalidateDetail = () =>
    queryClient.invalidateQueries({ queryKey: ['series', seriesId] });

  return {
    series,
    isLoading,
    selectedSeasonId,
    setSelectedSeasonId,
    activeSeason,
    updateMutation,
    deleteMutation,
    deleteSeasonMutation,
    scrapeOngoingMutation,
    isEditSeasonOpen,
    setIsEditSeasonOpen,
    isAddSeasonOpen,
    setIsAddSeasonOpen,
    isDeleteSeasonOpen,
    setIsDeleteSeasonOpen,
    invalidateDetail,
  };
}
