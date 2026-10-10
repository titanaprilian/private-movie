import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import {
  Play,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Star,
} from 'lucide-react';
import { useInputMode } from '@/hooks/useInputMode';
import { ChunkyButton } from '@/components/ui/chunky-button';
import { ChunkyCard } from '@/components/ui/chunky-card';
import { ErrorState } from '@/components/ui/error-state';
import { ChunkySkeleton } from '@/components/ui/chunky-skeleton';
import { PublicNavbar } from '@/modules/navigation';
import {
  RecentEpisodeCard,
  SeriesDetailDialog,
  SeriesPosterCard,
} from '@/modules/videos';
import { useHomeFeedNav } from './hooks/useHomeFeedNav';
import { useDragScroll } from './hooks/useDragScroll';
import {
  homeFeedQueryOptions,
  type MediaRecentlyAddedEpisode,
} from './api';
import type { SeriesItem, CarouselRowData } from './types';
import {
  episodeBadge,
  mapHeroToSeriesItem,
  mapSeriesToSeriesItem,
  resolveEpisodeThumbnail,
} from './mappers';

function RecentlyAddedEpisodesRow({
  episodes,
}: {
  episodes: MediaRecentlyAddedEpisode[];
}) {
  const navigate = useNavigate();
  const { containerRef, dragHandlers, isDragging } =
    useDragScroll<HTMLDivElement>();

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
      <h2 className="font-display text-xl md:text-2xl font-bold mb-3 text-[var(--ink)] flex items-center gap-2 px-8 md:px-16">
        <span>Recently Added Episodes</span>
        <ChevronRight className="w-5 h-5 text-[var(--muted)] opacity-0 group-hover/row:opacity-100 transition-opacity" />
      </h2>

      <div className="relative px-8 md:px-16">
        {/* Left Scroll Button */}
        <ChunkyButton
          size="icon"
          variant="translucent"
          onClick={() => scroll('left')}
          className="absolute left-2 top-1/2 -translate-y-1/2 z-40 opacity-0 group-hover/row:opacity-100 transition-all duration-200"
          aria-label="Scroll Recently Added Episodes left"
        >
          <ChevronLeft className="w-8 h-8" />
        </ChunkyButton>

        {/* Horizontal Carousel Container */}
        <div
          ref={containerRef}
          data-testid="carousel-track"
          {...dragHandlers}
          className={`flex gap-4 overflow-x-auto py-4 scrollbar-none select-none ${
            isDragging
              ? 'snap-none !cursor-grabbing [&_*]:!cursor-grabbing'
              : 'scroll-smooth snap-x snap-mandatory cursor-grab active:cursor-grabbing'
          }`}
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
        <ChunkyButton
          size="icon"
          variant="translucent"
          onClick={() => scroll('right')}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-40 opacity-0 group-hover/row:opacity-100 transition-all duration-200"
          aria-label="Scroll Recently Added Episodes right"
        >
          <ChevronRight className="w-8 h-8" />
        </ChunkyButton>
      </div>
    </div>
  );
}

