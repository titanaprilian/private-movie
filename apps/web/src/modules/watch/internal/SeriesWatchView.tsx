import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import { useWatchState } from './hooks';
import { getSeriesWithEpisodesQueryOptions } from './api';
import type { SeriesWatchViewProps, WatchEpisode } from './types';
import { formatEmbedUrl } from '@/lib/media';
import { useInputMode } from '@/hooks/useInputMode';
import { useWatchNav } from './hooks';
import { useAdblockDetector } from './hooks';
import { SeriesHeroBanner } from './components';
import { WatchTopNav } from './components';
import { WatchViewSkeleton, WatchViewErrorState } from './components';
import { WatchPlayerFrame } from './components';
import { WatchToolbar } from './components';
import { ActiveEpisodeCard } from './components';
import { AdblockWarningDialog } from './components';
import { navigateBackToCatalog } from './utils';
import { EpisodeExplorer } from './components';
import { formatDuration } from './utils';

export type { SeriesWatchViewProps };
export { WatchViewSkeleton, WatchViewErrorState };

export function SeriesWatchView({
  seriesId,
  series: propSeries,
  initialSeasonId,
  initialEpisodeId,
  initialSourceIndex,
}: SeriesWatchViewProps) {
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
  const backRef = useRef<HTMLAnchorElement | HTMLButtonElement | null>(null);
  const playRef = useRef<HTMLButtonElement | null>(null);
  const controlsRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const episodeRefs = useRef<(HTMLButtonElement | null)[]>([]);

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

  // Clamp spatial focus when utility buttons disappear (e.g. switching to direct).
  useEffect(() => {
    if (focusIndex >= controlsCount) {
      setFocusIndex(controlsCount - 1);
    }
  }, [focusIndex, controlsCount, setFocusIndex]);

  // Programmatic focus + scrollIntoView when activeZone/focusIndex changes (spatial mode only)
  useEffect(() => {
    if (!hasSeries) return;
    if (!isSpatialMode) return;

    let el: HTMLElement | null = null;
    if (activeZone === 'back') {
      el = backRef.current;
    } else if (activeZone === 'player') {
      el = iframeRef.current;
    } else if (activeZone === 'controls') {
      el = controlsRefs.current[focusIndex] ?? null;
    } else if (activeZone === 'episodes') {
      el = episodeRefs.current[focusIndex] ?? null;
    }

    if (el) {
      try {
        el.focus();
      } catch {
        // ignore
      }
      try {
        if (typeof el.scrollIntoView === 'function') {
          el.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'nearest',
          });
        }
      } catch {
        // ignore
      }
    }
  }, [activeZone, focusIndex, isSpatialMode, hasSeries]);

  // Initial focus on controls bar Prev button or hero play button when page loads in spatial mode
  useEffect(() => {
    if (!hasSeries) return;
    if (!isSpatialMode) return;
    if (activeZone !== 'controls' || focusIndex !== 0) return;
    const t = setTimeout(() => {
      try {
        if (selectedEpisodeId) {
          controlsRefs.current[0]?.focus();
        } else {
          playRef.current?.focus();
        }
      } catch {
        // ignore
      }
    }, 0);
    return () => clearTimeout(t);
  }, [hasSeries, isSpatialMode, activeZone, focusIndex, selectedEpisodeId]);

  // Handle Enter for non-player zones: click the focused element
  useEffect(() => {
    if (!hasSeries) return;
    if (!isSpatialMode) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;
      if (activeZone === 'player') return;
      if (activeZone === 'back') {
        e.preventDefault();
        backRef.current?.click();
      } else if (activeZone === 'controls') {
        e.preventDefault();
        controlsRefs.current[focusIndex]?.click();
      } else if (activeZone === 'episodes') {
        e.preventDefault();
        episodeRefs.current[focusIndex]?.click();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeZone, focusIndex, isSpatialMode, hasSeries]);

  if (isLoading && !series) {
    return <WatchViewSkeleton />;
  }

  if (isError && !series) {
    return (
      <WatchViewErrorState
        message={error instanceof Error ? error.message : undefined}
        onRetry={() => refetch()}
      />
    );
  }

  if (!series) {
    return (
      <WatchViewErrorState
        message="Series details not found"
        onRetry={seriesId ? () => refetch() : undefined}
      />
    );
  }

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
  const seasons = series.seasons ?? [];

  const backFocused = isSpatialMode && activeZone === 'back';
  const playerFocused = isSpatialMode && activeZone === 'player';

  // Find first playable episode across the entire series to play for Episode 1 CTA
  const firstPlayableEpisode =
    series.seasons?.flatMap((s) => s.episodes ?? []).find(isPlayableEpisode) ??
    series.episodes?.find(isPlayableEpisode) ??
    null;

  const handleSelectEpisode = (episodeId: string) => {
    setSelectedEpisodeId(episodeId);
    selectEpisode(episodeId);
    const ep = availableEpisodes.find((e) => e.id === episodeId);
    if (ep) {
      toast.info(`Switched to ${ep.title}`);
    }

    if (navigate && series.id) {
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
        if (navigate && series.id) {
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
        if (navigate && series.id) {
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
    if (navigate && series.id) {
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

  return (
    <div
      className="dark min-h-screen bg-[var(--bg)] text-fg font-sans pb-16"
      data-testid="watch-view"
      style={{ colorScheme: 'dark' }}
    >
      {!selectedEpisodeId ? (
        /* ================= SERIES OVERVIEW MODE ================= */
        <div>
          {/* Hoisted sticky top navigation (shell-level, stays pinned on scroll) */}
          <WatchTopNav
            mode="overview"
            onBackToCatalog={handleBackToHome}
            isBackFocused={backFocused}
            isSpatialMode={isSpatialMode}
            backRef={backRef as unknown as React.Ref<HTMLButtonElement>}
          />
          {/* Container A: Hero Banner (Full width edge-to-edge) */}
          <SeriesHeroBanner
            series={series}
            onPlay={handlePlayFirstEpisode}
            isPlayDisabled={!firstPlayableEpisode}
            isSpatialMode={isSpatialMode}
            isPlayFocused={
              isSpatialMode && activeZone === 'controls' && focusIndex === 0
            }
            playRef={playRef}
          />

          {/* Container B: Episode Explorer (Home-aligned padding) */}
          <div className="px-4 sm:px-8 md:px-12 lg:px-16 pt-8">
            <EpisodeExplorer
              seasons={seasons}
              activeSeasonId={activeSeasonId}
              onSelectSeason={selectSeason}
              episodes={availableEpisodes}
              series={series}
              activeEpisodeId={null}
              onSelectEpisode={handleSelectEpisode}
              episodeRefs={episodeRefs}
              isSpatialMode={isSpatialMode}
              activeZone={activeZone}
              focusIndex={focusIndex}
            />
          </div>
        </div>
      ) : (
        /* ================= PLAYER MODE ================= */
        <div>
          {/* Hoisted sticky top navigation (shell-level, stays pinned on scroll) */}
          <WatchTopNav
            mode="player"
            onBackToOverview={handleBackToOverview}
            isBackFocused={backFocused}
            isSpatialMode={isSpatialMode}
            backRef={backRef as unknown as React.Ref<HTMLButtonElement>}
          />
          <div className="px-4 sm:px-8 md:px-12 lg:px-16 py-4 lg:py-6 space-y-6">
            {/* Video Player Container: viewport-height constrained so TopNav,
                player and toolbar fit short laptop viewports without scrolling */}
            <WatchPlayerFrame
              activeSource={activeSource}
              episodeThumbnailUrl={activeEpisode?.thumbnailUrl}
              episodeTitle={activeEpisode?.title}
              seriesBackdropUrl={series.backdropUrl}
              isPlayerFocused={playerFocused}
              iframeRef={iframeRef}
              hasNextEpisode={hasNextEpisode}
              onNextEpisode={handleGoToNextEpisode}
            />

            {/* Docked Player Toolbar — Semantic Grouping & Single-Row Flex Flow */}
            <WatchToolbar
              hasPrevEpisode={hasPrevEpisode}
              hasNextEpisode={hasNextEpisode}
              onPrevEpisode={handleGoToPrevEpisode}
              onNextEpisode={handleGoToNextEpisode}
              onReloadPlayer={handleReloadIframe}
              onOpenNewTab={handleOpenNewTab}
              isEmbedSource={isEmbedSource}
              activeSourceIndex={state.activeSourceIndex}
              sources={sources}
              onSelectSource={selectSource}
              controlsRefs={controlsRefs}
              serverControlIndex={serverControlIndex}
              isSpatialMode={isSpatialMode}
              activeZone={activeZone}
              focusIndex={focusIndex}
            />

            {/* Active Episode Overview Details (Chunky meta-card) */}
            {activeEpisode && (
              <ActiveEpisodeCard
                seriesTitle={series.title}
                activeEpisode={activeEpisode}
                activeSeasonTitle={activeSeason?.title}
                formattedDuration={formattedEpisodeDuration}
                onBackToOverview={handleBackToOverview}
              />
            )}

            {/* Episode Explorer vertical list below active episode in Player Mode */}
            <EpisodeExplorer
              seasons={seasons}
              activeSeasonId={activeSeasonId}
              onSelectSeason={selectSeason}
              episodes={availableEpisodes}
              series={series}
              activeEpisodeId={selectedEpisodeId}
              onSelectEpisode={handleSelectEpisode}
              episodeRefs={episodeRefs}
              isSpatialMode={isSpatialMode}
              activeZone={activeZone}
              focusIndex={focusIndex}
              layoutMode="list"
            />
          </div>
        </div>
      )}

      <AdblockWarningDialog
        open={showAdblockModal}
        onDismiss={handleDismissWarning}
      />
    </div>
  );
}
