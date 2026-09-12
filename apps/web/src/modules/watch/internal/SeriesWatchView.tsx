import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  AlertCircle,
  ArrowLeft,
  ExternalLink,
  Info,
  ListVideo,
  Play,
  RefreshCw,
  ShieldAlert,
  SkipBack,
  SkipForward,
} from 'lucide-react';
import { useWatchState } from './useWatchState';
import {
  getSeriesWithEpisodesQueryOptions,
  type WatchSeriesDetails,
} from './api';
import { formatEmbedUrl } from '../../videos/internal/embedUrl';
import { useInputMode } from '@/hooks/useInputMode';
import { useWatchNav } from './useWatchNav';
import { useAdblockDetector } from './useAdblockDetector';

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
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 lg:flex-row">
          {/* Left column: player + metadata skeleton */}
          <div className="flex min-w-0 flex-1 flex-col lg:w-[70%]">
            <div className="mb-4 h-8 w-20 rounded bg-card/60" />
            <div className="aspect-video w-full rounded-md border border-c bg-card/60" />
            <div className="mt-4 flex flex-wrap items-center gap-2 border border-c bg-card p-3">
              <div className="h-9 w-20 rounded border border-c bg-bg/50" />
              <div className="h-9 w-20 rounded border border-c bg-bg/50" />
              <div className="ml-auto flex gap-2">
                <div className="h-9 w-24 rounded border border-c bg-bg/50" />
                <div className="h-9 w-24 rounded border border-c bg-bg/50" />
              </div>
            </div>
            <div className="mt-6 space-y-3">
              <div className="h-8 w-1/3 rounded bg-card/60" />
              <div className="h-5 w-1/4 rounded bg-card/40" />
              <div className="h-16 w-full rounded bg-card/30" />
            </div>
          </div>

          {/* Right column: sticky sidebar skeleton */}
          <aside className="w-full lg:w-[30%]">
            <div className="flex h-[500px] flex-col rounded-md border border-c bg-card p-4 space-y-4">
              <div className="h-6 w-1/2 rounded bg-bg/60" />
              <div className="h-10 w-full rounded bg-bg/40" />
              <div className="flex-1 space-y-2 pt-2">
                <div className="h-14 w-full rounded bg-bg/40" />
                <div className="h-14 w-full rounded bg-bg/40" />
                <div className="h-14 w-full rounded bg-bg/40" />
              </div>
            </div>
          </aside>
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

  const state = useWatchState(series, {
    initialSeasonId,
    initialEpisodeId,
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
  const backRef = useRef<HTMLAnchorElement | null>(null);
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
  const controlsCount = 2 + sourcesForNav.length;
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

  // Initial focus on controls bar Prev button when page loads in spatial mode
  useEffect(() => {
    if (!hasSeries) return;
    if (!isSpatialMode) return;
    if (activeZone !== 'controls' || focusIndex !== 0) return;
    const t = setTimeout(() => {
      try {
        controlsRefs.current[0]?.focus();
        controlsRefs.current[0]?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'nearest',
        });
      } catch {
        // ignore
      }
    }, 0);
    return () => clearTimeout(t);
  }, [hasSeries, isSpatialMode, activeZone, focusIndex]);

  // Handle Enter for non-player zones: click the focused element
  useEffect(() => {
    if (!hasSeries) return;
    if (!isSpatialMode) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;
      // player zone is handled by useWatchNav (dispatch Space), don't interfere
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

  // Auto-scroll active episode card into view in episode playlist
  useEffect(() => {
    if (!hasSeries || !state.activeEpisodeId) return;
    const activeIndex = availableEpisodesForNav.findIndex(
      (e) => e.id === state.activeEpisodeId
    );
    if (activeIndex !== -1 && episodeRefs.current[activeIndex]) {
      try {
        episodeRefs.current[activeIndex]?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'nearest',
        });
      } catch {
        // ignore
      }
    }
  }, [
    hasSeries,
    state.activeEpisodeId,
    state.activeSeasonId,
    availableEpisodesForNav,
  ]);

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

  const handleSelectEpisode = (episodeId: string) => {
    selectEpisode(episodeId);
    const ep = availableEpisodes.find((e) => e.id === episodeId);
    if (ep) {
      toast.info(`Switched to ${ep.title}`);
    }
  };

  const renderEpisodeList = () => (
    <div className="flex-1 space-y-2 overflow-y-auto p-3">
      {availableEpisodes.map((episode, idx) => {
        const isActive = episode.id === state.activeEpisodeId;
        const isEpisodeFocused =
          isSpatialMode && activeZone === 'episodes' && focusIndex === idx;
        return (
          <button
            key={episode.id}
            ref={(el) => {
              episodeRefs.current[idx] = el;
            }}
            type="button"
            onClick={() => handleSelectEpisode(episode.id)}
            className={`w-full rounded-md border p-3 text-left transition-colors ${
              isActive
                ? 'border-primary bg-active'
                : 'border-c bg-transparent hover:bg-hover'
            } ${isEpisodeFocused ? 'ring-2 ring-white' : ''}`}
          >
            <span className="mono text-xs text-muted">
              EP {episode.order ?? ''}
            </span>
            <span
              className={`mt-1 block text-sm font-medium ${
                isActive ? 'text-primary' : 'text-fg'
              }`}
            >
              {episode.title}
            </span>
            {isActive && (
              <span className="mt-2 inline-flex items-center gap-1 text-xs text-primary">
                <Play className="h-3 w-3 fill-primary" /> Now playing
              </span>
            )}
          </button>
        );
      })}
    </div>
  );

  const renderSeasonSelector = () =>
    seasons.length > 1 ? (
      <Select
        value={activeSeasonId ?? ''}
        onValueChange={(val) => selectSeason(val)}
      >
        <SelectTrigger aria-label="Season">
          <SelectValue placeholder="Select Season" />
        </SelectTrigger>
        <SelectContent>
          {seasons.map((season) => (
            <SelectItem key={season.id} value={season.id}>
              {season.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    ) : null;

  const renderMetadata = () => (
    <div>
      <h1 className="text-2xl sm:text-3xl font-bold">{series.title}</h1>
      {activeEpisode && (
        <h2 className="mono mt-2 text-base sm:text-lg text-muted">
          {activeSeason
            ? `${activeSeason.title} — Episode ${activeEpisode.order ?? ''}`
            : `Episode ${activeEpisode.order ?? ''}`}
        </h2>
      )}
      {activeEpisode?.description && (
        <p className="mt-4 leading-relaxed text-muted">
          {activeEpisode.description}
        </p>
      )}
      {!activeEpisode?.description && series.description && (
        <p className="mt-4 leading-relaxed text-muted">{series.description}</p>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-bg text-fg font-sans">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
        <div className="flex flex-col gap-6 lg:gap-8 lg:flex-row">
          {/* Left column: player + metadata */}
          <div className="flex min-w-0 flex-1 flex-col lg:w-[70%]">
            {/* Desktop standalone back button */}
            <div className="hidden mb-4 lg:block">
              <Button
                variant="ghost"
                size="sm"
                asChild
                className={`gap-2 text-muted hover:text-fg ${backFocused ? 'ring-2 ring-white' : ''}`}
              >
                <Link
                  to="/"
                  aria-label="Back to home catalogue"
                  ref={backRef as unknown as React.Ref<HTMLAnchorElement>}
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>Back</span>
                </Link>
              </Button>
            </div>

            {/* Video player container: sticky top-0 full-bleed on mobile, standard on desktop */}
            <div
              data-testid="watch-player-container"
              className="sticky top-0 z-20 -mx-4 sm:mx-0 lg:static lg:z-auto bg-black"
            >
              {/* Mobile overlay back button */}
              <div className="absolute left-3 top-3 z-30 lg:hidden">
                <Button
                  variant="ghost"
                  size="icon"
                  asChild
                  className={`h-9 w-9 rounded-full border border-white/20 bg-black/60 text-white backdrop-blur-sm hover:bg-black/80 hover:text-white ${
                    backFocused ? 'ring-2 ring-white' : ''
                  }`}
                >
                  <Link
                    to="/"
                    aria-label="Back to home catalogue"
                    ref={backRef as unknown as React.Ref<HTMLAnchorElement>}
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Link>
                </Button>
              </div>

              {activeSource ? (
                <div
                  className={`aspect-video w-full overflow-hidden rounded-none sm:rounded-md border-y sm:border border-c bg-black ${
                    playerFocused ? 'ring-2 ring-white' : ''
                  }`}
                >
                  <iframe
                    ref={iframeRef}
                    data-testid="watch-player"
                    src={formatEmbedUrl(activeSource.url)}
                    title={activeEpisode?.title ?? 'Video player'}
                    className="h-full w-full"
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

            {/* Player controls */}
            <div
              data-testid="watch-controls"
              className="mt-2 sm:mt-4 flex flex-wrap items-center gap-2 border border-c bg-card p-3 rounded-none sm:rounded-md"
            >
              <Button
                ref={(el) => {
                  controlsRefs.current[0] = el;
                }}
                variant="secondary"
                size="sm"
                onClick={goToPrevEpisode}
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
                onClick={goToNextEpisode}
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

              <div className="ml-auto flex flex-wrap items-center gap-2">
                {sources.map((source, index) => {
                  const sourceFocusIndex = 2 + index;
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

            {/* Mobile Tabbed View (< lg) */}
            <div
              className="mt-4 block lg:hidden"
              data-testid="watch-mobile-tabs"
            >
              <Tabs defaultValue="episodes" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="episodes" className="gap-1.5">
                    <ListVideo className="h-3.5 w-3.5" />
                    <span>Episodes</span>
                  </TabsTrigger>
                  <TabsTrigger value="details" className="gap-1.5">
                    <Info className="h-3.5 w-3.5" />
                    <span>Details</span>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="episodes" className="mt-3 space-y-3">
                  {renderSeasonSelector()}
                  <div className="rounded-md border border-c bg-card">
                    {renderEpisodeList()}
                  </div>
                </TabsContent>

                <TabsContent
                  value="details"
                  className="mt-3 rounded-md border border-c bg-card p-4"
                >
                  {renderMetadata()}
                </TabsContent>
              </Tabs>
            </div>

            {/* Desktop Metadata / description (lg+) */}
            <div
              className="mt-6 hidden lg:block"
              data-testid="watch-desktop-metadata"
            >
              {renderMetadata()}
            </div>
          </div>

          {/* Desktop Right column: sticky sidebar (lg+) */}
          <aside
            className="hidden w-full lg:block lg:w-[30%]"
            data-testid="watch-desktop-sidebar"
          >
            <div className="flex max-h-[80vh] flex-col overflow-hidden rounded-md border border-c bg-card lg:sticky lg:top-6">
              <div className="border-b border-c p-4">
                <div className="mb-3 flex items-center gap-2">
                  <ListVideo className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold">Episodes</h3>
                </div>

                {renderSeasonSelector()}
              </div>

              {renderEpisodeList()}
            </div>
          </aside>
        </div>
      </div>

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
