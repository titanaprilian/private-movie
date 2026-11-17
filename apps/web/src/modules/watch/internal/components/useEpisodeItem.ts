import { useState } from 'react';
import type {
  MediaEpisodeWithSources,
  MediaSeriesDetails,
} from '@repo/contracts';
import { formatDuration } from '../utils';

interface UseEpisodeItemOptions {
  episode: MediaEpisodeWithSources;
  series?: MediaSeriesDetails | null;
  onSelect: (episodeId: string) => void;
}

export function useEpisodeItem({
  episode,
  series,
  onSelect,
}: UseEpisodeItemOptions) {
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

  const handleActivate = () => {
    onSelect(episode.id);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(episode.id);
    }
  };

  return {
    activeImage,
    handleImageError,
    formattedDuration,
    handleActivate,
    handleKeyDown,
  };
}
