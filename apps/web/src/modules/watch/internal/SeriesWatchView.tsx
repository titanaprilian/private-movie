import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { ChunkyButton } from '@/components/ui/chunky-button';
import { ChunkyCard } from '@/components/ui/chunky-card';
import {
  ChunkyDialog,
  ChunkyDialogContent,
  ChunkyDialogDescription,
  ChunkyDialogFooter,
  ChunkyDialogHeader,
  ChunkyDialogTitle,
} from '@/components/ui/chunky-dialog';
import {
  ChunkySelect,
  ChunkySelectContent,
  ChunkySelectItem,
  ChunkySelectTrigger,
  ChunkySelectValue,
} from '@/components/ui/chunky-select';
import { ChunkySkeleton } from '@/components/ui/chunky-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { toast } from 'sonner';
import {
  ExternalLink,
  RotateCcw,
  ShieldAlert,
  SkipBack,
  SkipForward,
} from 'lucide-react';
import { useWatchState } from './useWatchState';
import {
  getSeriesWithEpisodesQueryOptions,
  type WatchEpisode,
  type WatchSeriesDetails,
} from './api';
import { formatEmbedUrl, getEmbedIframeSandbox } from '@/lib/media';
import { VideoPlayer } from '@/components/media/VideoPlayer';
import { useInputMode } from '@/hooks/useInputMode';
import { useWatchNav } from './useWatchNav';
import { useAdblockDetector } from './useAdblockDetector';
import { SeriesHeroBanner } from './SeriesHeroBanner';
import { WatchTopNav } from './WatchTopNav';
import { navigateBackToCatalog } from './watchBackNav';
import { EpisodeExplorer } from './EpisodeExplorer';
import { formatDuration } from './formatDuration';

export interface SeriesWatchViewProps {
  seriesId?: string;
  series?: WatchSeriesDetails;
  initialSeasonId?: string;
  initialEpisodeId?: string;
  initialSourceIndex?: number;
}

