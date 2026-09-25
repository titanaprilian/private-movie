import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  AlertCircle,
  ArrowLeft,
  ExternalLink,
  RefreshCw,
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
import { useInputMode } from '@/hooks/useInputMode';
import { useWatchNav } from './useWatchNav';
import { useAdblockDetector } from './useAdblockDetector';
import { SeriesHeroBanner } from './SeriesHeroBanner';
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
      className="min-h-screen bg-bg text-fg font-sans animate-pulse"
      data-testid="watch-skeleton"
    >
      <div className="w-full h-[50vh] sm:h-[60vh] bg-card/60" />
      <div className="px-4 sm:px-8 md:px-12 lg:px-16 py-6 space-y-8">
        <div className="space-y-4 max-w-4xl">
          <div className="h-6 w-36 rounded bg-card/60" />
          <div className="h-10 w-44 rounded bg-card/60" />
          <div className="h-16 w-full rounded bg-card/40" />
        </div>
        <div className="space-y-4">
          <div className="h-8 w-48 rounded bg-card/60" />
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="aspect-video w-full rounded-md bg-card/40" />
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
      className="min-h-screen bg-bg text-fg font-sans flex items-center justify-center p-4"
      data-testid="watch-error"
    >
      <div className="max-w-md w-full rounded-md border border-red-500/30 bg-card p-6 text-center space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-red-500">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-semibold">Failed to load series</h2>
        <p className="text-sm text-muted">
          {message ||
            'Unable to fetch watch details. Please check your connection and try again.'}
        </p>
        {onRetry && (
          <Button variant="secondary" onClick={onRetry} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Retry
          </Button>
        )}
      </div>
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
      ? series.seasons.flatMap((s) => (s.episodes ?? []).filter(isPlayableEpisode))
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
  const sourcesForNav = useMemo(
    () => state.activeEpisode?.videoSources ?? [],
    [state.activeEpisode?.videoSources]
  );
  const controlsCount = 4 + sourcesForNav.length;
  const episodesCount = availableEpisodesForNav.length || 1;

  const { activeZone, focusIndex } = useWatchNav({
    controlsCount: hasSeries ? controlsCount : 2,
    episodesCount: hasSeries ? episodesCount : 1,
    iframeRef,
  });

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
    series.seasons
      ?.flatMap((s) => s.episodes ?? [])
      .find(isPlayableEpisode) ??
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
    const currentIndex = availableEpisodes.findIndex((e) => e.id === activeEpisode?.id);
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
    const currentIndex = availableEpisodes.findIndex((e) => e.id === activeEpisode?.id);
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
    <div className="min-h-screen bg-bg text-fg font-sans pb-16">
      {!selectedEpisodeId ? (
        /* ================= SERIES OVERVIEW MODE ================= */
        <div className="space-y-8">
          {/* Container A: Hero Banner (Full width edge-to-edge) */}
          <SeriesHeroBanner
            series={series}
            onPlay={handlePlayFirstEpisode}
            onBack={() => {
              if (navigate) {
                navigate({ to: '/' });
              } else if (typeof window !== 'undefined') {
                window.location.href = '/';
              }
            }}
            isPlayDisabled={!firstPlayableEpisode}
            isSpatialMode={isSpatialMode}
            isPlayFocused={isSpatialMode && activeZone === 'controls' && focusIndex === 0}
            isBackFocused={backFocused}
            backRef={backRef}
            playRef={playRef}
          />

          {/* Container B: Episode Explorer (Home-aligned padding) */}
          <div className="px-4 sm:px-8 md:px-12 lg:px-16">
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
        <div className="px-4 sm:px-8 md:px-12 lg:px-16 py-4 lg:py-6 space-y-6">
          {/* Contextual navigation top bar */}
          <div className="flex items-center justify-between">
            <Button
              ref={backRef as unknown as React.Ref<HTMLButtonElement>}
              variant="ghost"
              size="sm"
              onClick={handleBackToOverview}
              className={`gap-2 text-muted hover:text-fg ${
                backFocused ? 'ring-2 ring-white' : ''
              }`}
              aria-label="Back to series overview"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Overview</span>
            </Button>
          </div>

          {/* Video Player Container */}
          <div
            data-testid="watch-player-container"
            className="sticky top-0 z-20 -mx-4 sm:mx-0 lg:static lg:z-auto bg-black"
          >
            {activeSource ? (
              <div
                className={`relative aspect-video w-full overflow-hidden rounded-none sm:rounded-md border-y sm:border border-c bg-black ${
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
              <div className="flex aspect-video w-full items-center justify-center rounded-none sm:rounded-md border-y sm:border border-c bg-card text-muted">
                No video source available
              </div>
            )}
          </div>

          {/* Docked Player Toolbar */}
          <div
            data-testid="watch-controls"
            className="flex flex-wrap items-center gap-2 border border-c bg-card p-3 rounded-none sm:rounded-md"
          >
            <Button
              ref={(el) => {
                controlsRefs.current[0] = el;
              }}
              variant="secondary"
              size="sm"
              onClick={handleGoToPrevEpisode}
              disabled={!hasPrevEpisode}
              aria-label="Prev episode"
              className={
                isSpatialMode && activeZone === 'controls' && focusIndex === 0
                  ? 'ring-2 ring-white'
                  : ''
              }
            >
              <SkipBack className="h-4 w-4" />
              Prev
            </Button>

            <Button
              ref={(el) => {
                controlsRefs.current[1] = el;
              }}
              variant="secondary"
              size="sm"
              onClick={handleGoToNextEpisode}
              disabled={!hasNextEpisode}
              aria-label="Next episode"
              className={
                isSpatialMode && activeZone === 'controls' && focusIndex === 1
                  ? 'ring-2 ring-white'
                  : ''
              }
            >
              Next
              <SkipForward className="h-4 w-4" />
            </Button>

            <Button
              ref={(el) => {
                controlsRefs.current[2] = el;
              }}
              variant="ghost"
              size="sm"
              onClick={handleReloadIframe}
              aria-label="Reload player"
              title="Reload video player"
              className={
                isSpatialMode && activeZone === 'controls' && focusIndex === 2
                  ? 'ring-2 ring-white'
                  : ''
              }
            >
              <RotateCcw className="h-4 w-4" />
            </Button>

            <Button
              ref={(el) => {
                controlsRefs.current[3] = el;
              }}
              variant="ghost"
              size="sm"
              onClick={handleOpenNewTab}
              aria-label="Open in new tab"
              title="Open stream in new tab"
              className={
                isSpatialMode && activeZone === 'controls' && focusIndex === 3
                  ? 'ring-2 ring-white'
                  : ''
              }
            >
              <ExternalLink className="h-4 w-4" />
            </Button>

            <div className="ml-auto flex flex-wrap items-center gap-2">
              {sources.map((source, index) => {
                const sourceFocusIndex = 4 + index;
                const isSourceFocused =
                  isSpatialMode &&
                  activeZone === 'controls' &&
                  focusIndex === sourceFocusIndex;
                return (
                  <Button
                    key={source.id}
                    ref={(el) => {
                      controlsRefs.current[sourceFocusIndex] = el;
                    }}
                    variant={
                      state.activeSourceIndex === index
                        ? 'default'
                        : 'secondary'
                    }
                    size="sm"
                    onClick={() => selectSource(index)}
                    aria-label={source.label}
                    className={isSourceFocused ? 'ring-2 ring-white' : ''}
                  >
                    {source.label}
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Active Episode Overview Details */}
          {activeEpisode && (
            <div
              data-testid="active-episode-overview"
              className="space-y-3 rounded-lg border border-c bg-card p-4 sm:p-6"
            >
              <button
                type="button"
                onClick={handleBackToOverview}
                className="mono text-xs text-primary hover:underline cursor-pointer block text-left"
              >
                {series.title}
              </button>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-fg">
                  {activeEpisode.order !== undefined && activeEpisode.order !== null
                    ? `EP ${activeEpisode.order} — ${activeEpisode.title}`
                    : activeEpisode.title}
                </h2>

                <div className="flex items-center gap-2 text-xs text-muted mono">
                  {activeSeason && <span>{activeSeason.title}</span>}
                  {formattedEpisodeDuration && (
                    <span className="rounded bg-bg px-2 py-0.5 border border-c">
                      {formattedEpisodeDuration}
                    </span>
                  )}
                </div>
              </div>

              {activeEpisode.description ? (
                <p className="text-sm leading-relaxed text-muted max-w-4xl">
                  {activeEpisode.description}
                </p>
              ) : (
                <p className="text-sm italic text-muted/60">
                  No description available for this episode.
                </p>
              )}
            </div>
          )}

          {/* Episode Explorer Grid below active episode */}
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
          />
        </div>
      )}

      <Dialog
        open={showAdblockModal}
        onOpenChange={(open) => !open && handleDismissWarning()}
      >
        <DialogContent className="sm:max-w-md border border-c bg-card text-fg">
          <DialogHeader className="gap-2 text-left">
            <div className="flex items-center gap-2 text-amber-500">
              <ShieldAlert className="h-5 w-5 shrink-0" />
              <DialogTitle className="text-base font-semibold">
                Ad Blocker Recommended
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs leading-relaxed text-muted space-y-2 pt-1">
              <span>
                Third-party video mirrors may serve popups and unexpected
                redirects during playback. We strongly recommend using an ad
                blocker (such as uBlock Origin or Brave Shields) for an
                uninterrupted experience.
              </span>
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleDismissWarning}
            >
              Continue anyway
            </Button>
            <Button size="sm" asChild>
              <Link
                to="/guide/adblock"
                target="_blank"
                rel="noreferrer noopener"
                className="gap-1.5"
              >
                <span>View Adblock Guide</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
