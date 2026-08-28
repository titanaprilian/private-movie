import { useState, useEffect, useMemo, useCallback } from 'react';
import type {
  WatchSeriesDetails,
  WatchSeason,
  WatchEpisode,
  WatchVideoSource,
} from './api';

export interface UseWatchStateOptions {
  initialSeasonId?: string;
  initialEpisodeId?: string;
  initialSourceIndex?: number;
}

export interface UseWatchStateReturn {
  activeSeasonId: string | null;
  activeEpisodeId: string | null;
  activeSourceIndex: number;
  activeSeason: WatchSeason | null;
  activeEpisode: WatchEpisode | null;
  activeSource: WatchVideoSource | null;
  availableEpisodes: WatchEpisode[];
  hasNextEpisode: boolean;
  hasPrevEpisode: boolean;
  setActiveSeasonId: (seasonId: string) => void;
  setActiveEpisodeId: (episodeId: string) => void;
  setActiveSourceIndex: (index: number) => void;
  selectSeason: (seasonId: string) => void;
  selectEpisode: (episodeId: string) => void;
  selectSource: (index: number) => void;
  goToNextEpisode: () => void;
  goToPrevEpisode: () => void;
}

export function useWatchState(
  series?: WatchSeriesDetails | null,
  options?: UseWatchStateOptions
): UseWatchStateReturn {
  const [activeSeasonId, setActiveSeasonIdState] = useState<string | null>(null);
  const [activeEpisodeId, setActiveEpisodeIdState] = useState<string | null>(null);
  const [activeSourceIndex, setActiveSourceIndexState] = useState<number>(0);

  // Helper to find all episodes across seasons or root episodes list
  const allEpisodes = useMemo(() => {
    if (!series) return [];
    if (series.episodes && series.episodes.length > 0) {
      return series.episodes;
    }
    if (series.seasons) {
      return series.seasons.flatMap((s) => s.episodes ?? []);
    }
    return [];
  }, [series]);

  // Synchronize state defaults when series or initial state options change
  useEffect(() => {
    if (!series) {
      setActiveSeasonIdState(null);
      setActiveEpisodeIdState(null);
      setActiveSourceIndexState(0);
      return;
    }

    const initialEpId = options?.initialEpisodeId;
    const initialSourceIdx = options?.initialSourceIndex ?? 0;

    // Check if current activeEpisodeId is valid for this series
    const isCurrentEpValid =
      activeEpisodeId && allEpisodes.some((ep) => ep.id === activeEpisodeId);

    if (isCurrentEpValid) {
      return;
    }

    // 1. Initial episode override
    if (initialEpId && allEpisodes.some((ep) => ep.id === initialEpId)) {
      const targetSeason = series.seasons?.find((s) =>
        s.episodes?.some((ep) => ep.id === initialEpId)
      );
      setActiveSeasonIdState(targetSeason?.id ?? null);
      setActiveEpisodeIdState(initialEpId);
      setActiveSourceIndexState(initialSourceIdx);
      return;
    }

    // 2. Default to first season with episodes
    if (series.seasons && series.seasons.length > 0) {
      const firstSeasonWithEp =
        series.seasons.find((s) => s.episodes && s.episodes.length > 0) ??
        series.seasons[0];
      setActiveSeasonIdState(firstSeasonWithEp.id);
      setActiveEpisodeIdState(firstSeasonWithEp.episodes?.[0]?.id ?? null);
      setActiveSourceIndexState(initialSourceIdx);
      return;
    }

    // 3. Default to root episodes if no seasons
    if (series.episodes && series.episodes.length > 0) {
      setActiveSeasonIdState(null);
      setActiveEpisodeIdState(series.episodes[0].id);
      setActiveSourceIndexState(initialSourceIdx);
      return;
    }

    setActiveSeasonIdState(null);
    setActiveEpisodeIdState(null);
    setActiveSourceIndexState(0);
  }, [series, options?.initialEpisodeId, options?.initialSourceIndex, allEpisodes, activeEpisodeId]);

  const activeSeason = useMemo(() => {
    if (!series?.seasons || !activeSeasonId) return null;
    return series.seasons.find((s) => s.id === activeSeasonId) ?? null;
  }, [series?.seasons, activeSeasonId]);

  const availableEpisodes = useMemo(() => {
    if (activeSeason) {
      return activeSeason.episodes ?? [];
    }
    if (series?.seasons && series.seasons.length > 0) {
      return [];
    }
    return series?.episodes ?? [];
  }, [activeSeason, series]);

  const activeEpisode = useMemo(() => {
    if (!activeEpisodeId) return null;
    return allEpisodes.find((ep) => ep.id === activeEpisodeId) ?? null;
  }, [allEpisodes, activeEpisodeId]);

  const activeSource = useMemo(() => {
    if (!activeEpisode || !activeEpisode.videoSources) return null;
    return activeEpisode.videoSources[activeSourceIndex] ?? null;
  }, [activeEpisode, activeSourceIndex]);

  const selectSeason = useCallback(
    (seasonId: string) => {
      setActiveSeasonIdState(seasonId);
      const targetSeason = series?.seasons?.find((s) => s.id === seasonId);
      const firstEpId = targetSeason?.episodes?.[0]?.id ?? null;
      setActiveEpisodeIdState(firstEpId);
      setActiveSourceIndexState(0);
    },
    [series?.seasons]
  );

  const selectEpisode = useCallback(
    (episodeId: string) => {
      setActiveEpisodeIdState(episodeId);
      setActiveSourceIndexState(0);

      if (series?.seasons) {
        const targetSeason = series.seasons.find((s) =>
          s.episodes?.some((ep) => ep.id === episodeId)
        );
        if (targetSeason) {
          setActiveSeasonIdState(targetSeason.id);
        }
      }
    },
    [series?.seasons]
  );

  const selectSource = useCallback((index: number) => {
    setActiveSourceIndexState(index);
  }, []);

  const currentIndex = useMemo(() => {
    if (!activeEpisodeId) return -1;
    return availableEpisodes.findIndex((e) => e.id === activeEpisodeId);
  }, [availableEpisodes, activeEpisodeId]);

  const hasNextEpisode = currentIndex >= 0 && currentIndex < availableEpisodes.length - 1;
  const hasPrevEpisode = currentIndex > 0;

  const goToNextEpisode = useCallback(() => {
    if (hasNextEpisode && currentIndex >= 0) {
      const nextEp = availableEpisodes[currentIndex + 1];
      if (nextEp) {
        selectEpisode(nextEp.id);
      }
    }
  }, [hasNextEpisode, currentIndex, availableEpisodes, selectEpisode]);

  const goToPrevEpisode = useCallback(() => {
    if (hasPrevEpisode && currentIndex > 0) {
      const prevEp = availableEpisodes[currentIndex - 1];
      if (prevEp) {
        selectEpisode(prevEp.id);
      }
    }
  }, [hasPrevEpisode, currentIndex, availableEpisodes, selectEpisode]);

  return {
    activeSeasonId,
    activeEpisodeId,
    activeSourceIndex,
    activeSeason,
    activeEpisode,
    activeSource,
    availableEpisodes,
    hasNextEpisode,
    hasPrevEpisode,
    setActiveSeasonId: selectSeason,
    setActiveEpisodeId: selectEpisode,
    setActiveSourceIndex: selectSource,
    selectSeason,
    selectEpisode,
    selectSource,
    goToNextEpisode,
    goToPrevEpisode,
  };
}
