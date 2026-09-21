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
import { useHomeFeedNav } from './useHomeFeedNav';
import {
  homeFeedQueryOptions,
  type MediaSeriesMetadata,
  type MediaHomeFeedHero,
} from './api';

export interface SeriesItem {
  id: string;
  title: string;
  synopsis: string;
  posterUrl: string;
  bannerUrl: string;
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
      className="relative h-[85vh] min-h-[550px] w-full bg-zinc-950 animate-pulse flex items-end p-8 md:p-16"
    >
      <div className="max-w-3xl space-y-4 w-full">
        <div className="h-4 w-32 bg-zinc-800 rounded" />
        <div className="h-12 w-3/4 bg-zinc-800 rounded" />
        <div className="flex gap-3">
          <div className="h-4 w-20 bg-zinc-800 rounded" />
          <div className="h-4 w-16 bg-zinc-800 rounded" />
          <div className="h-4 w-24 bg-zinc-800 rounded" />
        </div>
        <div className="h-16 w-full max-w-xl bg-zinc-800 rounded" />
        <div className="flex gap-4 pt-2">
          <div className="h-12 w-28 bg-zinc-800 rounded-md" />
          <div className="h-12 w-32 bg-zinc-800 rounded-md" />
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
      <div className="h-7 w-48 bg-zinc-800 rounded animate-pulse" />
      <div className="flex gap-4 overflow-hidden py-2">
        {Array.from({ length: 5 }).map((_, idx) => (
          <div
            key={idx}
            className="w-[160px] sm:w-[180px] aspect-[2/3] flex-shrink-0 bg-zinc-900 border border-zinc-800 rounded-md animate-pulse"
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
      className="min-h-screen bg-black text-white flex items-center justify-center p-6"
    >
      <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-lg p-8 text-center space-y-4 shadow-2xl">
        <div className="w-12 h-12 rounded-full bg-red-950/80 border border-red-800 text-red-500 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-zinc-100">Unable to Load Home Feed</h2>
        <p className="text-sm text-zinc-400 leading-relaxed">
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
      <h2 className="text-xl md:text-2xl font-bold mb-3 text-zinc-100 flex items-center gap-2 px-8 md:px-16">
        <span>{row.title}</span>
        <ChevronRight className="w-5 h-5 text-zinc-500 opacity-0 group-hover/row:opacity-100 transition-opacity" />
      </h2>

      <div className="relative px-8 md:px-16">
        {/* Left Scroll Button */}
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-0 bottom-0 z-40 w-12 bg-black/60 hover:bg-black/90 flex items-center justify-center text-white opacity-0 group-hover/row:opacity-100 transition-all duration-200"
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
            const isFirst = idx === 0;
            const isLast = idx === row.items.length - 1;
            const transformOrigin = isFirst ? 'origin-left' : isLast ? 'origin-right' : 'origin-center';
            const isFocused = isSpatialMode && focusedRow === rowIndex && focusedItem === idx;

            return (
              <div
                key={`${row.id}-${item.id}-${idx}`}
                data-testid="series-card"
                data-nav-row={rowIndex}
                data-nav-item={idx}
                onClick={() => navigate({ to: '/watch/$seriesId', params: { seriesId: item.id } })}
                className={`w-[160px] sm:w-[180px] flex-shrink-0 snap-start group relative rounded-md bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-all duration-300 transform hover:scale-105 sm:hover:scale-110 ${transformOrigin} z-10 hover:z-30 shadow-md hover:shadow-2xl cursor-pointer overflow-hidden ${
                  isFocused ? 'ring-2 ring-white' : ''
                }`}
              >
                {/* Poster / Aspect Ratio Box */}
                <div className="relative aspect-[2/3] w-full bg-zinc-800 overflow-hidden">
                  <img
                    src={item.posterUrl}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent opacity-60" />

                  {/* Type Badge (Top Left) */}
                  <div className="absolute top-2 left-2 z-10">
                    <span className="bg-black/80 backdrop-blur-md text-zinc-200 font-mono font-bold text-[10px] uppercase px-1.5 py-0.5 rounded border border-zinc-700 shadow">
                      {item.type}
                    </span>
                  </div>

                  {/* Rating Badge (Bottom Left) */}
                  <div className="absolute bottom-2.5 left-2.5 z-10 inline-flex items-center gap-1.5 bg-black/80 backdrop-blur-md text-white font-mono font-bold text-xs px-2.5 py-1 rounded border border-zinc-700/80 shadow-md leading-none">
                    <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />
                    <span className="leading-none">{item.rating}</span>
                  </div>

                  {/* Season Badge (Top Right) */}
                  <div className="absolute top-2 right-2 z-10">
                    <span className="bg-zinc-950/90 text-white font-mono font-bold text-xs px-2 py-0.5 rounded shadow border border-zinc-700">
                      S{item.seasons}
                    </span>
                  </div>
                </div>

                {/* Title beneath the poster */}
                <div className="p-2 sm:p-3 bg-zinc-900">
                  <h3 className="text-sm font-semibold text-zinc-100 truncate group-hover:text-white transition-colors">
                    {item.title}
                  </h3>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Scroll Button */}
        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-0 bottom-0 z-40 w-12 bg-black/60 hover:bg-black/90 flex items-center justify-center text-white opacity-0 group-hover/row:opacity-100 transition-all duration-200"
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
    data?.rows.map((r, idx) => ({
      id: `row-${idx}-${r.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      title: r.title,
      items: r.items.map(mapSeriesToSeriesItem),
    })) ?? [];

  const { focusedRow, focusedItem } = useHomeFeedNav({
    heroSeriesId: currentHero?.id,
    rows: carouselRows,
    onSelectSeries: (seriesId) => navigate({ to: '/watch/$seriesId', params: { seriesId } }),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white overflow-x-hidden font-sans">
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
      <div className="min-h-screen bg-black text-white overflow-x-hidden font-sans">
        <PublicNavbar />
        <HomeFeedErrorState onRetry={() => refetch()} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden font-sans selection:bg-red-600 selection:text-white">
      <PublicNavbar />
      {/* Hero Banner / Slider Section */}
      {currentHero ? (
        <div
          data-testid="hero-slider"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          onFocus={() => setIsPaused(true)}
          onBlur={() => setIsPaused(false)}
          className="relative h-[85vh] min-h-[550px] w-full bg-zinc-950 overflow-hidden group/hero"
        >
          {/* Background Banner Images with Smooth Crossfade */}
          {heroesList.map((item, idx) => (
            <div
              key={item.id}
              className={`absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ease-in-out ${
                idx === activeIndex ? 'opacity-100 z-0' : 'opacity-0 -z-10'
              }`}
              style={{ backgroundImage: `url(${item.bannerUrl})` }}
            />
          ))}

          {/* Gradient overlays for cinematic effect */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent z-10 pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/60 to-transparent z-10 pointer-events-none" />

          {/* Hero Content */}
          <div className="absolute bottom-12 left-0 z-20 w-full px-8 md:px-16 text-left">
            <div className="max-w-3xl space-y-4">
              {/* Tagline / Badge */}
              <div className="flex items-center gap-2 text-xs font-mono tracking-widest text-red-500 uppercase">
                <Sparkles className="w-4 h-4 text-red-500" />
                <span>Featured Simulcast</span>
              </div>

              {/* Title */}
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white leading-tight drop-shadow-md">
                {currentHero.title}
              </h1>

              {/* Meta Row */}
              <div className="flex items-center gap-3 text-sm text-zinc-300 flex-wrap">
                <span className="text-emerald-400 font-semibold">{currentHero.matchScore}</span>
                <span>{currentHero.year}</span>
                <span className="border border-zinc-600 px-1.5 py-0.5 rounded text-xs font-mono bg-black/40">{currentHero.rating}</span>
                <span className="bg-red-600/80 text-white px-1.5 py-0.5 rounded text-xs font-mono font-bold">{currentHero.subDub}</span>
                <span>{currentHero.seasons} {currentHero.seasons === 1 ? 'Season' : 'Seasons'}</span>
              </div>

              {/* Synopsis */}
              <p className="text-zinc-300 text-base md:text-lg line-clamp-3 leading-relaxed max-w-2xl text-shadow">
                {currentHero.synopsis}
              </p>

              {/* Action Buttons */}
              <div className="flex items-center gap-4 pt-4">
                <button
                  data-nav-row={0}
                  data-nav-item={0}
                  onClick={() => navigate({ to: '/watch/$seriesId', params: { seriesId: currentHero.id } })}
                  className={`bg-white text-black px-7 py-3 rounded-md text-base font-semibold hover:bg-zinc-200 transition-colors flex items-center gap-2 shadow-lg hover:shadow-white/10 cursor-pointer ${
                    isSpatialMode && focusedRow === 0 && focusedItem === 0 ? 'ring-2 ring-white' : ''
                  }`}
                >
                  <Play className="w-5 h-5 fill-black text-black" />
                  <span>Play</span>
                </button>
              </div>

              {/* Genre tags */}
              <div className="flex items-center gap-2 pt-2">
                {currentHero.genres.map((genre) => (
                  <span key={genre} className="text-xs text-zinc-400 font-mono flex items-center gap-2 bg-zinc-900/60 px-2 py-1 rounded border border-zinc-800">
                    {genre}
                  </span>
                ))}
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

              {/* Pagination Dots */}
              <div className="absolute bottom-6 right-8 md:right-16 z-30 flex items-center gap-2 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-zinc-800/80">
                {heroesList.map((item, idx) => (
                  <button
                    key={`dot-${item.id}-${idx}`}
                    onClick={() => setActiveIndex(idx)}
                    aria-label={`Go to slide ${idx + 1}`}
                    className={`h-2.5 rounded-full transition-all duration-300 cursor-pointer ${
                      idx === activeIndex
                        ? 'w-7 bg-red-600'
                        : 'w-2.5 bg-zinc-600 hover:bg-zinc-400'
                    }`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      ) : (
        <div data-testid="hero-empty" className="relative h-[40vh] min-h-[300px] w-full bg-zinc-950 flex items-center justify-center text-center p-8">
          <div className="space-y-3">
            <Sparkles className="w-8 h-8 text-zinc-600 mx-auto" />
            <h2 className="text-xl font-semibold text-zinc-400">No Featured Series Available</h2>
            <p className="text-sm text-zinc-500 max-w-md">Check back soon for new anime releases and home feed updates.</p>
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
      </div>
    </div>
  );
}
