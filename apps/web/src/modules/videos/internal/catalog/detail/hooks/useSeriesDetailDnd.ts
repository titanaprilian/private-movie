import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { DropResult } from '@hello-pangea/dnd';
import {
  updateEpisodeOrders,
  type SeriesDetails,
} from '../../../api';
import { buildCrossSeasonMove, buildBulkCrossSeasonMove } from '../../../seasons/crossSeasonMove';
import type { SeriesDetailEpisode, UseSeriesDetailDndOptions } from '../../types';
export type { SeriesDetailEpisode, UseSeriesDetailDndOptions } from '../../types';

const SEASON_TAB_PREFIX = 'season-tab-';

export function useSeriesDetailDnd({
  seriesId,
  serverEpisodes,
  seasons,
  activeSeason,
  selectedEpisodeIds,
  onCloseMoveDialog,
  onBulkMoveSuccess,
}: UseSeriesDetailDndOptions) {
  const queryClient = useQueryClient();

  const [localEpisodes, setLocalEpisodes] = useState<SeriesDetailEpisode[]>([]);

  useEffect(() => {
    if (serverEpisodes) {
      setLocalEpisodes(serverEpisodes);
    }
  }, [serverEpisodes]);

  const reorderMutation = useMutation({
    mutationFn: (orders: { id: string; order: number }[]) =>
      updateEpisodeOrders(seriesId, orders),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['series', seriesId] });
    },
  });

  const seasonEpisodes = ((): SeriesDetailEpisode[] => {
    if (!seasons || seasons.length === 0 || !activeSeason) {
      return localEpisodes;
    }
    if (seasons.length === 1) {
      return localEpisodes;
    }
    const activeSeasonEpIds = new Set(
      activeSeason.episodes?.map((e) => e.id) ?? []
    );
    return localEpisodes.filter(
      (ep) => ep.seasonId === activeSeason.id || activeSeasonEpIds.has(ep.id)
    );
  })();

  const handleCrossSeasonDrop = (episodeId: string, targetSeasonId: string) => {
    const move = buildCrossSeasonMove(localEpisodes, episodeId, targetSeasonId);
    if (!move) return;

    const previousEpisodes = [...localEpisodes];
    setLocalEpisodes(move.episodes);
    queryClient.setQueryData(
      ['series', seriesId],
      (old: SeriesDetails | undefined) =>
        old ? { ...old, episodes: move.episodes } : old
    );

    reorderMutation.mutate(move.orders, {
      onError: (error) => {
        setLocalEpisodes(previousEpisodes);
        queryClient.setQueryData(
          ['series', seriesId],
          (old: SeriesDetails | undefined) =>
            old ? { ...old, episodes: previousEpisodes } : old
        );
        toast.error('video.reorder', {
          description: `Failed to move episode: ${error.message}`,
        });
      },
    });
  };

  const handleDragEnd = (result: DropResult) => {
    const { destination, source } = result;

    if (!destination) {
      return;
    }

    if (destination.droppableId.startsWith(SEASON_TAB_PREFIX)) {
      handleCrossSeasonDrop(
        result.draggableId,
        destination.droppableId.slice(SEASON_TAB_PREFIX.length)
      );
      return;
    }

    if (destination.index === source.index) {
      return;
    }

    const previousEpisodes = [...localEpisodes];
    const nextSeasonEpisodes = Array.from(seasonEpisodes);
    const [moved] = nextSeasonEpisodes.splice(source.index, 1);
    nextSeasonEpisodes.splice(destination.index, 0, moved);

    const updatedSeasonEpMap = new Map(
      nextSeasonEpisodes.map((ep, idx) => [ep.id, { ...ep, order: idx + 1 }])
    );
    const nextLocalEpisodes = localEpisodes.map(
      (ep) => updatedSeasonEpMap.get(ep.id) ?? ep
    );

    setLocalEpisodes(nextLocalEpisodes);

    queryClient.setQueryData(
      ['series', seriesId],
      (old: SeriesDetails | undefined) =>
        old ? { ...old, episodes: nextLocalEpisodes } : old
    );

    const newOrders = nextSeasonEpisodes.map((ep, index) => ({
      id: ep.id,
      order: index + 1,
    }));

    reorderMutation.mutate(newOrders, {
      onError: (error) => {
        setLocalEpisodes(previousEpisodes);
        queryClient.setQueryData(
          ['series', seriesId],
          (old: SeriesDetails | undefined) =>
            old ? { ...old, episodes: previousEpisodes } : old
        );
        toast.error('video.reorder', {
          description: `Failed to reorder episodes: ${error.message}`,
        });
      },
    });
  };

  const handleBulkMoveEpisodes = (targetSeasonId: string) => {
    const move = buildBulkCrossSeasonMove(
      localEpisodes,
      selectedEpisodeIds,
      targetSeasonId
    );
    if (!move) {
      onCloseMoveDialog();
      return;
    }

    const previousEpisodes = [...localEpisodes];
    setLocalEpisodes(move.episodes);
    queryClient.setQueryData(
      ['series', seriesId],
      (old: SeriesDetails | undefined) =>
        old ? { ...old, episodes: move.episodes } : old
    );

    reorderMutation.mutate(move.orders, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['series', seriesId] });
        onBulkMoveSuccess();
        toast.success(`Moved ${move.orders.filter((o) => o.seasonId).length} episodes`);
      },
      onError: (error) => {
        setLocalEpisodes(previousEpisodes);
        queryClient.setQueryData(
          ['series', seriesId],
          (old: SeriesDetails | undefined) =>
            old ? { ...old, episodes: previousEpisodes } : old
        );
        toast.error('video.reorder', {
          description: `Failed to move episodes: ${error.message}`,
        });
      },
    });
  };

  const episodeCountBySeason = ((): Record<string, number> => {
    const counts: Record<string, number> = {};
    for (const ep of localEpisodes) {
      if (ep.seasonId == null) continue;
      const key: string = ep.seasonId;
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  })();

  return {
    localEpisodes,
    seasonEpisodes,
    episodeCountBySeason,
    reorderMutation,
    handleCrossSeasonDrop,
    handleDragEnd,
    handleBulkMoveEpisodes,
  };
}
