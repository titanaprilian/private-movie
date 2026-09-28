import { useRef, useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import {
  Play,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  AlertTriangle,
  RefreshCw,
  Star,
} from 'lucide-react';
import { useInputMode } from '@/hooks/useInputMode';
import { PublicNavbar } from '@/modules/navigation';
import { RecentEpisodeCard, SeriesDetailDialog, SeriesPosterCard } from '@/modules/videos';
import { useHomeFeedNav } from './useHomeFeedNav';
import {
  homeFeedQueryOptions,
  type MediaRecentlyAddedEpisode,
  type MediaSeriesMetadata,
  type MediaHomeFeedHero,
} from './api';

export interface SeriesItem {
  id: string;
  title: string;
  synopsis: string;
  posterUrl: string;
  bannerUrl: string;
  logoUrl?: string | null;
  type: string;
  matchScore: string;
  year: number;
  rating: string;
  seasons: number;
  episodes: number;
  subDub: 'SUB' | 'DUB' | 'SUB | DUB';
  genres: string[];
}

export interface CarouselRowData {
  id: string;
  title: string;
  items: SeriesItem[];
}

const EPISODE_THUMBNAIL_PLACEHOLDER =
  'https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=1200&auto=format&fit=crop';

function episodeBadge(seasonNumber: number | null, order: number): string {
  if (seasonNumber !== null && seasonNumber !== undefined) {
    return `S${seasonNumber} E${order}`;
  }
  return `EP ${order}`;
}

function resolveEpisodeThumbnail(ep: MediaRecentlyAddedEpisode): string {
  return (
    ep.thumbnailUrl ||
    ep.series.backdropUrl ||
    ep.series.posterUrl ||
    EPISODE_THUMBNAIL_PLACEHOLDER
  );
}

function RecentlyAddedEpisodesRow({ episodes }: { episodes: MediaRecentlyAddedEpisode[] }) {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (!containerRef.current) return;
    const scrollAmount = direction === 'left' ? -600 : 600;
    if (typeof containerRef.current.scrollBy === 'function') {
      containerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    } else {
      containerRef.current.scrollLeft += scrollAmount;
    }
  };

  return (
    <div className="relative group/row my-6">
      <h2 className="text-xl md:text-2xl font-bold mb-3 text-[var(--ink)] flex items-center gap-2 px-8 md:px-16">
        <span>Recently Added Episodes</span>
        <ChevronRight className="w-5 h-5 text-[var(--muted)] opacity-0 group-hover/row:opacity-100 transition-opacity" />
      </h2>

      <div className="relative px-8 md:px-16">
        {/* Left Scroll Button */}
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-0 bottom-0 z-40 w-12 bg-[color-mix(in_srgb,var(--bg)_60%,transparent)] hover:bg-[color-mix(in_srgb,var(--bg)_90%,transparent)] flex items-center justify-center text-white opacity-0 group-hover/row:opacity-100 transition-all duration-200"
          aria-label="Scroll Recently Added Episodes left"
        >
          <ChevronLeft className="w-8 h-8" />
        </button>

        {/* Horizontal Carousel Container */}
        <div
          ref={containerRef}
          className="flex gap-4 overflow-x-auto py-4 scrollbar-none scroll-smooth snap-x snap-mandatory"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {episodes.map((ep) => (
            <RecentEpisodeCard
              key={ep.id}
              episodeId={ep.id}
              seriesId={ep.series.id}
              title={ep.title}
              seriesTitle={ep.series.title}
              thumbnailUrl={resolveEpisodeThumbnail(ep)}
              badgeLabel={episodeBadge(ep.season.seasonNumber, ep.order)}
              onSelect={({ episodeId, seriesId }) =>
                navigate({
                  to: '/watch/$seriesId',
                  params: { seriesId },
                  search: { ep: episodeId },
                })
              }
            />
          ))}
        </div>

        {/* Right Scroll Button */}
        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-0 bottom-0 z-40 w-12 bg-[color-mix(in_srgb,var(--bg)_60%,transparent)] hover:bg-[color-mix(in_srgb,var(--bg)_90%,transparent)] flex items-center justify-center text-white opacity-0 group-hover/row:opacity-100 transition-all duration-200"
          aria-label="Scroll Recently Added Episodes right"
        >
          <ChevronRight className="w-8 h-8" />
        </button>
      </div>
    </div>
  );
}

