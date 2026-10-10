import { useNavigate } from '@tanstack/react-router';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ChunkyButton } from '@/components/ui/chunky-button';
import { RecentEpisodeCard } from '@/modules/videos';
import { useDragScroll } from '../hooks/useDragScroll';
import { episodeBadge, resolveEpisodeThumbnail } from '../mappers';
import type { MediaRecentlyAddedEpisode } from '../api';

export function RecentlyAddedEpisodesRow({
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
