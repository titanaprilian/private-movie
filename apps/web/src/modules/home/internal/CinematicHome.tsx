import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useInputMode } from '@/hooks/useInputMode';
import { PublicNavbar } from '@/modules/navigation';
import { SeriesDetailDialog } from '@/modules/videos';
import { useHomeFeedNav } from './hooks/useHomeFeedNav';
import { homeFeedQueryOptions, type MediaRecentlyAddedEpisode } from './api';
import type { SeriesItem, CarouselRowData } from './types';
import { mapHeroToSeriesItem, mapSeriesToSeriesItem } from './mappers';
import { HomeFeedHeroSkeleton, HomeFeedRowSkeleton } from './components/HomeFeedSkeletons';
import { HomeFeedErrorState } from './components/HomeFeedErrorState';
import { HomeCarouselRow } from './components/HomeCarouselRow';
import { RecentlyAddedEpisodesRow } from './components/RecentlyAddedEpisodesRow';
import { HomeHeroSlider } from './components/HomeHeroSlider';

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
      <HomeHeroSlider
        heroes={heroesList}
        activeIndex={activeIndex}
        onSelectIndex={setActiveIndex}
        onPrev={prevSlide}
        onNext={nextSlide}
        onPauseChange={setIsPaused}
        isSpatialMode={isSpatialMode}
        focusedRow={focusedRow}
        focusedItem={focusedItem}
        onPlay={(seriesId) =>
          navigate({ to: '/watch/$seriesId', params: { seriesId } })
        }
        onMoreInfo={() => setDetailOpen(true)}
      />

      {/* Content Carousel Rows */}
      <div className="relative z-30 pb-20 -mt-10 space-y-4">
        {carouselRows.map((row, idx) => (
          <HomeCarouselRow
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
