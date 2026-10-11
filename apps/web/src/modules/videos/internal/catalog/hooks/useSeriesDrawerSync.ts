import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import type { SeriesDetailEpisode } from './useSeriesDetail';

export interface UseSeriesDrawerSyncOptions {
  localEpisodes: SeriesDetailEpisode[];
  initialEpisodeId?: string;
  initialOrder?: number;
}

export function useSeriesDrawerSync({
  localEpisodes,
  initialEpisodeId,
  initialOrder,
}: UseSeriesDrawerSyncOptions) {
  const navigate = useNavigate();
  const searchParams = useSearch({ strict: false }) as Record<string, unknown>;

  const [selectedEpisodeId, setSelectedEpisodeId] = useState<string | null>(
    initialEpisodeId ?? null
  );
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Sync drawer state with URL search params or initial props
  useEffect(() => {
    const epIdFromSearch =
      (searchParams?.episodeId as string | undefined) ?? initialEpisodeId;
    const orderFromSearch =
      typeof searchParams?.order === 'number'
        ? (searchParams.order as number)
        : initialOrder !== undefined
          ? initialOrder
          : undefined;

    if (epIdFromSearch && localEpisodes.some((e) => e.id === epIdFromSearch)) {
      setSelectedEpisodeId(epIdFromSearch);
      setIsDrawerOpen(true);
    } else if (orderFromSearch !== undefined && localEpisodes.length > 0) {
      const match = localEpisodes.find((e) => e.order === orderFromSearch);
      if (match) {
        setSelectedEpisodeId(match.id);
        setIsDrawerOpen(true);
      }
    }
  }, [
    searchParams?.episodeId,
    searchParams?.order,
    initialEpisodeId,
    initialOrder,
    localEpisodes,
  ]);

  const updateDrawerUrl = useCallback(
    (episode: SeriesDetailEpisode | null) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (navigate as any)({
          search: (prev: Record<string, unknown>) => {
            const next = { ...prev };
            if (episode) {
              next.episodeId = episode.id;
              if (episode.order !== null && episode.order !== undefined) {
                next.order = episode.order;
              } else {
                delete next.order;
              }
            } else {
              delete next.episodeId;
              delete next.order;
            }
            return next;
          },
          replace: true,
        });
      } catch {
        // Fallback for tests or contexts where router navigate is mocked without search function
      }
    },
    [navigate]
  );

  const handleOpenEpisodeDrawer = (episode: SeriesDetailEpisode) => {
    setSelectedEpisodeId(episode.id);
    setIsDrawerOpen(true);
    updateDrawerUrl(episode);
  };

  const handleCloseEpisodeDrawer = (open: boolean) => {
    setIsDrawerOpen(open);
    if (!open) {
      updateDrawerUrl(null);
    }
  };

  return {
    selectedEpisodeId,
    setSelectedEpisodeId,
    isDrawerOpen,
    handleOpenEpisodeDrawer,
    handleCloseEpisodeDrawer,
  };
}
