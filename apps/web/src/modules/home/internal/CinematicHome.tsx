import React, { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Play,
  Plus,
  Check,
  ChevronLeft,
  ChevronRight,
  Volume2,
  VolumeX,
  Sparkles,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import {
  homeFeedQueryOptions,
  type BackendSeriesWithMetadata,
  type HomeFeedHero,
} from './api';

export interface SeriesItem {
  id: string;
  title: string;
  synopsis: string;
  posterUrl: string;
  bannerUrl: string;
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

function mapSeriesToSeriesItem(s: BackendSeriesWithMetadata): SeriesItem {
  const genres = s.genres && s.genres.length > 0 ? s.genres.map((g) => g.name) : [];
  const year = s.createdAt ? new Date(s.createdAt).getFullYear() : 2026;
  const rating = s.rating || (s.type === 'movie' ? 'PG-13' : 'TV-14');
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
    matchScore: '98% Match',
    year,
    rating,
    seasons: s.seasonsCount ?? 0,
    episodes: s.episodesCount ?? 0,
    subDub: 'SUB | DUB',
    genres,
  };
}

function mapHeroToSeriesItem(hero: HomeFeedHero): SeriesItem {
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
      className="relative h-[85vh] min-h-[550px] w-full bg-zinc-950 border-b border-zinc-800 animate-pulse flex items-end p-8 md:p-16"
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
            className="w-[240px] sm:w-[280px] aspect-[16/9] flex-shrink-0 bg-zinc-900 border border-zinc-800 rounded-md animate-pulse"
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

function CarouselRowComponent({ row }: { row: CarouselRowData }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [myListIds, setMyListIds] = useState<Record<string, boolean>>({});

  const toggleMyList = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setMyListIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

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
            const inList = myListIds[item.id] ?? false;

            return (
              <div
                key={`${row.id}-${item.id}-${idx}`}
                data-testid="series-card"
                className="w-[240px] sm:w-[280px] flex-shrink-0 snap-start group relative rounded-md bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-all duration-300 transform hover:scale-105 sm:hover:scale-110 z-10 hover:z-30 shadow-md hover:shadow-2xl cursor-pointer"
              >
                {/* Poster / Aspect Ratio Box */}
                <div className="relative aspect-[16/9] w-full rounded-t-md overflow-hidden bg-zinc-800">
                  <img
                    src={item.posterUrl}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent opacity-80" />

                  {/* SUB/DUB Badge overlay */}
                  <div className="absolute top-2 left-2 flex items-center gap-1.5">
                    <span className="bg-red-600/90 backdrop-blur-md text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow mono">
                      {item.subDub}
                    </span>
                  </div>

                  {/* Season Badge */}
                  <div className="absolute top-2 right-2">
                    <span className="bg-black/70 backdrop-blur-md text-zinc-300 text-[10px] font-mono px-1.5 py-0.5 rounded border border-zinc-700">
                      {item.seasons} {item.seasons === 1 ? 'Season' : 'Seasons'}
                    </span>
                  </div>
                </div>

                {/* Card Content / Hover Details */}
                <div className="p-3 bg-zinc-900 rounded-b-md">
                  <h3 className="text-sm font-semibold text-zinc-100 truncate group-hover:text-white transition-colors">
                    {item.title}
                  </h3>

                  {/* Hover Meta Row */}
                  <div className="flex items-center justify-between text-xs mt-2 text-zinc-400">
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-400 font-medium">{item.matchScore}</span>
                      <span className="border border-zinc-700 px-1 rounded text-[10px] font-mono">{item.rating}</span>
                    </div>
                    <span className="font-mono text-[11px] text-zinc-400">{item.episodes} EPS</span>
                  </div>

                  {/* Action buttons revealed on hover */}
                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-zinc-800/80">
                    <div className="flex items-center gap-2">
                      <button
                        className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center hover:bg-zinc-200 transition-colors shadow"
                        aria-label={`Play ${item.title}`}
                      >
                        <Play className="w-4 h-4 fill-black text-black ml-0.5" />
                      </button>
                      <button
                        onClick={(e) => toggleMyList(item.id, e)}
                        className={`w-8 h-8 rounded-full border border-zinc-700 flex items-center justify-center transition-colors ${
                          inList ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-zinc-800 hover:bg-zinc-700 text-white'
                        }`}
                        aria-label={inList ? `Remove ${item.title} from list` : `Add ${item.title} to list`}
                      >
                        {inList ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                      </button>
                    </div>

                    <div className="flex items-center gap-1">
                      {item.genres.slice(0, 2).map((g) => (
                        <span key={g} className="text-[10px] font-mono text-zinc-400 bg-zinc-800 px-1.5 py-0.5 rounded">
                          {g}
                        </span>
                      ))}
                    </div>
                  </div>
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

export function CinematicHome() {
  const [heroMuted, setHeroMuted] = useState(true);
  const [heroInList, setHeroInList] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery(homeFeedQueryOptions());

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white overflow-x-hidden font-sans">
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
    return <HomeFeedErrorState onRetry={() => refetch()} />;
  }

  const heroAnime = data?.hero ? mapHeroToSeriesItem(data.hero) : null;
  const carouselRows: CarouselRowData[] =
    data?.rows.map((r, idx) => ({
      id: `row-${idx}-${r.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      title: r.title,
      items: r.items.map(mapSeriesToSeriesItem),
    })) ?? [];

  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden font-sans selection:bg-red-600 selection:text-white">
      {/* Hero Banner Section */}
      {heroAnime ? (
        <div className="relative h-[85vh] min-h-[550px] w-full bg-zinc-950 border-b border-zinc-800">
          {/* Background Banner Image */}
          <div
            className="absolute inset-0 bg-cover bg-center transition-opacity duration-700"
            style={{ backgroundImage: `url(${heroAnime.bannerUrl})` }}
          />

          {/* Gradient overlays for cinematic effect */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent z-10" />
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/60 to-transparent z-10" />

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
                {heroAnime.title}
              </h1>

              {/* Meta Row */}
              <div className="flex items-center gap-3 text-sm text-zinc-300 flex-wrap">
                <span className="text-emerald-400 font-semibold">{heroAnime.matchScore}</span>
                <span>{heroAnime.year}</span>
                <span className="border border-zinc-600 px-1.5 py-0.5 rounded text-xs font-mono bg-black/40">{heroAnime.rating}</span>
                <span className="bg-red-600/80 text-white px-1.5 py-0.5 rounded text-xs font-mono font-bold">{heroAnime.subDub}</span>
                <span>{heroAnime.seasons} {heroAnime.seasons === 1 ? 'Season' : 'Seasons'}</span>
              </div>

              {/* Synopsis */}
              <p className="text-zinc-300 text-base md:text-lg line-clamp-3 leading-relaxed max-w-2xl text-shadow">
                {heroAnime.synopsis}
              </p>

              {/* Action Buttons */}
              <div className="flex items-center gap-4 pt-4">
                <button className="bg-white text-black px-7 py-3 rounded-md text-base font-semibold hover:bg-zinc-200 transition-colors flex items-center gap-2 shadow-lg hover:shadow-white/10 cursor-pointer">
                  <Play className="w-5 h-5 fill-black text-black" />
                  <span>Play</span>
                </button>

                <button
                  onClick={() => setHeroInList(!heroInList)}
                  className={`px-6 py-3 rounded-md text-base font-medium transition-colors flex items-center gap-2 border shadow-lg cursor-pointer ${
                    heroInList ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-zinc-900/80 hover:bg-zinc-800 text-white border-zinc-700'
                  }`}
                >
                  {heroInList ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                  <span>{heroInList ? 'In My List' : 'My List'}</span>
                </button>

                <button
                  onClick={() => setHeroMuted(!heroMuted)}
                  className="w-12 h-12 rounded-full bg-zinc-900/80 hover:bg-zinc-800 text-white border border-zinc-700 flex items-center justify-center transition-colors ml-auto md:ml-0"
                  aria-label={heroMuted ? 'Unmute' : 'Mute'}
                >
                  {heroMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                </button>
              </div>

              {/* Genre tags */}
              <div className="flex items-center gap-2 pt-2">
                {heroAnime.genres.map((genre) => (
                  <span key={genre} className="text-xs text-zinc-400 font-mono flex items-center gap-2 bg-zinc-900/60 px-2 py-1 rounded border border-zinc-800">
                    {genre}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative h-[40vh] min-h-[300px] w-full bg-zinc-950 border-b border-zinc-800 flex items-center justify-center text-center p-8">
          <div className="space-y-3">
            <Sparkles className="w-8 h-8 text-zinc-600 mx-auto" />
            <h2 className="text-xl font-semibold text-zinc-400">No Featured Series Available</h2>
            <p className="text-sm text-zinc-500 max-w-md">Check back soon for new anime releases and home feed updates.</p>
          </div>
        </div>
      )}

      {/* Content Carousel Rows */}
      <div className="relative z-30 pb-20 -mt-10 space-y-4">
        {carouselRows.map((row) => (
          <CarouselRowComponent key={row.id} row={row} />
        ))}
      </div>
    </div>
  );
}