function mapSeriesToSeriesItem(s: MediaSeriesMetadata): SeriesItem {
  const genres = s.genres && s.genres.length > 0 ? s.genres.map((g) => g.name) : [];
  const year = s.createdAt ? new Date(s.createdAt).getFullYear() : 2026;
  const rawRating = s.rating || (s.type === 'movie' ? '7.5' : '8.0');
  const rating = !isNaN(Number(rawRating)) ? Number(rawRating).toFixed(1) : rawRating;
  const type = (s.type || 'tv').toUpperCase();
  const posterUrl =
    s.posterUrl ||
    s.backdropUrl ||
    'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?q=80&w=800&auto=format&fit=crop';
  const bannerUrl =
    s.backdropUrl ||
    s.posterUrl ||
    'https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=1200&auto=format&fit=crop';

  return {
    id: s.id,
    title: s.title,
    synopsis: s.description || 'No description available for this series.',
    posterUrl,
    bannerUrl,
    logoUrl: s.logoUrl ?? null,
    type,
    matchScore: '98% Match',
    year,
    rating,
    seasons: s.seasonsCount ?? 0,
    episodes: s.episodesCount ?? 0,
    subDub: 'SUB | DUB',
    genres,
  };
}

function mapHeroToSeriesItem(hero: MediaHomeFeedHero): SeriesItem {
  const base = mapSeriesToSeriesItem(hero);
  if (hero.tags && hero.tags.length > 0) {
    return {
      ...base,
      genres: hero.tags,
    };
  }
  return base;
}

function HomeFeedHeroSkeleton() {
  return (
    <div
      data-testid="hero-skeleton"
      aria-busy="true"
      aria-label="Loading featured series"
      className="relative h-[100dvh] md:h-[85vh] min-h-[550px] w-full bg-[var(--bg)] animate-pulse flex items-end p-8 md:p-16"
    >
      <div className="max-w-3xl space-y-4 w-full">
        <div className="h-4 w-32 bg-[var(--surface-raised)] rounded" />
        <div className="h-12 w-3/4 bg-[var(--surface-raised)] rounded" />
        <div className="flex gap-3">
          <div className="h-4 w-20 bg-[var(--surface-raised)] rounded" />
          <div className="h-4 w-16 bg-[var(--surface-raised)] rounded" />
          <div className="h-4 w-24 bg-[var(--surface-raised)] rounded" />
        </div>
        <div className="h-16 w-full max-w-xl bg-[var(--surface-raised)] rounded" />
        <div className="flex gap-4 pt-2">
          <div className="h-12 w-28 bg-[var(--surface-raised)] rounded-md" />
          <div className="h-12 w-32 bg-[var(--surface-raised)] rounded-md" />
        </div>
      </div>
    </div>
  );
}

function HomeFeedRowSkeleton() {
  return (
    <div
      data-testid="carousel-row-skeleton"
      aria-busy="true"
      aria-label="Loading catalog rows"
      className="my-6 px-8 md:px-16 space-y-3"
    >
      <div className="h-7 w-48 bg-[var(--surface-raised)] rounded animate-pulse" />
      <div className="flex gap-4 overflow-hidden py-2">
        {Array.from({ length: 5 }).map((_, idx) => (
          <div
            key={idx}
            className="w-[160px] sm:w-[180px] aspect-[2/3] flex-shrink-0 bg-[var(--surface)] border border-[var(--border)] rounded-md animate-pulse"
          />
        ))}
      </div>
    </div>
  );
}

function HomeFeedErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      data-testid="home-feed-error"
      className="min-h-screen bg-[var(--bg)] text-[var(--ink)] flex items-center justify-center p-6"
    >
      <div className="max-w-md w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg p-8 text-center space-y-4 shadow-2xl">
        <div className="w-12 h-12 rounded-full bg-red-950/80 border border-red-800 text-red-500 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-[var(--ink)]">Unable to Load Home Feed</h2>
        <p className="text-sm text-[var(--muted)] leading-relaxed">
          We encountered an issue connecting to the backend server. Please check your network connection or try again.
        </p>
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-medium px-5 py-2.5 rounded-md transition-colors shadow-md text-sm cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Retry Connection</span>
        </button>
      </div>
    </div>
  );
}

