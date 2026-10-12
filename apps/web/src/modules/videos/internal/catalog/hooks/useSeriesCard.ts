import { useState } from 'react';
import type { SeriesItem } from '../../api';

import type { SeriesCardItem, UseSeriesCardOptions, UseSeriesCardReturn } from '../types';
export type { UseSeriesCardOptions, UseSeriesCardReturn } from '../types';

export function getSeriesCardEpisodeCount(item: SeriesCardItem): number {
  if (Array.isArray(item.episodes)) return item.episodes.length;
  return item.episodeCount ?? 0;
}

export function useSeriesCard({ item }: UseSeriesCardOptions): UseSeriesCardReturn {
  const [imgFailed, setImgFailed] = useState(false);
  const episodeCount = getSeriesCardEpisodeCount(item);
  const isFeatured = Boolean(item.isFeatured);
  const isHighlighted = Boolean(
    (item as SeriesItem & { isOngoingHighlighted?: boolean }).isOngoingHighlighted,
  );
  const isOngoing = Boolean(
    (item as SeriesItem & { hasOngoing?: boolean; seasons?: { status?: string }[] }).hasOngoing ||
      (item as SeriesItem & { seasons?: { status?: string }[] }).seasons?.some(
        (s) => s.status === 'ongoing',
      ),
  );
  const showImg = Boolean(item.posterUrl) && !imgFailed;
  const initial = (item.title?.charAt(0) ?? '?').toUpperCase();

  const handleImageError = () => {
    setImgFailed(true);
  };

  const stop = <T extends SeriesCardItem>(
    fn: (item: T, e: React.MouseEvent) => void,
    target: T,
  ) => {
    return (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      fn(target, e);
    };
  };

  return {
    imgFailed,
    episodeCount,
    isFeatured,
    isHighlighted,
    isOngoing,
    showImg,
    initial,
    handleImageError,
    stop,
  };
}
