import { Star } from 'lucide-react';

export interface SeriesPosterCardProps {
  seriesId: string;
  title: string;
  posterUrl: string;
  type: string;
  seasonsCount?: number | null;
  rating?: string | null;
  focused?: boolean;
  onSelect?: (seriesId: string) => void;
}

function formatTypeLabel(type: string): string {
  const normalized = (type || 'tv').toLowerCase();
  if (normalized === 'movie') return 'Movie';
  return 'TV';
}

export function SeriesPosterCard({
  seriesId,
  title,
  posterUrl,
  type,
  seasonsCount,
  rating,
  focused = false,
  onSelect,
}: SeriesPosterCardProps) {
  return (
    <div
      data-testid="series-card"
      data-series-id={seriesId}
      onClick={() => onSelect?.(seriesId)}
      className={`w-44 shrink-0 rounded-[20px] border-2 border-[var(--border)] bg-[var(--bg)] overflow-hidden transition-all duration-150 hover:-translate-y-1 hover:border-[#1cb0f6] cursor-pointer group relative ${
        focused ? 'ring-2 ring-white' : ''
      }`}
    >
      <div className="relative aspect-[2/3] w-full bg-[var(--surface-raised)] overflow-hidden">
        <img
          src={posterUrl}
          alt={title}
          className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60 pointer-events-none" />

        <div className="absolute top-2 left-2 z-10">
          <span className="rounded-full px-2.5 py-1 text-xs font-extrabold bg-black/50 text-white">
            {formatTypeLabel(type)}
          </span>
        </div>

        {typeof seasonsCount === 'number' ? (
          <div className="absolute top-2 right-2 z-10">
            <span className="rounded-full px-2.5 py-1 text-xs font-extrabold bg-[#ce82ff] text-white">
              S{seasonsCount}
            </span>
          </div>
        ) : null}

        {rating ? (
          <div className="absolute bottom-2 left-2 z-10">
            <span className="rounded-full px-2.5 py-1 text-xs font-extrabold bg-[#ffc800] text-amber-950 flex items-center gap-1">
              <Star className="w-3.5 h-3.5 fill-amber-950 text-amber-950 shrink-0" aria-hidden="true" />
              <span className="leading-none">{rating}</span>
            </span>
          </div>
        ) : null}
      </div>

      <div className="p-2 sm:p-3 bg-[var(--bg)]">
        <h3 className="text-sm font-bold font-sans text-[var(--ink)] truncate line-clamp-2 group-hover:text-[var(--blue)] transition-colors">
          {title}
        </h3>
      </div>
    </div>
  );
}
