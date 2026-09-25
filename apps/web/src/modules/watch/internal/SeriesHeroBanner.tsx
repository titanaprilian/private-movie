import { useState } from 'react';
import { Play, Star } from 'lucide-react';
import type { WatchSeriesDetails } from './api';

export interface SeriesHeroBannerProps {
  series: WatchSeriesDetails;
  onPlay: () => void;
  /** @deprecated Back navigation is hoisted to the watch view shell (WatchTopNav). Kept for compat. */
  onBack?: () => void;
  isPlayDisabled?: boolean;
  isSpatialMode?: boolean;
  isPlayFocused?: boolean;
  /** @deprecated Back navigation is hoisted to the watch view shell (WatchTopNav). Kept for compat. */
  isBackFocused?: boolean;
  /** @deprecated Back navigation is hoisted to the watch view shell (WatchTopNav). Kept for compat. */
  backRef?: React.Ref<HTMLButtonElement | HTMLAnchorElement>;
  playRef?: React.Ref<HTMLButtonElement>;
}

/** Max genres shown on mobile viewports; extras reveal on md+ screens. */
export const WATCH_HERO_MOBILE_GENRE_CAP = 2;

export function SeriesHeroBanner({
  series,
  onPlay,
  isPlayDisabled,
  isSpatialMode,
  isPlayFocused,
  playRef,
}: SeriesHeroBannerProps) {
  const [failedSrcs, setFailedSrcs] = useState<string[]>([]);
  const [logoFailed, setLogoFailed] = useState(false);

  // Dual artwork strategy (home feed parity):
  // mobile (< md) prefers the portrait poster, desktop (>= md) the wide backdrop.
  const pickArtwork = (
    primary: string | null,
    secondary: string | null
  ): string | null => {
    if (primary && !failedSrcs.includes(primary)) return primary;
    if (secondary && !failedSrcs.includes(secondary)) return secondary;
    return null;
  };

  const mobileImage = pickArtwork(series.posterUrl, series.backdropUrl);
  const desktopImage = pickArtwork(series.backdropUrl, series.posterUrl);

  const markFailed = (src: string) =>
    setFailedSrcs((prev) => (prev.includes(src) ? prev : [...prev, src]));

  const showLogo = Boolean(series.logoUrl && !logoFailed);

  // Extract genre names
  const genreNames: string[] = Array.isArray(series.genres)
    ? series.genres.map((g) => (typeof g === 'string' ? g : g.name))
    : [];
  const mobileGenres = genreNames.slice(0, WATCH_HERO_MOBILE_GENRE_CAP);
  const extraGenres = genreNames.slice(WATCH_HERO_MOBILE_GENRE_CAP);

  const seasons = series.seasons ?? [];
  const seasonCount = seasons.length;
  const episodeCount =
    seasons.reduce((total, s) => total + (s.episodes?.length ?? 0), 0) +
    (series.episodes?.length ?? 0);

  const releaseYear = (() => {
    if (!series.createdAt) return null;
    const year = new Date(series.createdAt).getFullYear();
    return Number.isNaN(year) ? null : year;
  })();

  const formattedRating = (() => {
    if (!series.rating) return null;
    const numeric = Number(series.rating);
    return !Number.isNaN(numeric) ? numeric.toFixed(1) : series.rating;
  })();

  return (
    <div
      data-testid="series-hero-banner"
      className="relative w-full overflow-hidden"
    >
      {/* Cinematic Hero Artwork Container (Full-bleed edge-to-edge).
          65dvh on mobile for portrait poster breathing room while teasing
          the episode explorer below the fold; full cinematic height on desktop. */}
      <div
        data-testid="hero-artwork"
        className="relative h-[65dvh] md:h-[85vh] min-h-[420px] md:min-h-[550px] w-full bg-zinc-950 overflow-hidden"
      >
        {mobileImage ? (
          <img
            src={mobileImage}
            alt={series.title}
            data-testid="hero-bg-mobile"
            onError={() => markFailed(mobileImage)}
            className="absolute inset-0 h-full w-full object-cover object-center md:hidden"
          />
        ) : null}
        {desktopImage ? (
          <img
            src={desktopImage}
            alt={series.title}
            data-testid="hero-bg-desktop"
            onError={() => markFailed(desktopImage)}
            className="absolute inset-0 h-full w-full object-cover object-center hidden md:block"
          />
        ) : null}

        {/* Multi-stop dark vignette gradients (home feed aesthetic) */}
        <div
          data-testid="hero-gradient-bottom"
          className="absolute inset-0 bg-gradient-to-t from-black md:from-black/90 via-black via-[45%] md:via-black/60 to-transparent z-10 pointer-events-none"
        />
        <div
          data-testid="hero-gradient-left"
          className="hidden md:block absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent z-10 pointer-events-none"
        />

        {/* Overlay content: centered on mobile, left-aligned on desktop */}
        <div className="absolute bottom-12 left-0 z-20 w-full px-4 sm:px-8 md:px-12 lg:px-16">
          <div
            data-testid="hero-content"
            className="max-w-3xl mx-auto md:mx-0 space-y-4 flex flex-col items-center text-center md:items-start md:text-left"
          >
            {/* Series logo with high-contrast bold title fallback */}
            {showLogo ? (
              <img
                src={series.logoUrl!}
                alt={series.title}
                data-testid="hero-logo"
                onError={() => setLogoFailed(true)}
                className="mx-auto md:mx-0 max-w-[220px] sm:max-w-[320px] md:max-w-[400px] max-h-[80px] sm:max-h-[120px] md:max-h-[150px] w-auto h-auto object-contain object-center md:object-left-bottom drop-shadow-md"
              />
            ) : (
              <h1 className="text-center md:text-left text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white leading-tight drop-shadow-md">
                <span data-testid="hero-title-text">{series.title}</span>
              </h1>
            )}

            {/* Metadata row: rating, year, season/episode counts, dot-separated genres */}
            <div
              data-testid="hero-meta"
              className="flex items-center justify-center md:justify-start gap-3 text-sm text-zinc-300 flex-wrap"
            >
              {formattedRating && (
                <span
                  data-testid="hero-rating"
                  className="inline-flex items-center gap-1 font-semibold text-yellow-400"
                >
                  <Star
                    className="w-4 h-4 fill-yellow-400 text-yellow-400"
                    aria-hidden="true"
                  />
                  <span>{formattedRating}</span>
                </span>
              )}

              {releaseYear !== null && <span>{releaseYear}</span>}

              {seasonCount > 0 && (
                <span data-testid="hero-seasons-episodes">
                  {seasonCount} {seasonCount === 1 ? 'Season' : 'Seasons'}{' '}
                  <span>
                    {episodeCount} {episodeCount === 1 ? 'Episode' : 'Episodes'}
                  </span>
                </span>
              )}

              {genreNames.length > 0 && (
                <span
                  data-testid="hero-genres"
                  className="inline-flex items-center gap-2 text-sm text-zinc-300"
                >
                  {mobileGenres.map((genre, genreIdx) => (
                    <span key={genre} className="flex items-center gap-2">
                      {genreIdx > 0 && (
                        <span aria-hidden="true" className="text-zinc-600">
                          •
                        </span>
                      )}
                      <span>{genre}</span>
                    </span>
                  ))}
                  {extraGenres.length > 0 && (
                    <span
                      data-testid="hero-genres-extra"
                      className="hidden md:inline-flex items-center gap-2"
                    >
                      {extraGenres.map((genre) => (
                        <span key={genre} className="flex items-center gap-2">
                          <span aria-hidden="true" className="text-zinc-600">
                            •
                          </span>
                          <span>{genre}</span>
                        </span>
                      ))}
                    </span>
                  )}
                </span>
              )}
            </div>

            {/* Series synopsis: hidden on mobile, line-clamped on desktop */}
            {series.description ? (
              <p
                data-testid="hero-synopsis"
                className="hidden md:line-clamp-3 text-zinc-300 text-base md:text-lg leading-relaxed max-w-2xl"
              >
                {series.description}
              </p>
            ) : (
              <p
                data-testid="hero-synopsis"
                className="hidden md:block text-sm italic text-zinc-500 max-w-2xl"
              >
                No synopsis available for this series.
              </p>
            )}

            {/* Primary Call To Action: full-width on mobile, auto on desktop */}
            <div className="pt-2 w-full md:w-auto">
              <button
                ref={playRef}
                type="button"
                onClick={onPlay}
                disabled={isPlayDisabled}
                data-testid="hero-play"
                aria-label="Play Episode 1"
                className={`inline-flex w-full md:w-auto items-center justify-center gap-2 bg-white text-black px-7 py-3 rounded-md text-base font-semibold hover:bg-zinc-200 transition-colors shadow-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                  isSpatialMode && isPlayFocused
                    ? 'ring-2 ring-white ring-offset-2 ring-offset-black'
                    : ''
                }`}
              >
                <Play className="h-5 w-5 fill-black text-black" aria-hidden="true" />
                <span>Play Episode 1</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
