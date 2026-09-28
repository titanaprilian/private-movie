import { useState } from 'react';
import { Play } from 'lucide-react';
import { formatDuration } from './formatDuration';
import type { WatchEpisode, WatchSeriesDetails } from './api';

export interface EpisodeCardProps {
  episode: WatchEpisode;
  series?: WatchSeriesDetails | null;
  onSelect: (episodeId: string) => void;
  isNowPlaying?: boolean;
  isFocused?: boolean;
}

export function EpisodeCard({
  episode,
  series,
  onSelect,
  isNowPlaying,
  isFocused,
}: EpisodeCardProps) {
  const [imgErrorLevel, setImgErrorLevel] = useState(0);

  // Fallback hierarchy: episode.thumbnailUrl -> series.backdropUrl -> series.posterUrl -> placeholder
  const candidateImages = [
    episode.thumbnailUrl,
    series?.backdropUrl,
    series?.posterUrl,
  ].filter((url): url is string => Boolean(url && url.trim().length > 0));

  const activeImage = candidateImages[imgErrorLevel] ?? null;

  const handleImageError = () => {
    setImgErrorLevel((prev) => prev + 1);
  };

  const formattedDuration = formatDuration(episode.duration);

  return (
    <button
      type="button"
      onClick={() => onSelect(episode.id)}
      className={`group relative flex flex-col w-full text-left rounded-[20px] border-2 border-[var(--border)] bg-[var(--bg)] overflow-hidden transition-all duration-150 hover:-translate-y-1 hover:border-[var(--blue)] active:translate-y-0 cursor-pointer ${
        isNowPlaying ? 'border-[var(--green)] ring-2 ring-[var(--green)]' : ''
      } ${isFocused ? 'ring-2 ring-white outline-none' : ''}`}
      aria-label={`Play Episode ${episode.order ?? ''}: ${episode.title}`}
    >
      {/* 16:9 Thumbnail Box */}
      <div className="relative aspect-video w-full overflow-hidden bg-[var(--surface)] flex items-center justify-center">
        {activeImage ? (
          <img
            src={activeImage}
            alt={episode.title}
            onError={handleImageError}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex flex-col items-center justify-center gap-1 text-muted">
            <Play className="h-8 w-8 text-[var(--muted)] group-hover:text-primary transition-colors" />
          </div>
        )}

        {/* Hover overlay with play icon */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--green)] text-white shadow-[0_4px_0_var(--green-dark)]">
            <Play className="h-5 w-5 fill-current ml-0.5" />
          </div>
        </div>

        {/* Episode order badge top-left */}
        {episode.order !== undefined && episode.order !== null && (
          <span className="absolute top-2 left-2 rounded-full px-2.5 py-1 text-xs font-extrabold bg-[var(--green)] text-white shadow-[0_2px_0_var(--green-dark)]">
            EP {episode.order}
          </span>
        )}

        {/* Duration badge pill bottom-right */}
        {formattedDuration && (
          <span className="absolute bottom-2 right-2 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-bold text-zinc-200 backdrop-blur-sm border border-white/10">
            {formattedDuration}
          </span>
        )}

        {/* Now playing badge bottom-left */}
        {isNowPlaying && (
          <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-[var(--green)] px-2.5 py-1 text-[10px] font-extrabold text-white uppercase tracking-wide">
            <Play className="h-2.5 w-2.5 fill-current" /> Now Playing
          </span>
        )}
      </div>

      {/* Episode Details — streamlined high-density card: title only, no redundant paragraph */}
      <div className="flex flex-col flex-1 p-3">
        <h4
          className={`text-sm font-semibold line-clamp-1 group-hover:text-primary transition-colors ${
            isNowPlaying ? 'text-primary' : 'text-fg'
          }`}
          title={episode.title}
        >
          {episode.title}
        </h4>
      </div>
    </button>
  );
}
