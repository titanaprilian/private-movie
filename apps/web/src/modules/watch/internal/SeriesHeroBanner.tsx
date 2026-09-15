import { useState } from 'react';
import { ArrowLeft, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { WatchSeriesDetails } from './api';

export interface SeriesHeroBannerProps {
  series: WatchSeriesDetails;
  onPlay: () => void;
  onBack?: () => void;
  isPlayDisabled?: boolean;
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
  isPlayDisabled,
  isSpatialMode,
  isPlayFocused,
  isBackFocused,
  backRef,
  playRef,
}: SeriesHeroBannerProps) {
  const [backdropFailed, setBackdropFailed] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);

  // Fallback backdrop hierarchy: backdropUrl -> posterUrl -> styled placeholder
  const heroImage = !backdropFailed && series.backdropUrl
    ? series.backdropUrl
    : !posterFailed && series.posterUrl
      ? series.posterUrl
      : null;

  const showLogo = Boolean(series.logoUrl && !logoFailed);

  // Extract genre names
  const genreNames: string[] = Array.isArray(series.genres)
    ? series.genres.map((g) => (typeof g === 'string' ? g : g.name))
    : [];

  const seasonCount = series.seasons?.length ?? 0;

  return (
    <div
      data-testid="series-hero-banner"
      className="relative w-full overflow-hidden"
    >
      {/* Top action bar: Back button */}
      <div className="absolute top-0 left-0 right-0 z-20 px-4 sm:px-8 md:px-12 lg:px-16 pt-4 sm:pt-6 pointer-events-none">
        {onBack && (
          <Button
            ref={backRef as unknown as React.Ref<HTMLButtonElement>}
            variant="ghost"
            size="sm"
            onClick={onBack}
            className={`pointer-events-auto gap-2 text-muted hover:text-fg bg-card/60 backdrop-blur-md border border-c ${
              isSpatialMode && isBackFocused ? 'ring-2 ring-white' : ''
            }`}
            aria-label="Back to home catalogue"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back</span>
          </Button>
        )}
      </div>

      {/* Cinematic Hero Artwork Container (Full-bleed edge-to-edge) */}
      <div className="relative h-[50vh] sm:h-[60vh] md:h-[70vh] min-h-[350px] max-h-[750px] w-full bg-zinc-950 overflow-hidden">
        {heroImage ? (
          <>
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
              className="h-full w-full object-cover object-center opacity-70 filter brightness-95 contrast-105"
            />
            {/* Seamless bottom fade gradient into page bg */}
            <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/40 to-transparent z-10" />
            <div className="absolute inset-0 bg-gradient-to-r from-bg/60 via-transparent to-transparent z-10" />

            {/* Bottom-left series logo or title heading fallback */}
            <div className="absolute bottom-0 left-0 z-20 px-4 sm:px-8 md:px-12 lg:px-16 pb-6 pointer-events-none">
              {showLogo ? (
                <img
                  src={series.logoUrl!}
                  alt={series.title}
                  onError={() => setLogoFailed(true)}
                  className="max-w-[220px] sm:max-w-[320px] md:max-w-[400px] max-h-[80px] sm:max-h-[120px] md:max-h-[150px] w-auto h-auto object-contain object-left-bottom drop-shadow-lg"
                />
              ) : (
                <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-fg leading-tight">
                  {series.title}
                </h1>
              )}
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col justify-end px-4 sm:px-8 md:px-12 lg:px-16 pb-8 bg-gradient-to-br from-card via-zinc-900/60 to-bg">
            {showLogo ? (
              <img
                src={series.logoUrl!}
                alt={series.title}
                onError={() => setLogoFailed(true)}
                className="max-w-[220px] sm:max-w-[320px] md:max-w-[400px] max-h-[80px] sm:max-h-[120px] md:max-h-[150px] w-auto h-auto object-contain object-left-bottom drop-shadow-lg"
              />
            ) : (
              <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-fg leading-tight">
                {series.title}
              </h1>
            )}
          </div>
        )}
      </div>

      {/* Metadata & Actions Section (Rendered below artwork with home-aligned padding) */}
      <div className="relative z-20 px-4 sm:px-8 md:px-12 lg:px-16 pt-6 pb-2 space-y-4">
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

        {/* Primary Call To Action Button */}
        <div className="pt-1">
          <Button
            ref={playRef}
            size="lg"
            onClick={onPlay}
            disabled={isPlayDisabled}
            className={`gap-2 text-sm sm:text-base font-semibold px-6 py-2.5 shadow-lg shadow-indigo-500/10 ${
              isSpatialMode && isPlayFocused ? 'ring-2 ring-white' : ''
            }`}
            aria-label="Play Episode 1"
          >
            <Play className="h-4 w-4 sm:h-5 sm:w-5 fill-current" />
            <span>Play Episode 1</span>
          </Button>
        </div>

        {/* Series Description (Readable max-w-4xl width) */}
        {series.description ? (
          <p className="text-sm sm:text-base leading-relaxed text-muted max-w-4xl pt-1">
            {series.description}
          </p>
        ) : (
          <p className="text-sm italic text-muted/60 max-w-4xl pt-1">
            No synopsis available for this series.
          </p>
        )}
      </div>
    </div>
  );
}
