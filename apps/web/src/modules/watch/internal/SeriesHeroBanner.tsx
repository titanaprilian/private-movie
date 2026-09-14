import { useState } from 'react';
import { ArrowLeft, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { WatchSeriesDetails } from './api';

export interface SeriesHeroBannerProps {
  series: WatchSeriesDetails;
  onPlay: () => void;
  onBack?: () => void;
  isSpatialMode?: boolean;
  isPlayFocused?: boolean;
  isBackFocused?: boolean;
  backRef?: React.Ref<HTMLButtonElement | HTMLAnchorElement>;
  playRef?: React.Ref<HTMLButtonElement>;
}

export function SeriesHeroBanner({
  series,
  onPlay,
  onBack,
  isSpatialMode,
  isPlayFocused,
  isBackFocused,
  backRef,
  playRef,
}: SeriesHeroBannerProps) {
  const [backdropFailed, setBackdropFailed] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);

  // Fallback backdrop hierarchy: backdropUrl -> posterUrl -> styled placeholder
  const heroImage = !backdropFailed && series.backdropUrl
    ? series.backdropUrl
    : !posterFailed && series.posterUrl
      ? series.posterUrl
      : null;

  // Extract genre names
  const genreNames: string[] = Array.isArray(series.genres)
    ? series.genres.map((g) => (typeof g === 'string' ? g : g.name))
    : [];

  const seasonCount = series.seasons?.length ?? 0;

  return (
    <div
      data-testid="series-hero-banner"
      className="relative w-full rounded-lg border border-c bg-card overflow-hidden"
    >
      {/* Cinematic Background with gradient overlays */}
      {heroImage ? (
        <div className="absolute inset-0 z-0 overflow-hidden">
          <img
            src={heroImage}
            alt={series.title}
            onError={() => {
              if (!backdropFailed && series.backdropUrl) {
                setBackdropFailed(true);
              } else {
                setPosterFailed(true);
              }
            }}
            className="h-full w-full object-cover object-center opacity-40 filter brightness-90 contrast-105 transform scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/80 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/70 to-transparent" />
        </div>
      ) : (
        <div className="absolute inset-0 z-0 bg-gradient-to-br from-card via-zinc-900/50 to-bg opacity-70" />
      )}

      {/* Top action bar: Back button */}
      <div className="relative z-10 p-4 sm:p-6 pb-0">
        {onBack && (
          <Button
            ref={backRef as unknown as React.Ref<HTMLButtonElement>}
            variant="ghost"
            size="sm"
            onClick={onBack}
            className={`gap-2 text-muted hover:text-fg bg-card/60 backdrop-blur-md border border-c ${
              isSpatialMode && isBackFocused ? 'ring-2 ring-white' : ''
            }`}
            aria-label="Back to home catalogue"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back</span>
          </Button>
        )}
      </div>

      {/* Hero Content Section */}
      <div className="relative z-10 p-4 sm:p-6 md:p-8 pt-2 sm:pt-4 max-w-4xl space-y-4">
        {/* Title */}
        <h1 className="text-2xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-fg leading-tight">
          {series.title}
        </h1>

        {/* Metadata badges row */}
        <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
          {series.rating && (
            <span className="mono rounded bg-primary/20 border border-primary/30 px-2 py-0.5 font-semibold text-primary">
              ★ {series.rating}
            </span>
          )}

          {seasonCount > 0 && (
            <span className="mono rounded bg-card/80 border border-c px-2 py-0.5 text-muted">
              {seasonCount} {seasonCount === 1 ? 'Season' : 'Seasons'}
            </span>
          )}

          {/* Genre Pill Tags */}
          {genreNames.map((genre) => (
            <span
              key={genre}
              className="mono rounded-full bg-card/90 border border-c px-2.5 py-0.5 text-xs text-muted"
            >
              {genre}
            </span>
          ))}
        </div>

        {/* Series Description */}
        {series.description ? (
          <p className="text-sm sm:text-base leading-relaxed text-muted max-w-3xl">
            {series.description}
          </p>
        ) : (
          <p className="text-sm italic text-muted/60">
            No synopsis available for this series.
          </p>
        )}

        {/* Primary Call To Action Button */}
        <div className="pt-2">
          <Button
            ref={playRef}
            size="lg"
            onClick={onPlay}
            className={`gap-2 text-sm sm:text-base font-semibold px-6 py-2.5 shadow-lg shadow-indigo-500/10 ${
              isSpatialMode && isPlayFocused ? 'ring-2 ring-white' : ''
            }`}
            aria-label="Play Episode 1"
          >
            <Play className="h-4 w-4 sm:h-5 sm:w-5 fill-current" />
            <span>Play Episode 1</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