function HeroTitle({ title, logoUrl }: { title: string; logoUrl?: string | null }) {
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
        <span data-testid="hero-title-text">{title}</span>
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

function CarouselRowComponent({
  row,
  rowIndex,
  focusedRow,
  focusedItem,
  isSpatialMode,
}: {
  row: CarouselRowData;
  rowIndex: number;
  focusedRow: number;
  focusedItem: number;
  isSpatialMode: boolean;
}) {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (!containerRef.current) return;
    const scrollAmount = direction === 'left' ? -600 : 600;
    if (typeof containerRef.current.scrollBy === 'function') {
      containerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    } else {
      containerRef.current.scrollLeft += scrollAmount;
    }
  };

  return (
    <div className="relative group/row my-6">
      <h2 className="text-xl md:text-2xl font-bold mb-3 text-[var(--ink)] flex items-center gap-2 px-8 md:px-16">
        <span>{row.title}</span>
        <ChevronRight className="w-5 h-5 text-[var(--muted)] opacity-0 group-hover/row:opacity-100 transition-opacity" />
      </h2>

      <div className="relative px-8 md:px-16">
        {/* Left Scroll Button */}
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-0 bottom-0 z-40 w-12 bg-[color-mix(in_srgb,var(--bg)_60%,transparent)] hover:bg-[color-mix(in_srgb,var(--bg)_90%,transparent)] flex items-center justify-center text-white opacity-0 group-hover/row:opacity-100 transition-all duration-200"
          aria-label={`Scroll ${row.title} left`}
        >
          <ChevronLeft className="w-8 h-8" />
        </button>

        {/* Horizontal Carousel Container */}
        <div
          ref={containerRef}
          className="flex gap-4 overflow-x-auto py-4 scrollbar-none scroll-smooth snap-x snap-mandatory"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {row.items.map((item, idx) => {
            const isFocused = isSpatialMode && focusedRow === rowIndex && focusedItem === idx;

            return (
              <div
                key={`${row.id}-${item.id}-${idx}`}
                data-nav-row={rowIndex}
                data-nav-item={idx}
              >
                <SeriesPosterCard
                  seriesId={item.id}
                  title={item.title}
                  posterUrl={item.posterUrl}
                  type={item.type}
                  seasonsCount={item.seasons}
                  rating={item.rating}
                  focused={isFocused}
                  onSelect={(seriesId) =>
                    navigate({ to: '/watch/$seriesId', params: { seriesId } })
                  }
                />
              </div>
            );
          })}
        </div>

        {/* Right Scroll Button */}
        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-0 bottom-0 z-40 w-12 bg-[color-mix(in_srgb,var(--bg)_60%,transparent)] hover:bg-[color-mix(in_srgb,var(--bg)_90%,transparent)] flex items-center justify-center text-white opacity-0 group-hover/row:opacity-100 transition-all duration-200"
          aria-label={`Scroll ${row.title} right`}
        >
          <ChevronRight className="w-8 h-8" />
        </button>
      </div>
    </div>
  );
}

