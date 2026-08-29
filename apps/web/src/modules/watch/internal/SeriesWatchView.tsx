import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { AlertCircle, ArrowLeft, ChevronDown, ListVideo, Play, RefreshCw, SkipBack, SkipForward } from 'lucide-react';
import { useWatchState } from './useWatchState';
import { getSeriesWithEpisodesQueryOptions, type WatchSeriesDetails } from './api';

export interface SeriesWatchViewProps {
  seriesId?: string;
  series?: WatchSeriesDetails;
  initialSeasonId?: string;
  initialEpisodeId?: string;
  initialSourceIndex?: number;
}

export function WatchViewSkeleton() {
  return (
    <div className="min-h-screen bg-bg text-fg font-sans animate-pulse" data-testid="watch-skeleton">
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

  return (
    <div className="min-h-screen bg-bg text-fg font-sans">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 lg:flex-row">
          {/* Left column: player + metadata */}
          <div className="flex min-w-0 flex-1 flex-col lg:w-[70%]">
            <div className="mb-4">
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="gap-2 text-muted hover:text-fg"
              >
                <Link to="/" aria-label="Back to home catalogue">
                  <ArrowLeft className="h-4 w-4" />
                  <span>Back</span>
                </Link>
              </Button>
            </div>

            {activeSource ? (
              <div className="aspect-video w-full overflow-hidden rounded-md border border-c bg-black">
                <iframe
                  data-testid="watch-player"
                  src={activeSource.url}
                  title={activeEpisode?.title ?? 'Video player'}
                  className="h-full w-full"
                  allowFullScreen
                  referrerPolicy="no-referrer"
                />
              </div>
            ) : (
              <div className="flex aspect-video w-full items-center justify-center rounded-md border border-c bg-card text-muted">
                No video source available
              </div>
            )}

            {/* Player controls */}
            <div className="mt-4 flex flex-wrap items-center gap-2 border border-c bg-card p-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={goToPrevEpisode}
                disabled={!hasPrevEpisode}
                aria-label="Prev episode"
              >
                <SkipBack className="h-4 w-4" />
                Prev
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={goToNextEpisode}
                disabled={!hasNextEpisode}
                aria-label="Next episode"
              >
                Next
                <SkipForward className="h-4 w-4" />
              </Button>

              <div className="ml-auto flex flex-wrap items-center gap-2">
                {sources.map((source, index) => (
                  <Button
                    key={source.id}
                    variant={state.activeSourceIndex === index ? 'default' : 'secondary'}
                    size="sm"
                    onClick={() => selectSource(index)}
                    aria-label={source.label}
                  >
                    {source.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Metadata / description */}
            <div className="mt-6">
              <h1 className="text-3xl font-bold">{series.title}</h1>
              {activeEpisode && (
                <h2 className="mono mt-2 text-lg text-muted">
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
          </div>

          {/* Right column: sticky sidebar */}
          <aside className="w-full lg:w-[30%]">
            <div className="flex max-h-[80vh] flex-col overflow-hidden rounded-md border border-c bg-card lg:sticky lg:top-6">
              <div className="border-b border-c p-4">
                <div className="mb-3 flex items-center gap-2">
                  <ListVideo className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold">Episodes</h3>
                </div>

                {seasons.length > 1 && (
                  <label className="relative block">
                    <span className="sr-only">Season</span>
                    <select
                      aria-label="Season"
                      value={activeSeasonId ?? ''}
                      onChange={(e) => selectSeason(e.target.value)}
                      className="w-full appearance-none rounded-md border border-c bg-bg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      {seasons.map((season) => (
                        <option key={season.id} value={season.id}>
                          {season.title}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                  </label>
                )}
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto p-3">
                {availableEpisodes.map((episode) => {
                  const isActive = episode.id === state.activeEpisodeId;
                  return (
                    <button
                      key={episode.id}
                      type="button"
                      onClick={() => selectEpisode(episode.id)}
                      className={`w-full rounded-md border p-3 text-left transition-colors ${
                        isActive
                          ? 'border-primary bg-active'
                          : 'border-c bg-transparent hover:bg-hover'
                      }`}
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
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}