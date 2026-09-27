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

/**
 * Resolve the default source index for an episode.
 * Prefers the first self-hosted (`s3`) source, then the first external
 * direct stream, and falls back to index 0 (backend returns sources in
 * canonical priority order, so index 0 is the top-priority source).
 */
export function resolveDefaultSourceIndex(
  sources?: WatchVideoSource[] | null
): number {
  if (!sources || sources.length === 0) return 0;
  const s3Index = sources.findIndex((s) => s.type === 's3');
  if (s3Index >= 0) return s3Index;
  const directIndex = sources.findIndex((s) => s.type === 'direct');
  if (directIndex >= 0) return directIndex;
  return 0;
}

export function useWatchState(
  series?: WatchSeriesDetails | null,
  options?: UseWatchStateOptions
): UseWatchStateReturn {
  const [activeSeasonId, setActiveSeasonIdState] = useState<string | null>(null);
  const [activeEpisodeId, setActiveEpisodeIdState] = useState<string | null>(
    options?.initialEpisodeId ?? null
  );
  const [activeSourceIndex, setActiveSourceIndexState] = useState<number>(
    options?.initialSourceIndex ?? 0
  );

  // Helper to filter episodes that have playable video sources
  const isPlayableEpisode = (ep: WatchEpisode) =>
    Boolean(ep.videoSources && ep.videoSources.length > 0);

  // Helper to find all playable episodes across seasons or root episodes list
  const allEpisodes = useMemo(() => {
    if (!series) return [];
    if (series.episodes && series.episodes.length > 0) {
      return series.episodes.filter(isPlayableEpisode);
    }
    if (series.seasons) {
      return series.seasons.flatMap((s) => (s.episodes ?? []).filter(isPlayableEpisode));
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
    const hasExplicitSourceIndex = options?.initialSourceIndex !== undefined;

    // Check if initialEpisodeId exists and matches a playable episode
    if (initialEpId && allEpisodes.some((ep) => ep.id === initialEpId)) {
      const targetSeason = series.seasons?.find((s) =>
        (s.episodes ?? []).some((ep) => ep.id === initialEpId && isPlayableEpisode(ep))
      );
      setActiveSeasonIdState(targetSeason?.id ?? null);
      setActiveEpisodeIdState(initialEpId);
      if (hasExplicitSourceIndex) {
        setActiveSourceIndexState(options.initialSourceIndex as number);
      } else {
        const targetEp = allEpisodes.find((ep) => ep.id === initialEpId);
        setActiveSourceIndexState(resolveDefaultSourceIndex(targetEp?.videoSources));
      }
      return;
    }

    // Default to first season
    if (series.seasons && series.seasons.length > 0) {
      const firstSeasonWithPlayableEp =
        series.seasons.find((s) => (s.episodes ?? []).some(isPlayableEpisode)) ??
        series.seasons[0];
      setActiveSeasonIdState(firstSeasonWithPlayableEp.id);
      const firstPlayableEp = (firstSeasonWithPlayableEp.episodes ?? []).find(isPlayableEpisode);
      setActiveEpisodeIdState(firstPlayableEp?.id ?? null);
      setActiveSourceIndexState(
        hasExplicitSourceIndex
          ? (options.initialSourceIndex as number)
          : resolveDefaultSourceIndex(firstPlayableEp?.videoSources)
      );
      return;
    }

    // Default to root episodes if no seasons
    if (series.episodes && series.episodes.length > 0) {
      const firstPlayableEp = series.episodes.find(isPlayableEpisode);
      setActiveSeasonIdState(null);
      setActiveEpisodeIdState(firstPlayableEp?.id ?? null);
      setActiveSourceIndexState(
        hasExplicitSourceIndex
          ? (options.initialSourceIndex as number)
          : resolveDefaultSourceIndex(firstPlayableEp?.videoSources)
      );
      return;
    }

    setActiveSeasonIdState(null);
    setActiveEpisodeIdState(null);
    setActiveSourceIndexState(0);
  }, [series, options?.initialEpisodeId, options?.initialSourceIndex, allEpisodes]);

  const activeSeason = useMemo(() => {
    if (!series?.seasons || !activeSeasonId) return null;
    return series.seasons.find((s) => s.id === activeSeasonId) ?? null;
  }, [series?.seasons, activeSeasonId]);

  const availableEpisodes = useMemo(() => {
    if (activeSeason) {
      return (activeSeason.episodes ?? []).filter(isPlayableEpisode);
    }
    if (series?.seasons && series.seasons.length > 0) {
      return [];
    }
    return (series?.episodes ?? []).filter(isPlayableEpisode);
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
      const firstEp = (targetSeason?.episodes ?? []).find(isPlayableEpisode) ?? null;
      setActiveEpisodeIdState(firstEp?.id ?? null);
      setActiveSourceIndexState(resolveDefaultSourceIndex(firstEp?.videoSources));
    },
    [series?.seasons]
  );

  const selectEpisode = useCallback(
    (episodeId: string) => {
      // Reset to the top-priority source of the newly activated episode.
      const targetEp =
        series?.seasons
          ?.flatMap((s) => s.episodes ?? [])
          .find((ep) => ep.id === episodeId) ??
        series?.episodes?.find((ep) => ep.id === episodeId) ??
        null;
      setActiveEpisodeIdState(episodeId);
      setActiveSourceIndexState(resolveDefaultSourceIndex(targetEp?.videoSources));

      if (series?.seasons) {
        const targetSeason = series.seasons.find((s) =>
          (s.episodes ?? []).some((ep) => ep.id === episodeId && isPlayableEpisode(ep))
        );
        if (targetSeason) {
          setActiveSeasonIdState(targetSeason.id);
        }
      }
    },
    [series?.seasons, series?.episodes]
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
