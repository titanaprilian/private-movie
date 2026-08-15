import type { Series } from './types';

export interface SeriesCardProps {
  series: Series;
  onClick: () => void;
}

export function SeriesCard({ series, onClick }: SeriesCardProps) {
  return (
    <button
      type="button"
      data-testid="series-card"
      onClick={onClick}
      className="group bg-card border border-c rounded overflow-hidden text-left cursor-pointer transition-colors hover:border-primary"
    >
      <div className="relative aspect-video overflow-hidden bg-black/10">
        <img
          src={series.thumbnail}
          alt={series.title}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-200 flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 w-12 h-12 rounded-full bg-primary/90 flex items-center justify-center">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="text-primary-fg ml-0.5"
            >
              <polygon points="5,3 19,12 5,21" />
            </svg>
          </div>
        </div>
      </div>

      <div className="p-3">
        <h3 className="text-sm font-medium leading-snug line-clamp-2">
          {series.title}
        </h3>

        <div className="mt-1.5 flex items-center gap-2 text-xs text-muted">
          <span className="mono">{series.source}</span>
          <span className="w-1 h-1 rounded-full bg-border" />
          <span className="mono">
            {series.episodeCount} {series.episodeCount === 1 ? 'episode' : 'episodes'}
          </span>
        </div>

        <div className="mt-2 flex flex-wrap gap-1">
          {series.genres.map((genre) => (
            <span
              key={genre}
              className="text-[10px] mono px-1.5 py-0.5 rounded border border-c bg-sidebar text-muted"
            >
              {genre}
            </span>
          ))}
        </div>
      </div>
    </button>
  );
}