import { Button } from '@/components/ui/button';
import { ChevronDown, ListVideo, Play, SkipBack, SkipForward } from 'lucide-react';
import { useWatchState } from './useWatchState';
import type { WatchSeriesDetails } from './api';

export interface SeriesWatchViewProps {
  series: WatchSeriesDetails;
}

export function SeriesWatchView({ series }: SeriesWatchViewProps) {
  const state = useWatchState(series);
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