function HomeFeedHeroSkeleton() {
  return (
    <div
      data-testid="hero-skeleton"
      aria-busy="true"
      aria-label="Loading featured series"
      className="relative h-[100dvh] md:h-[85vh] min-h-[550px] w-full bg-[var(--bg)] flex items-end p-8 md:p-16"
    >
      <div className="max-w-3xl space-y-4 w-full">
        <ChunkySkeleton className="h-4 w-32" />
        <ChunkySkeleton className="h-12 w-3/4" />
        <div className="flex gap-3">
          <ChunkySkeleton className="h-4 w-20" />
          <ChunkySkeleton className="h-4 w-16" />
          <ChunkySkeleton className="h-4 w-24" />
        </div>
        <ChunkySkeleton className="h-16 w-full max-w-xl" />
        <div className="flex gap-4 pt-2">
          <ChunkySkeleton className="h-12 w-28" />
          <ChunkySkeleton className="h-12 w-32" />
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
      <ChunkySkeleton className="h-7 w-48" />
      <div className="flex gap-4 overflow-hidden py-2">
        {Array.from({ length: 5 }).map((_, idx) => (
          <ChunkySkeleton
            key={idx}
            className="w-[160px] sm:w-[180px] aspect-[2/3] flex-shrink-0"
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
      <ErrorState
        title="Unable to Load Home Feed"
        description="We encountered an issue connecting to the backend server. Please check your network connection or try again."
        onRetry={onRetry}
        retryLabel="Retry Connection"
      />
    </div>
  );
}

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
  const { containerRef, dragHandlers, isDragging } =
    useDragScroll<HTMLDivElement>();

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
      <h2 className="font-display text-xl md:text-2xl font-bold mb-3 text-[var(--ink)] flex items-center gap-2 px-8 md:px-16">
        <span>{row.title}</span>
        <ChevronRight className="w-5 h-5 text-[var(--muted)] opacity-0 group-hover/row:opacity-100 transition-opacity" />
      </h2>

      <div className="relative px-8 md:px-16">
        {/* Left Scroll Button */}
        <ChunkyButton
          size="icon"
          variant="translucent"
          onClick={() => scroll('left')}
          className="absolute left-2 top-1/2 -translate-y-1/2 z-40 opacity-0 group-hover/row:opacity-100 transition-all duration-200"
          aria-label={`Scroll ${row.title} left`}
        >
          <ChevronLeft className="w-8 h-8" />
        </ChunkyButton>

        {/* Horizontal Carousel Container */}
        <div
          ref={containerRef}
          data-testid="carousel-track"
          {...dragHandlers}
          className={`flex gap-4 overflow-x-auto py-4 scrollbar-none select-none ${
            isDragging
              ? 'snap-none !cursor-grabbing [&_*]:!cursor-grabbing'
              : 'scroll-smooth snap-x snap-mandatory cursor-grab active:cursor-grabbing'
          }`}
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {row.items.map((item, idx) => {
            const isFocused =
              isSpatialMode && focusedRow === rowIndex && focusedItem === idx;

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
        <ChunkyButton
          size="icon"
          variant="translucent"
          onClick={() => scroll('right')}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-40 opacity-0 group-hover/row:opacity-100 transition-all duration-200"
          aria-label={`Scroll ${row.title} right`}
        >
          <ChevronRight className="w-8 h-8" />
        </ChunkyButton>
      </div>
    </div>
  );
}

export function CinematicHome({ genreSlug }: { genreSlug?: string } = {}) {
  const navigate = useNavigate();
  const { isSpatialMode } = useInputMode();

  const { data, isLoading, isError, refetch } = useQuery(
    homeFeedQueryOptions(genreSlug)
  );

  const heroesList: SeriesItem[] =
    data?.heroes && data.heroes.length > 0
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
    onSelectSeries: (seriesId) =>
      navigate({ to: '/watch/$seriesId', params: { seriesId } }),
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
          className="relative h-[100dvh] md:h-[85vh] min-h-[550px] w-full bg-[var(--bg)] overflow-hidden group/hero"
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
                    heroes={heroesList}
                    activeIndex={activeIndex}
                    onSelect={setActiveIndex}
                  />
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center md:justify-start gap-4 pt-4 w-full md:w-auto">
                <ChunkyButton
                  data-testid="hero-play"
                  data-nav-row={0}
                  data-nav-item={0}
                  onClick={() =>
                    navigate({
                      to: '/watch/$seriesId',
                      params: { seriesId: currentHero.id },
                    })
                  }
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
                  onClick={() => setDetailOpen(true)}
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
                onClick={prevSlide}
                aria-label="Previous slide"
                className="absolute left-4 top-1/2 -translate-y-1/2 z-30 opacity-0 group-hover/hero:opacity-100 transition-all duration-300"
              >
                <ChevronLeft className="w-6 h-6" />
              </ChunkyButton>

              {/* Right Navigation Arrow */}
              <ChunkyButton
                size="icon"
                variant="translucent"
                onClick={nextSlide}
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
                  heroes={heroesList}
                  activeIndex={activeIndex}
                  onSelect={setActiveIndex}
                />
              </div>
            </>
          )}
        </div>
      ) : (
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
        onPlay={(seriesId) =>
          navigate({ to: '/watch/$seriesId', params: { seriesId } })
        }
      />
    </div>
  );
}