export function WatchViewSkeleton() {
  return (
    <div
      className="dark min-h-screen bg-[var(--bg)] text-fg font-sans animate-pulse"
      data-testid="watch-skeleton"
      style={{ colorScheme: 'dark' }}
    >
      <ChunkySkeleton className="w-full h-[50vh] sm:h-[60vh] rounded-none border-0" />
      <div className="px-4 sm:px-8 md:px-12 lg:px-16 py-6 space-y-8">
        <div className="space-y-4 max-w-4xl">
          <ChunkySkeleton className="h-6 w-36" />
          <ChunkySkeleton className="h-10 w-44" />
          <ChunkySkeleton className="h-16 w-full" />
        </div>
        <div className="space-y-4">
          <ChunkySkeleton className="h-8 w-48" />
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <ChunkySkeleton key={i} className="aspect-video w-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function WatchViewErrorState({
  message,
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div
      className="dark min-h-screen bg-[var(--bg)] text-fg font-sans flex items-center justify-center p-4"
      data-testid="watch-error"
      style={{ colorScheme: 'dark' }}
    >
      <ErrorState
        title="Failed to load series"
        description={
          message ||
          'Unable to fetch watch details. Please check your connection and try again.'
        }
        onRetry={onRetry}
      />
    </div>
  );
}

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
            <div
              data-testid="watch-player-container"
              className="sticky top-0 z-20 mx-auto bg-[var(--bg)] w-[min(100%,calc((100dvh-12rem)*16/9))] aspect-video lg:static lg:z-auto"
            >
              {activeSource ? (
                activeSource.type === 'embed' ? (
                  <div
                    className={`relative aspect-video w-full overflow-hidden rounded-2xl sm:rounded-[20px] border-2 border-[var(--border)] bg-[var(--bg)] ${
                      playerFocused ? 'ring-2 ring-white' : ''
                    }`}
                    style={{
                      backgroundImage: activeEpisode?.thumbnailUrl
                        ? `url(${activeEpisode.thumbnailUrl})`
                        : series.backdropUrl
                          ? `url(${series.backdropUrl})`
                          : undefined,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    }}
                  >
                    <iframe
                      ref={iframeRef}
                      data-testid="watch-player"
                      src={formatEmbedUrl(activeSource.url)}
                      title={activeEpisode?.title ?? 'Video player'}
                      className="relative z-10 h-full w-full"
                      sandbox={getEmbedIframeSandbox(activeSource.url)}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
                      allowFullScreen
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ) : (
                  <div
                    className={
                      playerFocused
                        ? 'ring-2 ring-white rounded-2xl sm:rounded-[20px]'
                        : ''
                    }
                  >
                    <VideoPlayer
                      src={activeSource.url}
                      title={activeEpisode?.title}
                      autoPlay
                      onNextEpisode={
                        hasNextEpisode ? handleGoToNextEpisode : undefined
                      }
                      hasNextEpisode={hasNextEpisode}
                    />
                  </div>
                )
              ) : (
                <div className="flex aspect-video w-full items-center justify-center rounded-2xl sm:rounded-[20px] border-2 border-[var(--border)] bg-card text-muted">
                  No video source available
                </div>
              )}
            </div>

            {/* Docked Player Toolbar — Semantic Grouping & Responsive Reflow (Duolingo Nav Row) */}
            <div
              data-testid="watch-controls"
              className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-3 min-[820px]:flex-nowrap"
            >
              {/* Group 1: Playback Controls (Prev / Next segmented pill group) */}
              <div
                data-testid="controls-playback-group"
                className="inline-flex bg-[var(--surface)] border-2 border-[var(--border)] rounded-full p-0.5 sm:p-1 gap-0.5 sm:gap-1 order-1 shrink-0 max-[360px]:w-full max-[360px]:justify-center"
              >
                <ChunkyButton
                  type="button"
                  variant="outline"
                  size="sm"
                  ref={(el) => {
                    controlsRefs.current[0] = el;
                  }}
                  onClick={handleGoToPrevEpisode}
                  disabled={!hasPrevEpisode}
                  aria-label="Prev episode"
                  className={`flex-1 sm:flex-none min-h-[44px] rounded-full font-display text-xs sm:text-sm px-2.5 py-1.5 sm:px-4 sm:py-2 ${
                    isSpatialMode &&
                    activeZone === 'controls' &&
                    focusIndex === 0
                      ? 'ring-2 ring-white ring-offset-2 ring-offset-black scale-105 bg-white text-black font-semibold shadow-xl z-10'
                      : ''
                  }`}
                >
                  <SkipBack className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                  <span>Prev</span>
                </ChunkyButton>

                <ChunkyButton
                  type="button"
                  variant="outline"
                  size="sm"
                  ref={(el) => {
                    controlsRefs.current[1] = el;
                  }}
                  onClick={handleGoToNextEpisode}
                  disabled={!hasNextEpisode}
                  aria-label="Next episode"
                  className={`flex-1 sm:flex-none min-h-[44px] rounded-full font-display text-xs sm:text-sm px-2.5 py-1.5 sm:px-4 sm:py-2 ${
                    isSpatialMode &&
                    activeZone === 'controls' &&
                    focusIndex === 1
                      ? 'ring-2 ring-white ring-offset-2 ring-offset-black scale-105 bg-white text-black font-semibold shadow-xl z-10'
                      : ''
                  }`}
                >
                  <span>Next</span>
                  <SkipForward className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                </ChunkyButton>
              </div>

              {/* Group 2: Utility Action Buttons (Reload / Open Tab) — embed only, centered */}
              {isEmbedSource && (
                <div
                  data-testid="controls-utility-group"
                  className="order-3 w-full flex justify-center pt-0.5 min-[820px]:pt-0 min-[820px]:order-2 min-[820px]:w-auto min-[820px]:flex-1"
                >
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <ChunkyButton
                      type="button"
                      variant="outline"
                      size="sm"
                      ref={(el) => {
                        controlsRefs.current[2] = el;
                      }}
                      onClick={handleReloadIframe}
                      aria-label="Reload player"
                      title="Reload video player"
                      className={`min-h-[44px] rounded-full font-display text-xs sm:text-sm px-2.5 py-1.5 sm:px-4 sm:py-2 ${
                        isSpatialMode &&
                        activeZone === 'controls' &&
                        focusIndex === 2
                          ? 'ring-2 ring-white ring-offset-2 ring-offset-black scale-105 bg-white text-black font-semibold shadow-xl z-10'
                          : ''
                      }`}
                    >
                      <RotateCcw className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                      <span>Reload</span>
                    </ChunkyButton>

                    <ChunkyButton
                      type="button"
                      variant="blue"
                      size="sm"
                      ref={(el) => {
                        controlsRefs.current[3] = el;
                      }}
                      onClick={handleOpenNewTab}
                      aria-label="Open in new tab"
                      title="Open stream in new tab"
                      className={`min-h-[44px] rounded-full font-display text-xs sm:text-sm px-2.5 py-1.5 sm:px-4 sm:py-2 bg-[var(--blue)] ${
                        isSpatialMode &&
                        activeZone === 'controls' &&
                        focusIndex === 3
                          ? 'ring-2 ring-white ring-offset-2 ring-offset-black scale-105 bg-white text-black font-semibold shadow-xl z-10'
                          : ''
                      }`}
                    >
                      <ExternalLink className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                      <span>Open Tab</span>
                    </ChunkyButton>
                  </div>
                </div>
              )}

              {/* Group 3: Stream Configuration / Server Selector Chip — docked to the right */}
              <div
                data-testid="controls-server-group"
                className="order-2 shrink-0 flex items-center justify-end min-[820px]:order-3 max-[480px]:w-full max-[480px]:justify-center max-[480px]:pt-0.5"
              >
                <ChunkySelect
                  value={String(state.activeSourceIndex)}
                  onValueChange={(v) => selectSource(Number(v))}
                >
                  <ChunkySelectTrigger
                    ref={(el) => {
                      controlsRefs.current[serverControlIndex] =
                        el as unknown as HTMLButtonElement;
                    }}
                    aria-label="Server selector"
                    data-testid="server-selector"
                    className={`rounded-full font-display w-40 min-[480px]:w-60 sm:w-64 shrink-0 min-h-[44px] ${
                      isSpatialMode &&
                      activeZone === 'controls' &&
                      focusIndex === serverControlIndex
                        ? 'ring-2 ring-white ring-offset-2 ring-offset-black scale-[1.02] bg-white text-black font-semibold shadow-xl z-10'
                        : ''
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                      <span
                        className="w-2 h-2 rounded-full bg-[#58cc02] shrink-0 shadow-[0_0_0_3px_rgba(88,204,2,0.25)]"
                        data-testid="server-status-dot"
                      />
                      <span className="font-display font-bold text-sm truncate leading-none max-w-[96px] min-[480px]:max-w-none">
                        <ChunkySelectValue placeholder="Select server" />
                      </span>
                    </div>
                  </ChunkySelectTrigger>
                  <ChunkySelectContent>
                    {sources.length > 1 && (
                      <div
                        data-testid="server-count-badge"
                        className="font-sans font-bold text-[11px] text-[var(--muted)] bg-[var(--surface-raised)] border border-[var(--border)] px-2 py-1 rounded-full text-center leading-none mx-1 mb-1"
                      >
                        ({sources.length} available)
                      </div>
                    )}
                    {sources.map((source, index) => {
                      const isDirect =
                        source.type === 's3' || source.type === 'direct';
                      return (
                        <ChunkySelectItem
                          key={source.id}
                          value={String(index)}
                          data-testid={`server-option-${index}`}
                          className="font-display"
                        >
                          <span className="inline-flex items-center gap-2">
                            <span>{source.label}</span>
                            {source.quality && (
                              <span className="font-sans font-bold text-xs opacity-75">
                                · {source.quality}
                              </span>
                            )}
                            <span
                              data-testid={`server-badge-${index}`}
                              className={
                                isDirect
                                  ? 'font-sans font-bold text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-[#58cc02]/15 text-[#58cc02] border border-[#58cc02]/30 leading-none'
                                  : 'font-sans font-bold text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-[var(--surface-raised)] text-[var(--muted)] border border-[var(--border)] leading-none'
                              }
                            >
                              {isDirect ? 'Direct' : 'Embed'}
                            </span>
                          </span>
                        </ChunkySelectItem>
                      );
                    })}
                  </ChunkySelectContent>
                </ChunkySelect>
              </div>
            </div>

            {/* Active Episode Overview Details (Chunky meta-card) */}
            {activeEpisode && (
              <ChunkyCard
                data-testid="active-episode-overview"
                className="rounded-[20px] p-5 sm:p-6 space-y-3"
              >
                <button
                  type="button"
                  onClick={handleBackToOverview}
                  data-testid="series-tag-pill"
                  className="inline-flex items-center bg-[#58cc02]/15 hover:bg-[#58cc02]/25 text-[#58cc02] font-display font-bold text-xs sm:text-sm px-3.5 py-1 rounded-full cursor-pointer transition-all duration-150 active:scale-[0.97]"
                >
                  {series.title}
                </button>

                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 flex-wrap">
                  <h2 className="text-2xl sm:text-3xl font-display font-extrabold tracking-tight text-[var(--ink)] leading-snug">
                    {activeEpisode.order !== undefined &&
                    activeEpisode.order !== null
                      ? `EP ${activeEpisode.order} — ${activeEpisode.title}`
                      : activeEpisode.title}
                  </h2>

                  <div className="flex items-center gap-2 shrink-0">
                    {activeSeason && (
                      <span
                        data-testid="meta-season-badge"
                        className="bg-[var(--surface-raised)] border-2 border-b-4 border-[var(--border)] text-[var(--muted)] font-display font-bold text-xs sm:text-sm px-3.5 py-1 rounded-full whitespace-nowrap"
                      >
                        {activeSeason.title}
                      </span>
                    )}
                    {formattedEpisodeDuration && (
                      <span
                        data-testid="meta-duration-badge"
                        className="bg-[var(--yellow)]/15 border-2 border-b-4 border-[var(--yellow-dark)]/40 text-[var(--yellow)] font-display font-bold text-xs sm:text-sm px-3.5 py-1 rounded-full whitespace-nowrap"
                      >
                        {formattedEpisodeDuration}
                      </span>
                    )}
                  </div>
                </div>

                {activeEpisode.description ? (
                  <p className="text-sm sm:text-base leading-relaxed text-[var(--muted)] max-w-4xl pt-1">
                    {activeEpisode.description}
                  </p>
                ) : (
                  <p className="text-sm sm:text-base italic text-[var(--muted)]/60 pt-1">
                    No description available for this episode.
                  </p>
                )}
              </ChunkyCard>
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

      <ChunkyDialog
        open={showAdblockModal}
        onOpenChange={(open) => !open && handleDismissWarning()}
      >
        <ChunkyDialogContent className="sm:max-w-md">
          <ChunkyDialogHeader>
            <div className="flex items-center gap-2 text-amber-500">
              <ShieldAlert className="h-5 w-5 shrink-0" />
              <ChunkyDialogTitle className="text-base">
                Ad Blocker Recommended
              </ChunkyDialogTitle>
            </div>
            <ChunkyDialogDescription className="text-xs leading-relaxed space-y-2 pt-1">
              <span>
                Third-party video mirrors may serve popups and unexpected
                redirects during playback. We strongly recommend using an ad
                blocker (such as uBlock Origin or Brave Shields) for an
                uninterrupted experience.
              </span>
            </ChunkyDialogDescription>
          </ChunkyDialogHeader>

          <ChunkyDialogFooter className="mt-0 flex-col-reverse sm:flex-row">
            <ChunkyButton
              variant="outline"
              size="sm"
              onClick={handleDismissWarning}
            >
              Continue anyway
            </ChunkyButton>
            <ChunkyButton size="sm" asChild>
              <Link
                to="/guide/adblock"
                target="_blank"
                rel="noreferrer noopener"
                className="gap-1.5"
              >
                <span>View Adblock Guide</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </ChunkyButton>
          </ChunkyDialogFooter>
        </ChunkyDialogContent>
      </ChunkyDialog>
    </div>
  );
}
