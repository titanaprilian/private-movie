import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import { useWatchState } from './useWatchState';
import { useWatchNav } from './useWatchNav';
import { useAdblockDetector } from './useAdblockDetector';
import { useWatchSpatialFocus } from './useWatchSpatialFocus';
import { getSeriesWithEpisodesQueryOptions } from '../api';
import type {
  UseSeriesWatchViewOptions,
  UseSeriesWatchViewReturn,
  WatchEpisode,
} from '../types';
import { formatEmbedUrl } from '@/lib/media';
import { useInputMode } from '@/hooks/useInputMode';
import { formatDuration, navigateBackToCatalog } from '../utils';

/**
 * Coordinator hook for the series watch view. Owns series data fetching,
 * overview/player mode switching, episode selection, toolbar actions,
 * router synchronisation, adblock state, spatial navigation wiring, and
 * DOM focus refs (via useWatchSpatialFocus). SeriesWatchView consumes this
 * hook and declaratively renders the two modes.
 */
export function useSeriesWatchView({
  seriesId,
  series: propSeries,
  initialSeasonId,
  initialEpisodeId,
  initialSourceIndex,
}: UseSeriesWatchViewOptions): UseSeriesWatchViewReturn {
  const navigate = useNavigate();

  // Referrer-safe return to the catalogue: internal visitors (Home,
  // Genres, Search) go back through browser history so scroll position is
  // preserved; direct external entries fall back to the home route instead
  // of being ejected from the app.
  const handleBackToHome = () => {
    navigateBackToCatalog(() => {
      if (navigate) {
        navigate({ to: '/' });
      } else if (typeof window !== 'undefined') {
        window.location.href = '/';
      }
    });
  };

  const {
    data: querySeries,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    ...getSeriesWithEpisodesQueryOptions(seriesId || ''),
    enabled: Boolean(seriesId) && !propSeries,
  });

  const series = propSeries ?? querySeries;

  // Helper to check if an episode is playable
  const isPlayableEpisode = (ep: WatchEpisode) =>
    Boolean(ep.videoSources && ep.videoSources.length > 0);

  // Validate whether initialEpisodeId corresponds to an existing playable episode
  const initialValidEpisodeId = useMemo(() => {
    if (!initialEpisodeId || !series) return null;
    const allPlayableEpisodes = series.seasons
      ? series.seasons.flatMap((s) =>
          (s.episodes ?? []).filter(isPlayableEpisode)
        )
      : (series.episodes ?? []).filter(isPlayableEpisode);
    const match = allPlayableEpisodes.find((ep) => ep.id === initialEpisodeId);
    return match ? match.id : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series, initialEpisodeId]);

  // Track whether we are in overview mode or player mode
  // If initialEpisodeId is provided and valid/playable, we start in player mode
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<string | null>(
    initialValidEpisodeId
  );

  useEffect(() => {
    setSelectedEpisodeId(initialValidEpisodeId);
  }, [initialValidEpisodeId]);

  const state = useWatchState(series, {
    initialSeasonId,
    initialEpisodeId: selectedEpisodeId ?? undefined,
    initialSourceIndex,
  });

  const { isSpatialMode } = useInputMode();
  const { isLoading: isDetectingAdblock, isBlocked: hasAdblock } =
    useAdblockDetector();
  const [isWarningDismissed, setIsWarningDismissed] = useState<boolean>(() => {
    try {
      return (
        typeof localStorage !== 'undefined' &&
        localStorage.getItem('adblock_warning_dismissed') === 'true'
      );
    } catch {
      return false;
    }
  });

  const showAdblockModal =
    !isDetectingAdblock && !hasAdblock && !isWarningDismissed;

  const handleDismissWarning = () => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('adblock_warning_dismissed', 'true');
      }
    } catch {
      // ignore
    }
    setIsWarningDismissed(true);
  };

  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const hasSeries = Boolean(series);

  const availableEpisodesForNav = useMemo(
    () => state.availableEpisodes ?? [],
    [state.availableEpisodes]
  );
  const episodesCount = availableEpisodesForNav.length || 1;
  // Toolbar adapts: Prev, Next, Server selector always; Reload + Open Tab
  // only when an embed source is active (hidden for direct/s3 playback).
  const isEmbedSource = (state.activeSource?.type ?? 'embed') === 'embed';
  // Toolbar: Prev, Next, Server selector (+ Reload, Open in new tab for embeds)
  const controlsCount = isEmbedSource ? 5 : 3;
  const serverControlIndex = isEmbedSource ? 4 : 2;

  const { activeZone, focusIndex, setFocusIndex } = useWatchNav({
    controlsCount: hasSeries ? controlsCount : 2,
    episodesCount: hasSeries ? episodesCount : 1,
    iframeRef,
  });

  const { backRef, playRef, controlsRefs, episodeRefs } = useWatchSpatialFocus({
    hasSeries,
    isSpatialMode,
    activeZone,
    focusIndex,
    setFocusIndex,
    selectedEpisodeId,
    iframeRef,
    controlsCount,
  });

  const {
    activeSeason,
    activeSeasonId,
    activeEpisode,
    activeSource,
    availableEpisodes,
    hasNextEpisode,
    hasPrevEpisode,
    selectSeason,
    selectEpisode,
    selectSource,
    goToNextEpisode,
    goToPrevEpisode,
  } = state;

  const sources = activeEpisode?.videoSources ?? [];
  const seasons = series?.seasons ?? [];

  const backFocused = isSpatialMode && activeZone === 'back';
  const playerFocused = isSpatialMode && activeZone === 'player';

  // Find first playable episode across the entire series to play for Episode 1 CTA
  const firstPlayableEpisode =
    series?.seasons?.flatMap((s) => s.episodes ?? []).find(isPlayableEpisode) ??
    series?.episodes?.find(isPlayableEpisode) ??
    null;

  const handleSelectEpisode = (episodeId: string) => {
    setSelectedEpisodeId(episodeId);
    selectEpisode(episodeId);
    const ep = availableEpisodes.find((e) => e.id === episodeId);
    if (ep) {
      toast.info(`Switched to ${ep.title}`);
    }

    if (navigate && series?.id) {
      navigate({
        to: '/watch/$seriesId',
        params: { seriesId: series.id },
        search: { ep: episodeId },
      });
    }

    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      // ignore
    }
  };

  const handleGoToPrevEpisode = () => {
    goToPrevEpisode();
    const currentIndex = availableEpisodes.findIndex(
      (e) => e.id === activeEpisode?.id
    );
    if (currentIndex > 0) {
      const prevEp = availableEpisodes[currentIndex - 1];
      if (prevEp) {
        setSelectedEpisodeId(prevEp.id);
        if (navigate && series?.id) {
          navigate({
            to: '/watch/$seriesId',
            params: { seriesId: series.id },
            search: { ep: prevEp.id },
          });
        }
      }
    }
  };

  const handleGoToNextEpisode = () => {
    goToNextEpisode();
    const currentIndex = availableEpisodes.findIndex(
      (e) => e.id === activeEpisode?.id
    );
    if (currentIndex >= 0 && currentIndex < availableEpisodes.length - 1) {
      const nextEp = availableEpisodes[currentIndex + 1];
      if (nextEp) {
        setSelectedEpisodeId(nextEp.id);
        if (navigate && series?.id) {
          navigate({
            to: '/watch/$seriesId',
            params: { seriesId: series.id },
            search: { ep: nextEp.id },
          });
        }
      }
    }
  };

  const handlePlayFirstEpisode = () => {
    if (firstPlayableEpisode) {
      handleSelectEpisode(firstPlayableEpisode.id);
    }
  };

  const handleBackToOverview = () => {
    setSelectedEpisodeId(null);
    if (navigate && series?.id) {
      navigate({
        to: '/watch/$seriesId',
        params: { seriesId: series.id },
        search: {},
      });
    }
  };

  const handleReloadIframe = () => {
    if (iframeRef.current && activeSource) {
      iframeRef.current.src = formatEmbedUrl(activeSource.url);
      toast.info('Reloaded video player');
    }
  };

  const handleOpenNewTab = () => {
    if (activeSource?.url) {
      window.open(activeSource.url, '_blank', 'noreferrer noopener');
    }
  };

  const formattedEpisodeDuration = activeEpisode
    ? formatDuration(activeEpisode.duration)
    : null;

  return {
    series,
    isLoading,
    isError,
    error,
    refetch: () => {
      refetch();
    },
    selectedEpisodeId,
    activeSeason,
    activeSeasonId,
    activeEpisode,
    activeSource,
    activeSourceIndex: state.activeSourceIndex,
    availableEpisodes,
    hasNextEpisode,
    hasPrevEpisode,
    selectSeason,
    selectSource,
    isSpatialMode,
    activeZone,
    focusIndex,
    iframeRef,
    backRef,
    playRef,
    controlsRefs,
    episodeRefs,
    showAdblockModal,
    handleDismissWarning,
    sources,
    seasons,
    firstPlayableEpisode,
    isEmbedSource,
    serverControlIndex,
    backFocused,
    playerFocused,
    formattedEpisodeDuration,
    handleBackToHome,
    handleSelectEpisode,
    handleGoToPrevEpisode,
    handleGoToNextEpisode,
    handlePlayFirstEpisode,
    handleBackToOverview,
    handleReloadIframe,
    handleOpenNewTab,
  };
}
