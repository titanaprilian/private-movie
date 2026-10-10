import { useState } from 'react';
import { Play, ChevronLeft, ChevronRight, Sparkles, Star } from 'lucide-react';
import { ChunkyButton } from '@/components/ui/chunky-button';
import { ChunkyCard } from '@/components/ui/chunky-card';
import type { SeriesItem } from '../types';

function HeroTitle({
  title,
  logoUrl,
}: {
  title: string;
  logoUrl?: string | null;
}) {
  const [logoFailed, setLogoFailed] = useState(false);
  const showLogo = !!logoUrl && !logoFailed;

  return (
    <h1 className="font-display text-center md:text-left text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white leading-tight drop-shadow-md">
      {showLogo ? (
        <img
          src={logoUrl as string}
          alt={`${title} logo`}
          data-testid="hero-logo"
          onError={() => setLogoFailed(true)}
          className="mx-auto md:mx-0 max-h-24 sm:max-h-28 md:max-h-36 w-auto max-w-full object-contain object-center md:object-left"
        />
      ) : (
        <span data-testid="hero-title-text" className="hero-text-shadow">
          {title}
        </span>
      )}
    </h1>
  );
}

function PaginationDots({
  heroes,
  activeIndex,
  onSelect,
}: {
  heroes: SeriesItem[];
  activeIndex: number;
  onSelect: (idx: number) => void;
}) {
  return (
    <>
      {heroes.map((item, idx) => (
        <button
          key={`dot-${item.id}-${idx}`}
          onClick={() => onSelect(idx)}
          aria-label={`Go to slide ${idx + 1}`}
          className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
            idx === activeIndex
              ? 'w-6 bg-white'
              : 'w-2 bg-white/40 hover:bg-white/70'
          }`}
        />
      ))}
    </>
  );
}

export function HomeHeroSlider({
  heroes,
  activeIndex,
  onSelectIndex,
  onPrev,
  onNext,
  onPauseChange,
  isSpatialMode,
  focusedRow,
  focusedItem,
  onPlay,
  onMoreInfo,
}: {
  heroes: SeriesItem[];
  activeIndex: number;
  onSelectIndex: (idx: number) => void;
  onPrev: () => void;
  onNext: () => void;
  onPauseChange: (paused: boolean) => void;
  isSpatialMode: boolean;
  focusedRow: number;
  focusedItem: number;
  onPlay: (seriesId: string) => void;
  onMoreInfo: () => void;
}) {
  const currentHero = heroes[activeIndex] || null;
  const heroCount = heroes.length;

  if (!currentHero) {
    return (
      <div
        data-testid="hero-empty"
        className="relative h-[40vh] min-h-[300px] w-full bg-[var(--bg)] flex items-center justify-center text-center p-8"
      >
        <ChunkyCard className="p-8 space-y-3 max-w-md">
          <Sparkles className="w-8 h-8 text-[var(--muted)] mx-auto" />
          <h2 className="font-display text-xl font-semibold text-[var(--ink)]">
            No Featured Series Available
          </h2>
          <p className="text-sm text-[var(--muted)] max-w-md">
            Check back soon for new anime releases and home feed updates.
          </p>
        </ChunkyCard>
      </div>
    );
  }

  return (
    <div
      data-testid="hero-slider"
      onMouseEnter={() => onPauseChange(true)}
      onMouseLeave={() => onPauseChange(false)}
      onFocus={() => onPauseChange(true)}
      onBlur={() => onPauseChange(false)}
      className="relative h-[100dvh] md:h-[85vh] min-h-[550px] w-full bg-[var(--bg)] overflow-hidden group/hero"
    >
      {/* Background Banner Images with Smooth Crossfade.
          Mobile renders the portrait poster full-bleed; desktop renders the wide banner. */}
      {heroes.map((item, idx) => (
        <div key={item.id} className="absolute inset-0">
          <div
            data-testid="hero-bg-mobile"
            data-hero-id={item.id}
            className={`absolute inset-0 bg-cover bg-center md:hidden transition-opacity duration-1000 ease-in-out ${
              idx === activeIndex ? 'opacity-100' : 'opacity-0'
            }`}
            style={{ backgroundImage: `url(${item.posterUrl})` }}
          />
          <div
            data-testid="hero-bg-desktop"
            data-hero-id={item.id}
            className={`absolute inset-0 bg-cover bg-center hidden md:block transition-opacity duration-1000 ease-in-out ${
              idx === activeIndex ? 'opacity-100' : 'opacity-0'
            }`}
            style={{ backgroundImage: `url(${item.bannerUrl})` }}
          />
        </div>
      ))}

      {/* Gradient overlays. Mobile keeps the tall bottom fade (portrait poster needs it).
          Desktop uses a short bottom fade plus a left fade that ends before the middle,
          so the artwork stays bright. Both fade into var(--bg), reaching 100% at the bottom edge. */}
      <div
        data-testid="hero-gradient-bottom-mobile"
        className="md:hidden absolute inset-0 bg-gradient-to-t from-[var(--bg)] via-[color-mix(in_srgb,var(--bg)_75%,black)] via-[35%] to-transparent z-10 pointer-events-none"
      />
      <div
        data-testid="hero-gradient-bottom"
        className="hidden md:block hero-fade-bottom absolute inset-0 z-10 pointer-events-none"
      />
      <div
        data-testid="hero-gradient-left"
        className="hidden md:block hero-fade-left absolute inset-0 z-10 pointer-events-none"
      />

      {/* Hero Content */}
      <div className="absolute bottom-12 left-0 z-20 w-full px-8 md:px-16 text-left">
        <div
          data-testid="hero-content"
          className="max-w-3xl mx-auto md:mx-0 space-y-4 flex flex-col items-center text-center md:items-start md:text-left"
        >
          {/* Title (series logo image with text fallback) */}
          <HeroTitle
            key={currentHero.id}
            title={currentHero.title}
            logoUrl={currentHero.logoUrl}
          />

          {/* Meta Row (rating first, genres inline) */}
          <div
            data-testid="hero-meta"
            className="flex items-center justify-center md:justify-start gap-3 text-sm text-zinc-300 flex-wrap hero-text-shadow"
          >
            <span
              data-testid="hero-rating"
              className="inline-flex items-center gap-1 font-semibold text-yellow-400"
            >
              <Star
                className="w-4 h-4 fill-yellow-400 text-yellow-400"
                aria-hidden="true"
              />
              <span>{currentHero.rating}</span>
            </span>
            <span>{currentHero.year}</span>
            <span data-testid="hero-seasons-episodes">
              {currentHero.seasons}{' '}
              {currentHero.seasons === 1 ? 'Season' : 'Seasons'}{' '}
              <span
                data-testid="hero-episodes"
                className="hidden md:inline"
              >
                {currentHero.episodes}{' '}
                {currentHero.episodes === 1 ? 'Episode' : 'Episodes'}
              </span>
            </span>
            <span
              data-testid="hero-genres"
              className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-zinc-300"
            >
              {currentHero.genres.slice(0, 3).map((genre, genreIdx) => (
                <span
                  key={genre}
                  className="flex items-center gap-2 uppercase font-bold tracking-wide"
                >
                  {genreIdx > 0 && (
                    <span aria-hidden="true" className="text-zinc-600">
                      •
                    </span>
                  )}
                  <span>{genre}</span>
                </span>
              ))}
            </span>
          </div>

          {/* Synopsis (hidden on mobile, truncated on desktop) */}
          <p
            data-testid="hero-synopsis"
            className="hidden md:line-clamp-3 text-zinc-300 text-base md:text-lg leading-relaxed max-w-2xl hero-text-shadow"
          >
            {currentHero.synopsis}
          </p>

          {/* Pagination Dots (mobile: in-flow above the Play button) */}
          {heroCount > 1 && (
            <div
              data-testid="hero-pagination-mobile"
              className="flex md:hidden items-center justify-center gap-2 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-zinc-800/80"
            >
              <PaginationDots
                heroes={heroes}
                activeIndex={activeIndex}
                onSelect={onSelectIndex}
              />
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center md:justify-start gap-4 pt-4 w-full md:w-auto">
            <ChunkyButton
              data-testid="hero-play"
              data-nav-row={0}
              data-nav-item={0}
              onClick={() => onPlay(currentHero.id)}
              className={`w-full md:w-auto ${
                isSpatialMode && focusedRow === 0 && focusedItem === 0
                  ? 'ring-2 ring-white'
                  : ''
              }`}
            >
              <Play className="w-5 h-5 fill-white text-white" />
              <span>Play</span>
            </ChunkyButton>
            <ChunkyButton
              variant="translucent"
              data-testid="hero-more-info"
              onClick={onMoreInfo}
              className="w-full md:w-auto"
            >
              <span>More Info</span>
            </ChunkyButton>
          </div>
        </div>
      </div>

      {/* Navigation Arrows & Pagination Indicators (Only when heroCount > 1) */}
      {heroCount > 1 && (
        <>
          {/* Left Navigation Arrow */}
          <ChunkyButton
            size="icon"
            variant="translucent"
            onClick={onPrev}
            aria-label="Previous slide"
            className="absolute left-4 top-1/2 -translate-y-1/2 z-30 opacity-0 group-hover/hero:opacity-100 transition-all duration-300"
          >
            <ChevronLeft className="w-6 h-6" />
          </ChunkyButton>

          {/* Right Navigation Arrow */}
          <ChunkyButton
            size="icon"
            variant="translucent"
            onClick={onNext}
            aria-label="Next slide"
            className="absolute right-4 top-1/2 -translate-y-1/2 z-30 opacity-0 group-hover/hero:opacity-100 transition-all duration-300"
          >
            <ChevronRight className="w-6 h-6" />
          </ChunkyButton>

          {/* Pagination Dots (desktop: bottom-right corner) */}
          <div
            data-testid="hero-pagination-desktop"
            className="hidden md:flex absolute bottom-6 right-8 md:right-16 z-30 items-center gap-2 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-zinc-800/80"
          >
            <PaginationDots
              heroes={heroes}
              activeIndex={activeIndex}
              onSelect={onSelectIndex}
            />
          </div>
        </>
      )}
    </div>
  );
}