export function CinematicHome({ genreSlug }: { genreSlug?: string } = {}) {
  const navigate = useNavigate();
  const { isSpatialMode } = useInputMode();

  const { data, isLoading, isError, refetch } = useQuery(homeFeedQueryOptions(genreSlug));

  const heroesList: SeriesItem[] = data?.heroes && data.heroes.length > 0
    ? data.heroes.map(mapHeroToSeriesItem)
    : data?.hero
      ? [mapHeroToSeriesItem(data.hero)]
      : [];

  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

  const heroCount = heroesList.length;

  const nextSlide = useCallback(() => {
    if (heroCount <= 1) return;
    setActiveIndex((prev) => (prev + 1) % heroCount);
  }, [heroCount]);

  const prevSlide = useCallback(() => {
    if (heroCount <= 1) return;
    setActiveIndex((prev) => (prev - 1 + heroCount) % heroCount);
  }, [heroCount]);

  useEffect(() => {
    if (heroCount <= 1 || isPaused) return;
    const interval = setInterval(() => {
      nextSlide();
    }, 6000);
    return () => clearInterval(interval);
  }, [heroCount, isPaused, nextSlide]);

  const currentHero = heroesList[activeIndex] || null;

  const carouselRows: CarouselRowData[] =
    data?.rows
      .filter((r) => r.title.trim().toLowerCase() !== 'recently added')
      .map((r, idx) => ({
        id: `row-${idx}-${r.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        title: r.title,
        items: r.items.map(mapSeriesToSeriesItem),
      })) ?? [];

  const recentlyAddedEpisodes: MediaRecentlyAddedEpisode[] =
    data?.recentlyAddedEpisodes ?? [];

  const { focusedRow, focusedItem } = useHomeFeedNav({
    heroSeriesId: currentHero?.id,
    rows: carouselRows,
    onSelectSeries: (seriesId) => navigate({ to: '/watch/$seriesId', params: { seriesId } }),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)] overflow-x-clip font-sans">
        <PublicNavbar />
        <HomeFeedHeroSkeleton />
        <div className="relative z-30 pb-20 -mt-10 space-y-4">
          <HomeFeedRowSkeleton />
          <HomeFeedRowSkeleton />
          <HomeFeedRowSkeleton />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)] overflow-x-clip font-sans">
        <PublicNavbar />
        <HomeFeedErrorState onRetry={() => refetch()} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)] overflow-x-clip font-sans selection:bg-red-600 selection:text-white">
      <PublicNavbar />
      {/* Hero Banner / Slider Section */}
      {currentHero ? (
        <div
          data-testid="hero-slider"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          onFocus={() => setIsPaused(true)}
          onBlur={() => setIsPaused(false)}
          className="relative h-[100dvh] md:h-[85vh] min-h-[550px] w-full bg-[var(--bg)] overflow-hidden rounded-b-[32px] group/hero"
        >
          {/* Background Banner Images with Smooth Crossfade.
              Mobile renders the portrait poster full-bleed; desktop renders the wide banner. */}
          {heroesList.map((item, idx) => (
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

          {/* Gradient overlays for cinematic effect.
              Solid black across the bottom half fading out toward the top, so
              the text area stays readable even over light artwork. Desktop
              uses slightly lighter stops. The left-originating overlay is
              desktop-only. */}
          <div
            data-testid="hero-gradient-bottom"
            className="absolute inset-0 bg-gradient-to-t from-[var(--bg)] md:from-[color-mix(in_srgb,var(--bg)_95%,transparent)] via-[color-mix(in_srgb,var(--bg)_75%,black)] via-[35%] md:via-[color-mix(in_srgb,var(--bg)_75%,transparent)] to-transparent z-10 pointer-events-none"
          />
          <div
            data-testid="hero-gradient-left"
            className="hidden md:block absolute inset-0 bg-gradient-to-r from-[color-mix(in_srgb,var(--bg)_92%,transparent)] via-[color-mix(in_srgb,var(--bg)_65%,transparent)] to-transparent z-10 pointer-events-none"
          />

          {/* Hero Content */}
          <div className="absolute bottom-12 left-0 z-20 w-full px-8 md:px-16 text-left">
            <div data-testid="hero-content" className="max-w-3xl mx-auto md:mx-0 space-y-4 flex flex-col items-center text-center md:items-start md:text-left">
              {/* Title (series logo image with text fallback) */}
              <HeroTitle
                key={currentHero.id}
                title={currentHero.title}
                logoUrl={currentHero.logoUrl}
              />

              {/* Meta Row (rating first, genres inline) */}
              <div data-testid="hero-meta" className="flex items-center justify-center md:justify-start gap-3 text-sm text-zinc-300 flex-wrap">
                <span
                  data-testid="hero-rating"
                  className="inline-flex items-center gap-1 font-semibold text-yellow-400"
                >
                  <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" aria-hidden="true" />
                  <span>{currentHero.rating}</span>
                </span>
                <span>{currentHero.year}</span>
                <span data-testid="hero-seasons-episodes">
                  {currentHero.seasons} {currentHero.seasons === 1 ? 'Season' : 'Seasons'}{' '}
                  <span data-testid="hero-episodes" className="hidden md:inline">
                    {currentHero.episodes} {currentHero.episodes === 1 ? 'Episode' : 'Episodes'}
                  </span>
                </span>
                <span data-testid="hero-genres" className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-zinc-300">
                  {currentHero.genres.slice(0, 3).map((genre, genreIdx) => (
                    <span key={genre} className="flex items-center gap-2 uppercase font-bold tracking-wide">
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
              <p data-testid="hero-synopsis" className="hidden md:line-clamp-3 text-zinc-300 text-base md:text-lg leading-relaxed max-w-2xl text-shadow">
                {currentHero.synopsis}
              </p>

              {/* Pagination Dots (mobile: in-flow above the Play button) */}
              {heroCount > 1 && (
                <div
                  data-testid="hero-pagination-mobile"
                  className="flex md:hidden items-center justify-center gap-2 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-zinc-800/80"
                >
                  <PaginationDots
                    heroes={heroesList}
                    activeIndex={activeIndex}
                    onSelect={setActiveIndex}
                  />
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center md:justify-start gap-4 pt-4 w-full md:w-auto">
                <button
                  data-testid="hero-play"
                  data-nav-row={0}
                  data-nav-item={0}
                  onClick={() => navigate({ to: '/watch/$seriesId', params: { seriesId: currentHero.id } })}
                  className={`w-full md:w-auto justify-center bg-[var(--green)] text-white px-7 py-3 rounded-2xl text-base font-extrabold shadow-[0_5px_0_var(--green-dark)] active:translate-y-1 active:shadow-[0_1px_0_var(--green-dark)] hover:brightness-105 transition-all flex items-center gap-2 cursor-pointer ${
                    isSpatialMode && focusedRow === 0 && focusedItem === 0 ? 'ring-2 ring-white' : ''
                  }`}
                >
                  <Play className="w-5 h-5 fill-white text-white" />
                  <span>Play</span>
                </button>
                <button
                  data-testid="hero-more-info"
                  onClick={() => setDetailOpen(true)}
                  className="w-full md:w-auto justify-center bg-white/20 text-white backdrop-blur-sm px-7 py-3 rounded-2xl text-base font-extrabold shadow-[0_5px_0_rgba(0,0,0,0.2)] active:translate-y-1 active:shadow-[0_1px_0_rgba(0,0,0,0.2)] hover:bg-white/30 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <span>More Info</span>
                </button>
              </div>
            </div>
          </div>

          {/* Navigation Arrows & Pagination Indicators (Only when heroCount > 1) */}
          {heroCount > 1 && (
            <>
              {/* Left Navigation Arrow */}
              <button
                onClick={prevSlide}
                aria-label="Previous slide"
                className="absolute left-4 top-1/2 -translate-y-1/2 z-30 p-3 rounded-full bg-black/50 hover:bg-black/80 text-white border border-zinc-700/50 backdrop-blur-md opacity-0 group-hover/hero:opacity-100 transition-all duration-300 cursor-pointer"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>

              {/* Right Navigation Arrow */}
              <button
                onClick={nextSlide}
                aria-label="Next slide"
                className="absolute right-4 top-1/2 -translate-y-1/2 z-30 p-3 rounded-full bg-black/50 hover:bg-black/80 text-white border border-zinc-700/50 backdrop-blur-md opacity-0 group-hover/hero:opacity-100 transition-all duration-300 cursor-pointer"
              >
                <ChevronRight className="w-6 h-6" />
              </button>

              {/* Pagination Dots (desktop: bottom-right corner) */}
              <div
                data-testid="hero-pagination-desktop"
                className="hidden md:flex absolute bottom-6 right-8 md:right-16 z-30 items-center gap-2 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-zinc-800/80"
              >
                <PaginationDots
                  heroes={heroesList}
                  activeIndex={activeIndex}
                  onSelect={setActiveIndex}
                />
              </div>
            </>
          )}
        </div>
      ) : (
        <div data-testid="hero-empty" className="relative h-[40vh] min-h-[300px] w-full bg-[var(--bg)] flex items-center justify-center text-center p-8">
          <div className="space-y-3">
            <Sparkles className="w-8 h-8 text-[var(--muted)] mx-auto" />
            <h2 className="text-xl font-semibold text-[var(--ink)]">No Featured Series Available</h2>
            <p className="text-sm text-[var(--muted)] max-w-md">Check back soon for new anime releases and home feed updates.</p>
          </div>
        </div>
      )}

      {/* Content Carousel Rows */}
      <div className="relative z-30 pb-20 -mt-10 space-y-4">
        {carouselRows.map((row, idx) => (
          <CarouselRowComponent
            key={row.id}
            row={row}
            rowIndex={idx + 1}
            focusedRow={focusedRow}
            focusedItem={focusedItem}
            isSpatialMode={isSpatialMode}
          />
        ))}
        {recentlyAddedEpisodes.length > 0 && (
          <RecentlyAddedEpisodesRow episodes={recentlyAddedEpisodes} />
        )}
      </div>

      <SeriesDetailDialog
        series={currentHero}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onPlay={(seriesId) => navigate({ to: '/watch/$seriesId', params: { seriesId } })}
      />
    </div>
  );
}
