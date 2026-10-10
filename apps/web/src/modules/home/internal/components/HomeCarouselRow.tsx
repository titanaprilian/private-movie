import { useNavigate } from '@tanstack/react-router';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ChunkyButton } from '@/components/ui/chunky-button';
import { SeriesPosterCard } from '@/modules/videos';
import { useDragScroll } from '../hooks/useDragScroll';
import type { CarouselRowData } from '../types';

export function HomeCarouselRow({
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
