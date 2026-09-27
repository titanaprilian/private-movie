import { useState } from 'react';
import { Check, Play } from 'lucide-react';
import { formatDuration } from './formatDuration';
import type { WatchEpisode, WatchSeriesDetails } from './api';

export interface EpisodeRowProps {
  episode: WatchEpisode;
  index: number;
  series?: WatchSeriesDetails | null;
  onSelect: (episodeId: string) => void;
  isNowPlaying?: boolean;
  isFocused?: boolean;
}

export function EpisodeRow({
  episode,
  index,
  series,
  onSelect,
  isNowPlaying,
  isFocused,
}: EpisodeRowProps) {
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
  const displayIndex = String(
    episode.order !== undefined && episode.order !== null
      ? episode.order
      : index + 1
  ).padStart(2, '0');

  return (
    <button
      type="button"
      onClick={() => onSelect(episode.id)}
      data-testid={`episode-row-${episode.id}`}
      className={`group relative flex w-full items-center gap-3.5 text-left rounded-[16px] border-2 border-[var(--border)] bg-[var(--surface)] p-3 sm:px-4 cursor-pointer transition-all duration-150 hover:-translate-y-0.5 hover:border-[var(--border-strong)] active:translate-y-0 active:scale-[0.995] ${
        isNowPlaying
          ? 'border-[var(--green)] bg-[var(--green)]/10 ring-1 ring-[var(--green)]'
          : ''
      } ${isFocused ? 'ring-2 ring-white outline-none' : ''}`}
      aria-label={`Play Episode ${episode.order ?? index + 1}: ${episode.title}`}
    >
      {/* 2-digit index number */}
      <span
        data-testid="episode-row-index"
        className={`w-7 text-center font-display font-extrabold text-sm sm:text-base shrink-0 transition-colors ${
          isNowPlaying ? 'text-[var(--green)]' : 'text-[var(--muted)]'
        }`}
      >
        {displayIndex}
      </span>

      {/* Thumbnail container with fallback and duration overlay */}
      <div className="relative h-14 w-24 sm:h-16 sm:w-28 rounded-xl overflow-hidden bg-zinc-900 shrink-0 flex items-center justify-center">
        {activeImage ? (
          <img
            src={activeImage}
            alt={episode.title}
            onError={handleImageError}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex items-center justify-center text-muted">
            <Play className="h-5 w-5 text-zinc-600 group-hover:text-primary transition-colors" />
          </div>
        )}

        {/* Duration badge overlay */}
        {formattedDuration && (
          <span
            data-testid="episode-row-duration"
            className="absolute bottom-1.5 right-1.5 rounded-full bg-black/75 px-1.5 py-0.5 text-[10px] font-bold text-zinc-200 backdrop-blur-sm border border-white/10 tabular-nums"
          >
            {formattedDuration}
          </span>
        )}
      </div>

      {/* Episode Title & Truncated Description */}
      <div className="flex flex-1 flex-col min-w-0 pr-2">
        <h4
          className={`font-display font-bold text-sm sm:text-base truncate transition-colors ${
            isNowPlaying ? 'text-[var(--green)]' : 'text-[var(--ink)]'
          }`}
          title={episode.title}
        >
          {episode.title}
        </h4>
        {episode.description ? (
          <p className="text-xs sm:text-sm text-[var(--muted)] truncate mt-0.5">
            {episode.description}
          </p>
        ) : (
          <p className="text-xs sm:text-sm text-[var(--muted)]/50 italic truncate mt-0.5">
            No description available
          </p>
        )}
      </div>

      {/* Active Checkmark Badge */}
      {isNowPlaying && (
        <span
          data-testid="episode-row-active-check"
          className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-[var(--green)] flex items-center justify-center shrink-0 shadow-sm text-white"
          aria-hidden="true"
        >
          <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4 stroke-[3]" />
        </span>
      )}
    </button>
  );
}
