import { useState } from 'react';
import { Check, Play } from 'lucide-react';
import { ChunkyCard } from '@/components/ui/chunky-card';
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

  const handleActivate = () => {
    onSelect(episode.id);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(episode.id);
    }
  };

  return (
    <ChunkyCard
      interactive
      selected={isNowPlaying}
      role="button"
      tabIndex={0}
      onClick={handleActivate}
      onKeyDown={handleKeyDown}
      data-testid={`episode-row-${episode.id}`}
      aria-label={`Play Episode ${episode.order ?? index + 1}: ${episode.title}`}
      className={`group relative flex w-full items-center gap-3.5 rounded-2xl p-3 sm:px-4 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)] ${
        isFocused ? 'ring-2 ring-white outline-none' : ''
      }`}
    >
      {/* 2-digit index number — 3D index box badge */}
      <span
        data-testid="episode-row-index"
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-2 border-b-4 font-display font-extrabold text-sm sm:text-base transition-colors ${
          isNowPlaying
            ? 'border-[var(--green-dark)] bg-[var(--green)] text-white shadow-[0_3px_0_var(--green-dark)]'
            : 'border-[var(--border)] bg-[var(--bg)] text-[var(--muted)] shadow-[0_3px_0_var(--border)]'
        }`}
      >
        {displayIndex}
      </span>

      {/* Thumbnail container with fallback and duration overlay */}
      <div className="relative h-14 w-24 sm:h-16 sm:w-28 rounded-xl overflow-hidden bg-[var(--surface-raised)] shrink-0 flex items-center justify-center">
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
            <Play className="h-5 w-5 text-[var(--muted)] group-hover:text-primary transition-colors" />
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
          className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-[var(--green)] flex items-center justify-center shrink-0 shadow-[0_3px_0_var(--green-dark)] text-white"
          aria-hidden="true"
        >
          <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4 stroke-[3]" />
        </span>
      )}
    </ChunkyCard>
  );
}
